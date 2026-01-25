import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import OpenAI from 'npm:openai@^4.28.0';

// --- INLINED GATEWAY LOGIC (COMPLIANCE SPECIALIST - SONAR) ---

function cleanJson(text) {
  if (typeof text === 'object') return text;
  try { return JSON.parse(text); } catch (e) {
    const match = text.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (match) { try { return JSON.parse(match[1]); } catch (e2) {} }
    const firstOpen = text.indexOf('{');
    const lastClose = text.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
      try { return JSON.parse(text.substring(firstOpen, lastClose + 1)); } catch (e3) {}
    }
    throw new Error("Failed to parse JSON response");
  }
}

async function invokeSpecializedLLM({ prompt, response_schema, base44_client }) {
  console.log(`[LLM Gateway - Compliance Specialist] Using Sonar Deep Research`);
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) throw new Error("PERPLEXITY_API_KEY missing");

    const perplexity = new OpenAI({ 
        apiKey, 
        baseURL: 'https://api.perplexity.ai' 
    });
    
    const completion = await perplexity.chat.completions.create({
        model: "sonar-deep-research",
        messages: [{ role: "user", content: fullPrompt }]
    });
    const content = completion.choices[0].message.content;
    return response_schema ? cleanJson(content) : content;
  } catch (e) {
     console.error(`[LLM Gateway] Primary strategy failed:`, e.message);
     return await base44_client.integrations.Core.InvokeLLM({
        prompt: fullPrompt,
        response_json_schema: response_schema,
        add_context_from_internet: true
    });
  }
}

// --- END INLINED GATEWAY ---

/**
 * TARIFF-AI 2.0: Extract compliance-relevant data from retrieved legal text corpus
 * This function builds the compliance context from previously scraped sources
 */
