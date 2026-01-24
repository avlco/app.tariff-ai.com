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
You are a REGULATORY COMPLIANCE EXPERT specializing in international trade and import requirements.

YOUR MISSION: Find ALL official regulatory requirements for importing this product.

═══════════════════════════════════════════════════════════════════
RESEARCH AREAS - CHECK ALL:
═══════════════════════════════════════════════════════════════════

**1. IMPORT LICENSES & PERMITS**
- Does this product require an import license?
- Which government ministry/agency issues permits?
- Is this a "controlled" or "restricted" item?
- Automatic vs. non-automatic licensing

**2. MANDATORY STANDARDS**
- Local standards (ISO, CE, local standards institute)
- Safety certifications required
- Testing/certification bodies recognized
- Standard numbers (e.g., "SI 900" for Israel, "EN 60950" for EU)

**3. LABELING REQUIREMENTS**
- Language requirements (Hebrew, Arabic, local language)
- Mandatory label content (origin, ingredients, warnings)
- Energy efficiency labels
- Size/placement requirements

**4. HEALTH & SAFETY**
- Food safety certifications (for food products)
- Pharmaceutical approvals (for medical products)
- Cosmetic regulations
- Chemical safety (REACH, etc.)

**5. ENVIRONMENTAL COMPLIANCE**
- RoHS/WEEE (for electronics)
- Packaging regulations
- Recycling requirements
- Carbon footprint declarations

**6. SPECIAL SECTOR REQUIREMENTS**
- Telecom equipment approvals
- Radio frequency certifications
- Encryption regulations
- Dual-use goods controls

**7. PROHIBITED/RESTRICTED ITEMS**
- Outright bans
- Quota restrictions
- Seasonal restrictions
- Country-of-origin restrictions

═══════════════════════════════════════════════════════════════════
OUTPUT: Provide ACTIONABLE requirements with:
- Specific standard/regulation numbers
- Issuing authority
- Verification URLs where possible
═══════════════════════════════════════════════════════════════════
`;

    const fullPrompt = `${systemPrompt}\n\nDATA:\n${context}`;

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
                                    issuing_body: { type: "string" },
                                    verification_url: { type: "string" }
                                }
                            } 
                        },
                        labeling_laws: { type: "array", items: { type: "string" } },
                        prohibitions: { type: "array", items: { type: "string" } },
                        licenses_required: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    license_type: { type: "string" },
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
                                    testing_body: { type: "string" },
                                    validity_period: { type: "string" }
                                }
                            }
                        },
                        import_legality: {
                            type: "string",
                            enum: ["freely_importable", "requires_license", "restricted", "prohibited"],
                            description: "Overall import legality status"
                        }
                    }
                }
            }
        },
        base44_client: base44
    });

    // Merge into regulatory_data with enhanced structure
    const complianceData = result.compliance_data || {};
    
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        regulatory_data: {
            ...(report.regulatory_data || {}),
            primary: {
                ...(report.regulatory_data?.primary || {}),
                import_requirements: complianceData.import_requirements || [],
                standards_requirements: complianceData.mandatory_standards || [],
                import_legality: complianceData.import_legality || 'freely_importable'
            },
            compliance_details: complianceData
        }
    });
    
    return Response.json({ success: true, status: 'compliance_checked', data: complianceData });

  } catch (error) {
    console.error('Agent Compliance Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});