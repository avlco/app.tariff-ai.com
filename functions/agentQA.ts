import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Anthropic from 'npm:@anthropic-ai/sdk@^0.18.0';

// --- INLINED GATEWAY LOGIC (QA SPECIFIC) ---

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
  console.log(`[LLM Gateway - QA] Using Claude Opus 4.5`);
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
        model: "claude-opus-4.5",
        max_tokens: 4096,
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
      processing_status: 'qa_pending'
    });
    
    const context = `
REPORT ID: ${reportId}
Technical Spec: ${JSON.stringify(report.structural_analysis)}
Research: ${JSON.stringify(report.research_findings)}
Judge Results: ${JSON.stringify(report.classification_results)}
Regulatory Data: ${JSON.stringify(report.regulatory_data)}
`;

    const systemPrompt = `
You are a Quality Assurance Auditor. Review the entire report.

Checks:
1. Consistency: Does the selected HS Code match the Technical Spec description?
2. Validity: Are research sources dated 2024/2025?
3. Logic: Are taxes calculated for the correct codes?

Scoring & Decision Logic:
- Calculate holistic_score (0-100).
- If CRITICAL logic error found (e.g. code doesn't match product at all): Return status: 'failed', identify faulty_agent (judge/regulator), and provide fix_instructions.
- If Score < 80 but usable: Return status: 'passed' but generate user_explanation why confidence is low.
- If Perfect: Return status: 'passed.

Output JSON Schema:
{
  "qa_audit": {
    "status": "passed" | "failed",
    "score": "number",
    "user_explanation": "string (explanation of score)",
    "faulty_agent": "string (only if failed)",
    "fix_instructions": "string (only if failed)"
  }
}
`;

    const fullPrompt = `${systemPrompt}\n\nFULL REPORT DATA:\n${context}`;

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        task_type: 'reasoning',
        response_schema: {
            type: "object",
            properties: {
                qa_audit: {
                    type: "object",
                    properties: {
                        status: { type: "string", enum: ["passed", "failed"] },
                        score: { type: "number" },
                        user_explanation: { type: "string" },
                        faulty_agent: { type: "string" },
                        fix_instructions: { type: "string" }
                    }
                }
            }
        },
        base44_client: base44
    });

    const audit = result.qa_audit;
    let finalStatus = 'completed';
    let processingStatus = 'completed';

    if (audit.status === 'failed') {
        finalStatus = 'failed';
        processingStatus = 'failed';
    }

    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        qa_audit: audit,
        status: finalStatus,
        processing_status: processingStatus,
        confidence_score: audit.score,
        qa_notes: [audit.user_explanation]
    });
    
    return Response.json({ success: true, status: finalStatus, audit: audit });

  } catch (error) {
    console.error('Agent E (QA) Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});