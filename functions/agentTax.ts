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
    
    if (!report.classification_results) {
        return Response.json({ error: 'Classification results missing.' }, { status: 400 });
    }
    
    const primaryCode = report.classification_results.primary.hs_code;
    const altCodes = (report.classification_results.alternatives || []).map(a => a.hs_code);
    const codesToCheck = [primaryCode, ...altCodes];

    const context = `
Destination Country: ${report.destination_country}
HS Codes to check: ${codesToCheck.join(', ')}
Product: ${report.product_name}
Knowledge Base Links: ${knowledgeBase?.customs_links || 'None'}
`;

    const systemPrompt = `
You are a Tax Specialist.
Task: Calculate import duties and VAT for [${report.destination_country}].
YOU MUST BROWSE THE WEB to find the current 2024/2025 duty rates for the specific HS Codes provided. Do not guess.

Output Schema:
{
  "tax_data": {
    "primary": { "duty_rate": "string", "vat_rate": "string" },
    "alternatives": [{ "hs_code": "string", "duty_rate": "string", "vat_rate": "string" }]
  }
}
`;
    
    const responseSchema = {
            tax_data: {
                primary: { duty_rate: "string", vat_rate: "string" },
                alternatives: [{ hs_code: "string", duty_rate: "string", vat_rate: "string" }]
            }
        };

    const jsonInstruction = `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(responseSchema, null, 2)}`;
    const fullPrompt = `${systemPrompt}\n\nDATA:\n${context}` + jsonInstruction;

    // INLINED PERPLEXITY CALL (TAX)
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) throw new Error("PERPLEXITY_API_KEY not set");
    
    const perplexity = new OpenAI({ apiKey, baseURL: 'https://api.perplexity.ai' });
    const completion = await perplexity.chat.completions.create({
        model: "sonar-deep-research",
        messages: [{ role: "user", content: fullPrompt }],
        extra_body: { reasoning_effort: "high" }
    });
    
    const content = completion.choices[0].message.content;
    const result = cleanJson(content);
    // END INLINED CALL

    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        regulatory_data: {
            ...report.regulatory_data,
            primary: { ...(report.regulatory_data?.primary || {}), ...result.tax_data.primary },
            alternatives: result.tax_data.alternatives
        },
        tariff_description: `Duty: ${result.tax_data.primary.duty_rate}, VAT: ${result.tax_data.primary.vat_rate}`
    });
    
    return Response.json({ success: true, data: result.tax_data });

  } catch (error) {
    console.error('Agent Tax Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});