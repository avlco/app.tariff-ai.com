import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@^0.1.0';

// --- INLINED GATEWAY LOGIC (TAX SPECIALIST - GEMINI) ---

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
  console.log(`[LLM Gateway - Tax Specialist] Using Gemini 3 Flash Preview`);
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error("GEMINI_API_KEY not set");

    const genAI = new GoogleGenerativeAI(geminiKey);
    // Raw string model ID, no config object
    const model = genAI.getGenerativeModel({ 
        model: "gemini-3-flash-preview"
    });
    
    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();
    return response_schema ? cleanJson(text) : text;
  } catch (e) {
     console.error(`[LLM Gateway] Primary strategy failed:`, e.message);
     // Fallback
     return await base44_client.integrations.Core.InvokeLLM({
        prompt: fullPrompt,
        response_json_schema: response_schema
    });
  }
}

// --- END INLINED GATEWAY ---

/**
 * TARIFF-AI 2.0: Extract tax-relevant data from retrieved legal text corpus
 * This function builds the tax context from previously scraped sources
 */
function buildTaxLegalContext(researchFindings, classificationResults) {
  const sections = [];
  
  // 1. Raw Legal Text Corpus - extract tariff-specific content
  if (researchFindings?.raw_legal_text_corpus) {
    // Extract sections related to tariffs, duties, taxes
    const legalText = researchFindings.raw_legal_text_corpus;
    const tariffKeywords = ['duty', 'tariff', 'rate', 'vat', 'tax', 'customs', 'מכס', 'מע"מ', 'שיעור'];
    
    // Try to find tariff-related paragraphs
    const paragraphs = legalText.split(/\n\n+/);
    const relevantParagraphs = paragraphs.filter(p => 
      tariffKeywords.some(kw => p.toLowerCase().includes(kw))
    ).slice(0, 20); // Max 20 relevant paragraphs
    
    if (relevantParagraphs.length > 0) {
      sections.push(`
═══════════════════════════════════════════════════════════════════
TARIFF DATA FROM LEGAL TEXT CORPUS
(Extract rates and duties ONLY from this text - do not estimate)
═══════════════════════════════════════════════════════════════════
${relevantParagraphs.join('\n\n')}
═══════════════════════════════════════════════════════════════════`);
    }
  }
  
  // 2. Country-specific tariff data from research
  if (researchFindings?.country_specific_data) {
    const csd = researchFindings.country_specific_data;
    sections.push(`
═══════════════════════════════════════════════════════════════════
COUNTRY-SPECIFIC TARIFF DATA
═══════════════════════════════════════════════════════════════════
Tariff Year: ${csd.tariff_year || 'Unknown'}
HS Structure: ${csd.hs_structure || 'Unknown'}
National Codes: ${csd.national_codes?.join(', ') || 'None found'}
National Notes: ${csd.national_notes?.join('\n') || 'None found'}
Official Source: ${csd.official_source || 'Not specified'}
═══════════════════════════════════════════════════════════════════`);
  }
  
  // 3. Trade Agreements (for preferential rates)
  if (researchFindings?.trade_agreements?.length > 0) {
    const ftaText = researchFindings.trade_agreements.map(fta => `
FTA: ${fta.name}
Preferential Rate: ${fta.preferential_rate || 'See agreement'}
Origin Requirements: ${fta.origin_requirements || 'Standard'}
Certificate: ${fta.certificate_needed || 'Check requirements'}
`).join('\n');
    
    sections.push(`
═══════════════════════════════════════════════════════════════════
TRADE AGREEMENTS & PREFERENTIAL RATES
═══════════════════════════════════════════════════════════════════
${ftaText}
═══════════════════════════════════════════════════════════════════`);
  }
  
  // 4. Classification citations that mention rates
  if (classificationResults?.primary?.legal_citations?.length > 0) {
    const rateCitations = classificationResults.primary.legal_citations.filter(c =>
      c.exact_quote?.toLowerCase().includes('rate') ||
      c.exact_quote?.toLowerCase().includes('duty') ||
      c.exact_quote?.toLowerCase().includes('%')
    );
    
    if (rateCitations.length > 0) {
      sections.push(`
═══════════════════════════════════════════════════════════════════
RATE-RELATED CITATIONS FROM CLASSIFICATION
═══════════════════════════════════════════════════════════════════
${rateCitations.map(c => `[${c.source_type}] ${c.source_reference}: "${c.exact_quote}"`).join('\n')}
═══════════════════════════════════════════════════════════════════`);
    }
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

    if (!report.classification_results) {
        return Response.json({ error: 'Classification results missing.' }, { status: 400 });
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // TARIFF-AI 2.0: Build TAX_LEGAL_CONTEXT from retrieved sources
    // ═══════════════════════════════════════════════════════════════════
    console.log('[AgentTax] Building tax legal context from retrieved sources');
    const taxLegalContext = buildTaxLegalContext(report.research_findings, report.classification_results);
    console.log(`[AgentTax] Tax legal context: ${taxLegalContext.length} chars`);
    
    const primaryCode = report.classification_results.primary.hs_code;
    const altCodes = (report.classification_results.alternatives || []).map(a => a.hs_code);
    const codesToCheck = [primaryCode, ...altCodes];

    const kbContext = knowledgeBase ? `
Knowledge Base for ${knowledgeBase.country}:
Tax Method: ${knowledgeBase.tax_method}
Customs Links: ${knowledgeBase.customs_links}
Trade Agreements: ${knowledgeBase.trade_agreements_links}
` : '';

    const context = `
Destination Country: ${report.destination_country}
HS Codes to check: ${codesToCheck.join(', ')}
Product: ${report.product_name}
${kbContext}
`;

    const systemPrompt = `
You are a CUSTOMS TAX EXTRACTION SPECIALIST.

═══════════════════════════════════════════════════════════════════
TARIFF-AI 2.0: RETRIEVE & DEDUCE PROTOCOL FOR TAX DATA
═══════════════════════════════════════════════════════════════════

CRITICAL INSTRUCTION: You have been provided with TAX_LEGAL_CONTEXT containing:
- Retrieved tariff data from official customs sources
- Trade agreement preferential rates
- Country-specific tax information

YOUR EXTRACTION MUST:
1. EXTRACT rates ONLY from the TAX_LEGAL_CONTEXT provided
2. Cite the exact source for each rate
3. If rate not found in context, mark as "NOT_FOUND_IN_CONTEXT" (do NOT estimate)
4. Flag any data gaps clearly

═══════════════════════════════════════════════════════════════════
EXTRACTION TASK:
═══════════════════════════════════════════════════════════════════

For destination country: ${report.destination_country}
For HS Codes: ${codesToCheck.join(', ')}

Extract:
1. DUTY RATE - Must cite source (e.g., "Per TARIC: 0%", "Per Israel Customs Tariff 2025: 12%")
2. VAT RATE - Standard VAT for destination country
3. EXCISE TAX - If applicable for this product category
4. ANTI-DUMPING DUTY - If any applies
5. PREFERENTIAL RATES - From trade agreements if origin qualifies

CITATION FORMAT REQUIRED:
"Rate: [X]% - Source: [Exact source from TAX_LEGAL_CONTEXT]"

If not found:
"Rate: NOT_FOUND_IN_CONTEXT - Requires manual lookup at [suggested source]"

═══════════════════════════════════════════════════════════════════
`;

    const fullPrompt = `${systemPrompt}\n\n${taxLegalContext}\n\nCASE DATA:\n${context}`;

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        response_schema: {
            type: "object",
            properties: {
                tax_data: {
                    type: "object",
                    properties: {
                        primary: {
                            type: "object",
                            properties: {
                                duty_rate: { type: "string", description: "Duty rate with source citation" },
                                duty_rate_source: { type: "string", description: "Exact source from TAX_LEGAL_CONTEXT" },
                                vat_rate: { type: "string", description: "VAT rate with source citation" },
                                vat_rate_source: { type: "string", description: "Exact source for VAT" },
                                excise_taxes: { type: "string", description: "Excise tax if applicable" },
                                anti_dumping_duty: { type: "string", description: "Anti-dumping duty if applicable" },
                                other_fees: { type: "string", description: "Any other fees" }
                            }
                        },
                        preferential_rates: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    trade_agreement: { type: "string" },
                                    preferential_duty: { type: "string" },
                                    origin_requirement: { type: "string" },
                                    source_citation: { type: "string" }
                                }
                            },
                            description: "Preferential rates from trade agreements"
                        },
                        alternatives: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    hs_code: { type: "string" },
                                    duty_rate: { type: "string" },
                                    duty_rate_source: { type: "string" },
                                    vat_rate: { type: "string" }
                                }
                            }
                        },
                        data_gaps: {
                            type: "array",
                            items: { type: "string" },
                            description: "List of rates NOT found in TAX_LEGAL_CONTEXT"
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
    const enrichedTaxData = {
        ...result.tax_data,
        extraction_metadata: {
            legal_context_available: taxLegalContext.length > 100,
            legal_context_chars: taxLegalContext.length,
            extracted_from_retrieved_sources: true
        }
    };
    
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        regulatory_data: {
            ...report.regulatory_data,
            primary: { 
                ...(report.regulatory_data?.primary || {}), 
                ...enrichedTaxData.primary,
                preferential_rates: enrichedTaxData.preferential_rates
            },
            alternatives: enrichedTaxData.alternatives,
            tax_extraction_metadata: enrichedTaxData.extraction_metadata
        },
        // Legacy support
        tariff_description: `Duty: ${enrichedTaxData.primary.duty_rate}, VAT: ${enrichedTaxData.primary.vat_rate}`
    });
    
    return Response.json({ 
        success: true, 
        status: 'tax_extracted', 
        data: enrichedTaxData,
        retrieval_metadata: {
            legal_context_used: taxLegalContext.length > 0,
            extraction_based: true
        }
    });

  } catch (error) {
    console.error('Agent Tax Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});