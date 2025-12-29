import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import OpenAI from 'npm:openai@^4.28.0';

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
    throw new Error("Failed to parse JSON: " + text.substring(0, 50));
  }
}

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
    const jsonInstruction = `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify({
            classification_results: {
                primary: { hs_code: "string", confidence_score: 0, reasoning: "string" },
                alternatives: [{ hs_code: "string", confidence_score: 0, reasoning: "string", rejection_reason: "string" }]
            }
        }, null, 2)}`;

    // INLINED OPENAI CALL
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");
    
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
        model: "gpt-5.2-2025-12-11", 
        messages: [{ role: "user", content: fullPrompt + jsonInstruction }],
        extra_body: { reasoning_effort: "high" },
        response_format: { type: "json_object" }
    });
    
    const content = completion.choices[0].message.content;
    const result = cleanJson(content);
    // END INLINED CALL

    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        classification_results: result.classification_results,
        hs_code: result.classification_results.primary.hs_code,
        confidence_score: result.classification_results.primary.confidence_score,
        classification_reasoning: result.classification_results.primary.reasoning,
        processing_status: 'classification_completed'
    });
    
    return Response.json({ success: true, results: result.classification_results });

  } catch (error) {
    console.error('Agent Judge Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});