import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import OpenAI from 'npm:openai@^4.28.0';

// --- INLINED GATEWAY LOGIC (JUDGE SPECIFIC) ---

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
  console.log(`[LLM Gateway - Judge] Using GPT-5.2`);
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [{ role: "user", content: fullPrompt }],
        response_format: response_schema ? { type: "json_object" } : undefined
    });
    
    const content = completion.choices[0].message.content;
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
    
    const { reportId, intendedUse, feedback } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });
    
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });
    
    if (!report.structural_analysis || !report.research_findings) {
        return Response.json({ error: 'Prerequisites missing. Run Agent A & B first.' }, { status: 400 });
    }
    
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'classifying_hs'
    });
    
    const context = `
Product Spec: ${JSON.stringify(report.structural_analysis)}
Research Findings: ${JSON.stringify(report.research_findings)}
Intended Use: ${intendedUse || 'General purpose'}
Destination Country: ${report.destination_country}
`;

    const systemPrompt = `
You are a Senior Customs Judge.
Task: Apply GRI 1-6 rules to determine the classification based on the provided technical spec and research.

Requirements:
1. Determine the Primary Classification (Best legal fit).
2. Determine 2 Viable Alternatives (Legally defensible but less likely).
3. Provide a detailed legal_reasoning citing the provided Research Sources.

Output JSON Schema:
{
  "classification_results": {
    "primary": {
      "hs_code": "string (10 digits if possible, or 6+)",
      "confidence_score": "number (0-100)",
      "reasoning": "string"
    },
    "alternatives": [
      {
        "hs_code": "string",
        "confidence_score": "number",
        "reasoning": "string",
        "rejection_reason": "string"
      }
    ]
  }
}
`;

    let fullPrompt = `${systemPrompt}\n\nCASE EVIDENCE:\n${context}`;
    
    if (feedback) {
      fullPrompt += `\n\nIMPORTANT - PREVIOUS ATTEMPT FEEDBACK:\nThe QA Auditor rejected the previous classification with these instructions:\n${feedback}\nPlease correct the analysis based on this feedback.`;
    }

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        task_type: 'reasoning',
        response_schema: {
            type: "object",
            properties: {
                classification_results: {
                    type: "object",
                    properties: {
                        primary: {
                            type: "object",
                            properties: {
                                hs_code: { type: "string" },
                                confidence_score: { type: "number" },
                                reasoning: { type: "string" }
                            }
                        },
                        alternatives: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    hs_code: { type: "string" },
                                    confidence_score: { type: "number" },
                                    reasoning: { type: "string" },
                                    rejection_reason: { type: "string" }
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
        classification_results: result.classification_results,
        hs_code: result.classification_results.primary.hs_code,
        confidence_score: result.classification_results.primary.confidence_score,
        classification_reasoning: result.classification_results.primary.reasoning
    });
    
    return Response.json({ success: true, status: 'classification_completed', results: result.classification_results });

  } catch (error) {
    console.error('Agent C (Judge) Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});