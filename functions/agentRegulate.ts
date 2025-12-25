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
You are a Trade Compliance Officer.
Task: Determine Duty Rate, VAT, and Excise Tax for import into [${report.destination_country}] for the provided HS Codes.

Requirements:
1. For EACH of the 3 HS Codes (Primary + Alternatives), determine Duty Rate and VAT.
2. Identify any Import Licensing requirements based on Intended Use.

Output JSON Schema:
{
  "regulatory_data": {
    "primary": {
      "duty_rate": "string (e.g. '0%' or '5.5%')",
      "vat_rate": "string",
      "import_requirements": ["string"]
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
                                import_requirements: { type: "array", items: { type: "string" } }
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