import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { invokeSpecializedLLM } from './utils/llmGateway.ts';

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

    const result = await invokeSpecializedLLM({
        prompt: `${systemPrompt}\n\nDATA:\n${context}`,
        task_type: 'research', // Sonar Deep Research for browsing
        response_schema: {
            tax_data: {
                primary: { duty_rate: "string", vat_rate: "string" },
                alternatives: [{ hs_code: "string", duty_rate: "string", vat_rate: "string" }]
            }
        },
        base44_client: base44
    });

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
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});