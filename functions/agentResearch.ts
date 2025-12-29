import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { invokeSpecializedLLM } from './utils/llmGateway.ts';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { reportId, knowledgeBase } = await req.json();
    
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    const spec = report.structural_analysis;

    const systemPrompt = `
You are a Customs Researcher.
Task: Deep web research for HS Classification.
1. Find 2025 Tariff for [${report.destination_country}].
2. Find legal notes for: ${spec.standardized_name}.
3. Find 3-5 potential FULL HS CODES (8-10 digits) in the destination country's tariff.

Output Schema:
{
  "verified_sources": [{ "title": "string", "url": "string", "date": "string", "snippet": "string" }],
  "candidate_headings": [{ "code_4_digit": "string", "description": "string" }],
  "legal_notes_found": ["string"]
}
`;

    const fullPrompt = `${systemPrompt}\n\nPRODUCT:\n${JSON.stringify(spec)}`;

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        task_type: 'research',
        response_schema: {
            verified_sources: [{ title: "string", url: "string", date: "string", snippet: "string" }],
            candidate_headings: [{ code_4_digit: "string", description: "string" }],
            legal_notes_found: ["string"]
        },
        base44_client: base44
    });

    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        research_findings: result,
        processing_status: 'research_completed'
    });
    
    return Response.json({ success: true, findings: result });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});