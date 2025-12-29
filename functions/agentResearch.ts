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
    
    const responseSchema = {
            verified_sources: [{ title: "string", url: "string", date: "string", snippet: "string" }],
            candidate_headings: [{ code_4_digit: "string", description: "string" }],
            legal_notes_found: ["string"]
        };
        
    const jsonInstruction = `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(responseSchema, null, 2)}`;

    // INLINED PERPLEXITY CALL
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) throw new Error("PERPLEXITY_API_KEY not set");
    
    const perplexity = new OpenAI({ apiKey, baseURL: 'https://api.perplexity.ai' });
    const completion = await perplexity.chat.completions.create({
        model: "sonar-deep-research",
        messages: [{ role: "user", content: fullPrompt + jsonInstruction }],
        extra_body: { reasoning_effort: "high" }
    });
    
    const content = completion.choices[0].message.content;
    const result = cleanJson(content);
    // END INLINED CALL

    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        research_findings: result,
        processing_status: 'research_completed'
    });
    
    return Response.json({ success: true, findings: result });

  } catch (error) {
    console.error('Agent Research Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});