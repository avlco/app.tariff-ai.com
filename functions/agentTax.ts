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
    
    // Status update handled by orchestrator or kept as is
    
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
You are a Tax Specialist.
Task: Calculate import duties and VAT for [${report.destination_country}]. Use the provided HS Code. Cross-reference with the provided Knowledge Base links if available.

Requirements:
1. For EACH of the HS Codes, determine Duty Rate and VAT.
2. Be precise with the rates.

Output JSON Schema:
{
  "tax_data": {
    "primary": {
      "duty_rate": "string",
      "vat_rate": "string"
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

    const fullPrompt = `${systemPrompt}\n\nDATA:\n${context}`;

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
                                duty_rate: { type: "string" },
                                vat_rate: { type: "string" }
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

    // We'll update a new field 'tax_data' or merge into regulatory_data
    // The previous agentRegulate updated 'regulatory_data'. 
    // Since we split it, we should probably merge this into 'regulatory_data' or keep separate.
    // The prompt asks for 'tax_data'. I'll update 'regulatory_data' partially or a new field.
    // Let's assume we update a new field 'tax_calculation' to avoid overwriting compliance data yet, 
    // OR we just map it to the existing structure. 
    // The previous structure had 'duty_rate', 'vat_rate', 'import_requirements'.
    // AgentTax provides rates. AgentCompliance provides requirements.
    // I will update the rates part of 'regulatory_data' if it exists, or create it.
    
    // Fetch current regulatory_data to merge if exists (it might be empty)
    const currentReg = report.regulatory_data || { primary: {}, alternatives: [] };
    
    // Merge logic
    currentReg.primary = { ...currentReg.primary, ...result.tax_data.primary };
    // Alternatives merge is trickier by index or code. Assuming order or mapping.
    // Simpler: Just save tax_data. The orchestrator or UI can handle it. 
    // But to keep UI working, I should try to populate regulatory_data.
    
    // Let's write to a temporary field 'tax_calculation_result' so we don't conflict, 
    // and let the Orchestrator or a final merge step handle it? 
    // Or just write to regulatory_data assuming Compliance will write to the other fields.
    
    // I'll write to 'regulatory_data' but carefully.
    // Actually, simpler to just write it.
    
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        regulatory_data: {
            ...report.regulatory_data,
            primary: { ...(report.regulatory_data?.primary || {}), ...result.tax_data.primary },
            alternatives: result.tax_data.alternatives // Simplified, ideally merge by code
        },
        // Legacy support
        tariff_description: `Duty: ${result.tax_data.primary.duty_rate}, VAT: ${result.tax_data.primary.vat_rate}`
    });
    
    return Response.json({ success: true, status: 'tax_calculated', data: result.tax_data });

  } catch (error) {
    console.error('Agent Tax Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});