import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Anthropic from 'npm:@anthropic-ai/sdk@^0.18.0';

// --- INLINED GATEWAY LOGIC (ANALYST SPECIFIC) ---

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
  console.log(`[LLM Gateway - Analyst] Using Claude Sonnet 4.5`);
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
        model: "claude-sonnet-4.5",
        max_tokens: 8192, // High context window support
        messages: [{ role: "user", content: fullPrompt }]
    });
    
    const content = msg.content[0].text;
    return response_schema ? cleanJson(content) : content;
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
    
    const { reportId } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });
    
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });
    
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'analyzing_data'
    });
    
    const context = `
Product Name: ${report.product_name}
Country of Manufacture: ${report.country_of_manufacture}
Country of Origin: ${report.country_of_origin}
Destination Country: ${report.destination_country}

User Input:
${report.user_input_text || 'No text description provided.'}

Files/Links:
${JSON.stringify(report.uploaded_file_urls || [])}
${JSON.stringify(report.external_link_urls || [])}

Chat History:
${JSON.stringify(report.chat_history || [])}
`;

    const systemPrompt = `
You are a Forensic Data Gatherer operating under the GRI 1-6 International Framework.
Task: Extract precise technical data and potential form fields from the raw input.
DO NOT attempt to classify HS Codes yet. Focus only on the 'What'.

Protocol GRI 1-6 Data Extraction:
1. **Material Composition (GRI 2):** Exact % of materials (e.g., "100% Cotton" or "Steel 80%, Plastic 20%").
2. **Function (GRI 1):** Mechanical/Electrical function (e.g., "Transmits data via Bluetooth").
3. **State:** Physical state (Liquid, Frozen, Assembled, Unassembled).
4. **Essential Character (GRI 3b):** What defines the item? (e.g., "The lens in a camera kit").

Readiness Threshold (Strict 80%):
- Score < 80: 'insufficient_data'. You MUST ask for specific evidence.
- Score >= 80: 'success'.

Evidence Request Logic (If score < 80):
- If missing technical data: Ask for "Technical Spec (PDF) or Product Link".
- If missing visual confirmation: Ask for "Label Image or Nameplate Photo".

Form Field Extraction:
- Attempt to extract: 'country_of_manufacture', 'destination_country', 'intended_use' if explicitly mentioned in the text.

Output JSON Schema:
{
  "status": "success" | "insufficient_data",
  "readiness_score": "number (0-100)",
  "assumptions_made": ["string"],
  "missing_info_question": "string",
  "detected_form_fields": {
    "country_of_manufacture": "string (ISO code or name) or null",
    "destination_country": "string or null",
    "intended_use": "string or null"
  },
  "technical_spec": {
    "standardized_name": "string",
    "material_composition": "string",
    "function": "string",
    "state": "string",
    "essential_character": "string"
  },
  "industry_category": "string"
}
`;

    const fullPrompt = `${systemPrompt}\n\nINPUT DATA:\n${context}`;

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        task_type: 'analysis',
        response_schema: {
            type: "object",
            properties: {
                status: { type: "string", enum: ["success", "insufficient_data"] },
                missing_info_question: { type: "string" },
                detected_form_fields: {
                    type: "object",
                    properties: {
                         country_of_manufacture: { type: ["string", "null"] },
                         destination_country: { type: ["string", "null"] },
                         intended_use: { type: ["string", "null"] }
                    }
                },
                technical_spec: {
                    type: "object",
                    properties: {
                        standardized_name: { type: "string" },
                        material_composition: { type: "string" },
                        function: { type: "string" },
                        state: { type: "string" },
                        essential_character: { type: "string" }
                    }
                },
                industry_category: { type: "string" }
            },
            required: ["status"]
        },
        base44_client: base44
    });

    // Check readiness score logic (Threshold raised to 80)
    const isReady = result.status === 'success' && (result.readiness_score && result.readiness_score >= 80);

    if (!isReady) {
        await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
            status: 'waiting_for_user',
            processing_status: 'waiting_for_user',
            missing_info_question: result.missing_info_question,
            chat_history: [
                ...(report.chat_history || []),
                {
                    role: 'assistant',
                    content: result.missing_info_question,
                    timestamp: new Date().toISOString()
                }
            ]
        });
        return Response.json({ success: true, status: 'waiting_for_user', question: result.missing_info_question });
    } else {
        await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
            processing_status: 'analyzing_completed',
            structural_analysis: result.technical_spec,
            // Store assumptions or other metadata if schema allows, or just log
        });
        return Response.json({ 
            success: true, 
            status: 'analyzing_completed', 
            spec: result.technical_spec,
            readiness: result.readiness_score,
            detected_form_fields: result.detected_form_fields
        });
    }

  } catch (error) {
    console.error('Agent A (Analyst) Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});