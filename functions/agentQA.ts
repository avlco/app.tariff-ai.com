import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { invokeSpecializedLLM } from './utils/llmGateway.js';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { reportId } = await req.json();
    if (!reportId) {
      return Response.json({ error: 'Report ID is required' }, { status: 400 });
    }
    
    // Fetch FULL Report
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }

    // Update status to QA
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'qa_pending'
    });
    
    // Prepare Full Context
    const context = `
REPORT ID: ${reportId}
Technical Spec: ${JSON.stringify(report.structural_analysis)}
Research: ${JSON.stringify(report.research_findings)}
Judge Results: ${JSON.stringify(report.classification_results)}
Regulatory Data: ${JSON.stringify(report.regulatory_data)}
`;

    // System Prompt for Agent E
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

    // Invoke QA (Reasoning - o1/Claude)
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

    // Update DB
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        qa_audit: audit,
        status: finalStatus,
        processing_status: processingStatus,
        // Legacy flat field update
        confidence_score: audit.score,
        qa_notes: [audit.user_explanation]
    });
    
    return Response.json({
        success: true,
        status: finalStatus,
        audit: audit
    });

  } catch (error) {
    console.error('Agent E (QA) Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});