function buildComplianceLegalContext(researchFindings, structuralAnalysis) {
  const sections = [];
  
  // 1. Raw Legal Text Corpus - extract compliance-specific content
  if (researchFindings?.raw_legal_text_corpus) {
    const legalText = researchFindings.raw_legal_text_corpus;
    const complianceKeywords = [
      'license', 'permit', 'standard', 'certification', 'label', 'require',
      'prohibit', 'restrict', 'approval', 'regulation', 'compliance',
      'רישיון', 'תקן', 'אישור', 'תקנות', 'יבוא'
    ];
    
    const paragraphs = legalText.split(/\n\n+/);
    const relevantParagraphs = paragraphs.filter(p => 
      complianceKeywords.some(kw => p.toLowerCase().includes(kw))
    ).slice(0, 25); // Max 25 relevant paragraphs
    
    if (relevantParagraphs.length > 0) {
      sections.push(`
═══════════════════════════════════════════════════════════════════
REGULATORY DATA FROM LEGAL TEXT CORPUS
(Extract requirements ONLY from this text - do not assume)
═══════════════════════════════════════════════════════════════════
${relevantParagraphs.join('\n\n')}
═══════════════════════════════════════════════════════════════════`);
    }
  }
  
  // 2. Verified Sources with regulation links
  if (researchFindings?.verified_sources?.length > 0) {
    const regSources = researchFindings.verified_sources.filter(s =>
      s.title?.toLowerCase().includes('regulation') ||
      s.title?.toLowerCase().includes('standard') ||
      s.title?.toLowerCase().includes('requirement') ||
      s.authority_tier === '1' || s.authority_tier === '2'
    );
    
    if (regSources.length > 0) {
      const sourcesText = regSources.map(s => `
Source: ${s.title}
Authority: Tier ${s.authority_tier}
Date: ${s.date}
URL: ${s.url || 'N/A'}
Excerpt: ${s.snippet || 'N/A'}
`).join('\n');
      
      sections.push(`
═══════════════════════════════════════════════════════════════════
VERIFIED REGULATORY SOURCES
═══════════════════════════════════════════════════════════════════
${sourcesText}
═══════════════════════════════════════════════════════════════════`);
    }
  }
  
  // 3. Legal Notes that may contain compliance info
  if (researchFindings?.legal_notes_found?.length > 0) {
    const complianceNotes = researchFindings.legal_notes_found.filter(n =>
      n.toLowerCase().includes('require') ||
      n.toLowerCase().includes('standard') ||
      n.toLowerCase().includes('certif') ||
      n.toLowerCase().includes('license')
    );
    
    if (complianceNotes.length > 0) {
      sections.push(`
═══════════════════════════════════════════════════════════════════
COMPLIANCE-RELATED LEGAL NOTES
═══════════════════════════════════════════════════════════════════
${complianceNotes.join('\n\n')}
═══════════════════════════════════════════════════════════════════`);
    }
  }
  
  // 4. Industry-specific data that may affect compliance
  if (structuralAnalysis?.industry_category) {
    sections.push(`
═══════════════════════════════════════════════════════════════════
PRODUCT INDUSTRY CONTEXT
═══════════════════════════════════════════════════════════════════
Industry: ${structuralAnalysis.industry_category}
Function: ${structuralAnalysis.function || 'N/A'}
Material: ${structuralAnalysis.material_composition || 'N/A'}
Essential Character: ${structuralAnalysis.essential_character || 'N/A'}
═══════════════════════════════════════════════════════════════════`);
  }
  
  return sections.join('\n\n');
}

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { reportId, knowledgeBase } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });
    
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });

    // ═══════════════════════════════════════════════════════════════════
    // TARIFF-AI 2.0: Build COMPLIANCE_LEGAL_CONTEXT from retrieved sources
    // ═══════════════════════════════════════════════════════════════════
    console.log('[AgentCompliance] Building compliance legal context from retrieved sources');
    const complianceLegalContext = buildComplianceLegalContext(report.research_findings, report.structural_analysis);
    console.log(`[AgentCompliance] Compliance legal context: ${complianceLegalContext.length} chars`);

    const kbContext = knowledgeBase ? `
Knowledge Base for ${knowledgeBase.country}:
Regulation Links: ${knowledgeBase.regulation_links}
Government Trade Links: ${knowledgeBase.government_trade_links}
` : '';

    const context = `
Destination Country: ${report.destination_country}
Product: ${report.product_name}
Intended Use: ${report.user_input_text}
HS Code: ${report.classification_results?.primary?.hs_code}
${kbContext}
`;

    const systemPrompt = `
You are a REGULATORY COMPLIANCE EXTRACTION SPECIALIST.

═══════════════════════════════════════════════════════════════════
TARIFF-AI 2.0: RETRIEVE & DEDUCE PROTOCOL FOR COMPLIANCE DATA
═══════════════════════════════════════════════════════════════════

CRITICAL INSTRUCTION: You have been provided with COMPLIANCE_LEGAL_CONTEXT containing:
- Retrieved regulatory text from official sources
- Verified regulatory sources with URLs
- Legal notes with compliance requirements

YOUR EXTRACTION MUST:
1. EXTRACT requirements ONLY from the COMPLIANCE_LEGAL_CONTEXT provided
2. Cite the exact source for each requirement
3. If requirement not found in context, mark as "NOT_FOUND_IN_CONTEXT - Requires verification"
4. Flag any data gaps clearly
5. Do NOT assume or invent requirements not in the context

═══════════════════════════════════════════════════════════════════

EXTRACTION TASK:
═══════════════════════════════════════════════════════════════════

For destination country: ${report.destination_country}
For product: ${report.product_name}
For HS Code: ${report.classification_results?.primary?.hs_code}

Extract from COMPLIANCE_LEGAL_CONTEXT:

**1. IMPORT LICENSES & PERMITS**
- Extract any license requirements mentioned in the legal text
- Cite source: "Per [Source]: '[exact quote]'"

**2. MANDATORY STANDARDS**
- Extract standard numbers mentioned (ISO, CE, SI, EN, etc.)
- Cite source for each standard

**3. LABELING REQUIREMENTS**
- Extract labeling rules from legal text
- Cite source

**4. CERTIFICATIONS**
- Extract certification requirements
- Cite testing bodies mentioned

**5. PROHIBITIONS/RESTRICTIONS**
- Extract any bans or restrictions mentioned
- Cite source

═══════════════════════════════════════════════════════════════════
CITATION FORMAT REQUIRED:
"Requirement: [Description] - Source: [Exact source from COMPLIANCE_LEGAL_CONTEXT]"

If not found in context:
"Requirement: NOT_FOUND_IN_CONTEXT - Requires manual verification at [suggested authority]"

IMPORTANT: Do NOT invent requirements. Only extract what is explicitly stated.
═══════════════════════════════════════════════════════════════════
`;

    const fullPrompt = `${systemPrompt}\n\n${complianceLegalContext}\n\nCASE DATA:\n${context}`;

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        response_schema: {
            type: "object",
            properties: {
                compliance_data: {
                    type: "object",
                    properties: {
                        import_requirements: { 
                            type: "array", 
                            items: { 
                                type: "object",
                                properties: {
                                    requirement: { type: "string" },
                                    source_citation: { type: "string", description: "Exact source from COMPLIANCE_LEGAL_CONTEXT" },
                                    verification_url: { type: "string" }
                                }
                            } 
                        },
                        mandatory_standards: { 
                            type: "array", 
                            items: { 
                                type: "object",
                                properties: {
                                    standard: { type: "string" },
                                    source_citation: { type: "string", description: "Exact source from context" },
                                    issuing_body: { type: "string" },
                                    verification_url: { type: "string" }
                                }
                            } 
                        },
                        labeling_laws: { 
                            type: "array", 
                            items: { 
                                type: "object",
                                properties: {
                                    requirement: { type: "string" },
                                    source_citation: { type: "string" }
                                }
                            } 
                        },
                        prohibitions: { 
                            type: "array", 
                            items: { 
                                type: "object",
                                properties: {
                                    prohibition: { type: "string" },
                                    source_citation: { type: "string" }
                                }
                            } 
                        },
                        licenses_required: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    license_type: { type: "string" },
                                    source_citation: { type: "string" },
                                    issuing_authority: { type: "string" },
                                    application_url: { type: "string" }
                                }
                            }
                        },
                        certifications_needed: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    certification: { type: "string" },
                                    source_citation: { type: "string" },
                                    testing_body: { type: "string" },
                                    validity_period: { type: "string" }
                                }
                            }
                        },
                        import_legality: {
                            type: "string",
                            enum: ["freely_importable", "requires_license", "restricted", "prohibited", "unknown"],
                            description: "Overall import legality status based on extracted data"
                        },
                        data_gaps: {
                            type: "array",
                            items: { type: "string" },
                            description: "Requirements NOT found in COMPLIANCE_LEGAL_CONTEXT"
                        },
                        extraction_confidence: {
                            type: "string",
                            enum: ["high", "medium", "low"],
                            description: "Confidence based on data availability in context"
                        }
                    }
                }
            }
        },
        base44_client: base44
    });

    // Enrich with extraction metadata
    const complianceData = result.compliance_data || {};
    const enrichedComplianceData = {
        ...complianceData,
        extraction_metadata: {
            legal_context_available: complianceLegalContext.length > 100,
            legal_context_chars: complianceLegalContext.length,
            extracted_from_retrieved_sources: true
        }
    };
    
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        regulatory_data: {
            ...(report.regulatory_data || {}),
            primary: {
                ...(report.regulatory_data?.primary || {}),
                import_requirements: enrichedComplianceData.import_requirements || [],
                standards_requirements: enrichedComplianceData.mandatory_standards || [],
                import_legality: enrichedComplianceData.import_legality || 'unknown'
            },
            compliance_details: enrichedComplianceData,
            compliance_extraction_metadata: enrichedComplianceData.extraction_metadata
        }
    });
    
    return Response.json({ 
        success: true, 
        status: 'compliance_extracted', 
        data: enrichedComplianceData,
        retrieval_metadata: {
            legal_context_used: complianceLegalContext.length > 0,
            extraction_based: true
        }
    });

  } catch (error) {
    console.error('Agent Compliance Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});