import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@^0.1.0';

// --- INLINED GATEWAY LOGIC (REGULATOR SPECIFIC) ---

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

async function invokeSpecializedLLM({ prompt, task_type, response_schema, base44_client }) {
  console.log(`[LLM Gateway - Regulator] Using Gemini 3 Flash Preview`);
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error("GEMINI_API_KEY not set");

    const genAI = new GoogleGenerativeAI(geminiKey);
    // Raw string model ID, NO config objects
    const model = genAI.getGenerativeModel({ 
        model: "gemini-3-flash-preview"
    });
    
    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();
    return response_schema ? cleanJson(text) : text;
  } catch (e) {
     console.error(`[LLM Gateway] Primary strategy failed:`, e.message);
     return await base44_client.integrations.Core.InvokeLLM({
        prompt: fullPrompt,
        response_json_schema: response_schema
    });
  }
}

// --- END INLINED GATEWAY ---

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { reportId, intendedUse, feedback } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });
    
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });

    // Fetch Country Trade Data for Context
    const tradeResources = await base44.entities.CountryTradeResource.filter({ country_name: report.destination_country });
    const resource = tradeResources[0];

    if (!report.classification_results) {
        return Response.json({ error: 'Classification results missing. Run Agent C first.' }, { status: 400 });
    }
    
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'calculating_duties'
    });
    
    const primaryCode = report.classification_results.primary.hs_code;
    const altCodes = report.classification_results.alternatives.map(a => a.hs_code);
    const codesToCheck = [primaryCode, ...altCodes];

    const context = `
Destination Country: ${report.destination_country}
HS Codes to check: ${codesToCheck.join(', ')}
Intended Use: ${intendedUse || 'General purpose'}
Product: ${report.product_name}
`;

    const systemPrompt = `
You are a Senior Trade Compliance Officer.
Task: Strict Compliance Check & Tax Calculation for import into [${report.destination_country}].

CONTEXT - COUNTRY TRADE DATA & OFFICIAL LINKS:
- Tax Calculation Method: ${resource?.tax_method || 'CIF (Default)'}
- Regional Agreements: ${resource?.regional_agreements || 'None'}
- HS Code Structure: ${resource?.hs_structure || 'Standard'}

OFFICIAL LINKS (Prioritize these sources):
${tradeResources[0]?.customs_links?.join('\n') || ''}
${tradeResources[0]?.regulation_links?.join('\n') || ''}

Requirements:
1. **Tax Calculation (Method: ${resource?.tax_method || 'CIF'}):**
   - If CIF: Formula = (Value + Insurance + Freight) * Rate.
   - If FOB: Formula = (Value) * Rate.
   - You must strictly apply this method in your reasoning.

2. **HS Structure Validation:**
   - Verify the HS Code structure. Input MUST be a clean string of digits (no dots/spaces).
   - If the code provided is shorter than required (e.g., 8 digits needed, 6 provided), you MUST complete it based on local customs books.

3. **Detailed Tax Breakdown (Obligatory Fields):**
   - **Duty Rate:** Exact % for 2025.
   - **VAT:** Specify General VAT vs Import VAT.
   - **Excise Tax:** Check for Purchase Tax/Excise.
   - **Anti-Dumping:** Check for specific duties.
   - **Other Fees:** Check for port fees, levies.

4. **Standards & Legality (WITH PROOF):**
   - **Standards:** Detail ISO, CE, or local standard requirements.
   - **Legality:** Is an Import License required?
   - **Verification URL:** Every requirement MUST have a 'verification_url' pointing to an official source.

3. **Citations:**
   - Every tax rate or regulation MUST be supported by a citation from the extracted links.

Output JSON Schema:
{
  "regulatory_data": {
    "primary": {
      "duty_rate": "string",
      "vat_rate": "string",
      "excise_taxes": "string (e.g. 'Purchase Tax: 15%')",
      "standards_requirements": [
         { "requirement": "string", "verification_url": "string" }
      ],
      "import_legality": "string (e.g. 'Free Import' or 'Requires License')",
      "import_requirements": [
         { "requirement": "string", "verification_url": "string" }
      ]
    },
    "alternatives": [
      {
        "hs_code": "string",
        "duty_rate": "string",
        "vat_rate": "string"
      }
    ]
  }
}
`;

    let fullPrompt = `${systemPrompt}\n\nDATA:\n${context}`;

    if (feedback) {
      fullPrompt += `\n\nIMPORTANT - PREVIOUS ATTEMPT FEEDBACK:\nThe QA Auditor rejected the previous calculation with these instructions:\n${feedback}\nPlease correct the calculation based on this feedback.`;
    }

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        task_type: 'general',
        response_schema: {
            type: "object",
            properties: {
                regulatory_data: {
                    type: "object",
                    properties: {
                        primary: {
                            type: "object",
                            properties: {
                                duty_rate: { type: "string" },
                                vat_rate: { type: "string" },
                                excise_tax: { type: "string" },
                                anti_dumping_duty: { type: "string" },
                                other_fees: { type: "string" },
                                standards_requirements: { 
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            requirement: { type: "string" },
                                            verification_url: { type: "string" }
                                        }
                                    }
                                },
                                import_legality: { type: "string" },
                                import_requirements: { 
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            requirement: { type: "string" },
                                            verification_url: { type: "string" }
                                        }
                                    }
                                }
                            }
                        },
                        alternatives: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    hs_code: { type: "string" },
                                    duty_rate: { type: "string" },
                                    vat_rate: { type: "string" }
                                }
                            }
                        }
                    }
                }
            }
        },
        base44_client: base44
    });

    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        regulatory_data: result.regulatory_data,
        tariff_description: `Duty: ${result.regulatory_data.primary.duty_rate}, VAT: ${result.regulatory_data.primary.vat_rate}`
    });
    
    return Response.json({ success: true, status: 'regulation_completed', data: result.regulatory_data });

  } catch (error) {
    console.error('Agent D (Regulator) Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});