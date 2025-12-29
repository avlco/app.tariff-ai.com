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

async function invokeSpecializedLLM({ prompt, task_type, response_schema, base44_client, system_prompt }) {
  console.log(`[LLM Gateway - QA] Using Claude Opus 4.5`);
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  
  // Note: We separate system prompt for caching if provided
  const userPrompt = prompt + jsonInstruction;

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const anthropic = new Anthropic({ apiKey });
    
    // Prepare params with prompt caching if system prompt provided
    const params = {
        model: "claude-opus-4-5-20251101",
        max_tokens: 4096,
        messages: [{ role: "user", content: userPrompt }]
    };

    if (system_prompt) {
        params.system = [
            {
                type: "text",
                text: system_prompt,
                cache_control: { type: "ephemeral" }
            }
        ];
    }

    const msg = await anthropic.messages.create(params);
    
    const content = msg.content[0].text;
    return response_schema ? cleanJson(content) : content;
  } catch (e) {
     console.error(`[LLM Gateway] Primary strategy failed:`, e.message);
     // Fallback generally doesn't support complex system prompt caching logic, so we concatenate
     return await base44_client.integrations.Core.InvokeLLM({
        prompt: (system_prompt ? system_prompt + "\n\n" : "") + userPrompt,
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

    // Fetch Country Trade Data for Context (Single Source of Truth)
    const tradeResources = await base44.entities.CountryTradeResource.filter({ country_name: report.destination_country });
    const resource = tradeResources[0];

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
You are a Regulatory Auditor (Expert System QA).
Your Goal: Ensure the report adheres to the Single Source of Truth (CountryTradeResource).

OFFICIAL LINKS (For Cross-Referencing):
${resource?.customs_links?.join('\n') || 'None'}
${resource?.regulation_links?.join('\n') || 'None'}

Auditing Protocol:
1. **Source Matching:** Compare the rates in 'Regulatory Data' against the text in the provided OFFICIAL LINKS.
2. **HS Structure Check:** The HS Code MUST match the structure: "${resource?.hs_structure || 'Standard'}". If it differs in digit count (e.g. 6 instead of 10), REJECT IT.
3. **Tax Accuracy:** Verify if the calculated Duty/VAT matches the official tariff for 2025.
4. **Citation Check:** Every standard or regulation MUST have a URL citation.

Rejection Criteria (Immediate Fail):
- Tax rate mismatch with official source.
- HS Code structure invalid.
- Missing URL for a claimed standard.

Scoring & Decision Logic:
- Calculate holistic_score (0-100).
- If any Rejection Criteria is met: Return status: 'failed', set score < 50, identify faulty_agent, and provide specific fix instructions (e.g., "Correct HS Code to 10 digits").
- If Score < 80 but usable: Return status: 'passed' but warn user.
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

    // Pass system prompt separately for caching
    const result = await invokeSpecializedLLM({
        prompt: `FULL REPORT DATA:\n${context}`,
        system_prompt: systemPrompt, // Passing system prompt for caching
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

    // If QA fails, we DO NOT mark as failed immediately.
    // We keep it as 'qa_pending' (or 'processing') so the Self-Healing loop in startClassification can run.
    // startClassification will mark it as 'failed' only if it exhausts retries.
    if (audit.status === 'failed') {
        finalStatus = 'processing'; 
        processingStatus = 'qa_pending'; // Keep it in a pending state for UI
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