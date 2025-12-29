import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { invokeSpecializedLLM } from './utils/llmGateway.ts';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { reportId, intendedUse, feedback } = await req.json();
    
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    
    if (!report?.structural_analysis || !report?.research_findings) {
        return Response.json({ error: 'Prerequisites missing.' }, { status: 400 });
    }
    
    const context = `
Product Spec: ${JSON.stringify(report.structural_analysis)}
Research Findings: ${JSON.stringify(report.research_findings)}
Intended Use: ${intendedUse || 'General'}
Destination: ${report.destination_country}
`;

    const systemPrompt = `
You are a Senior Customs Judge.
Task: Determine HS Classification based on evidence.
1. Primary Classification (Best fit).
2. 2 Alternatives.
3. Detailed legal reasoning.
4. CRITICAL: You MUST determine the full HS Code (8-10 digits) specific to [${report.destination_country}]. Do not stop at 6 digits.

Output Schema:
{
  "classification_results": {
    "primary": { "hs_code": "string", "confidence_score": 0, "reasoning": "string" },
    "alternatives": [{ "hs_code": "string", "confidence_score": 0, "reasoning": "string", "rejection_reason": "string" }]
  }
}
`;
    
    const fullPrompt = `${systemPrompt}\n\nEVIDENCE:\n${context}` + (feedback ? `\n\nFEEDBACK:\n${feedback}` : "");

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        task_type: 'reasoning',
        response_schema: {
            classification_results: {
                primary: { hs_code: "string", confidence_score: 0, reasoning: "string" },
                alternatives: [{ hs_code: "string", confidence_score: 0, reasoning: "string", rejection_reason: "string" }]
            }
        },
        base44_client: base44
    });

    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        classification_results: result.classification_results,
        hs_code: result.classification_results.primary.hs_code,
        confidence_score: result.classification_results.primary.confidence_score,
        classification_reasoning: result.classification_results.primary.reasoning,
        processing_status: 'classification_completed'
    });
    
    return Response.json({ success: true, results: result.classification_results });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});