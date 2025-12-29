import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { invokeSpecializedLLM } from './utils/llmGateway.ts';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { reportId, knowledgeBase } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });
    
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });

    if (!report.classification_results) {
        return Response.json({ error: 'Classification results missing.' }, { status: 400 });
    }
    
    const primaryCode = report.classification_results.primary.hs_code;
    const altCodes = (report.classification_results.alternatives || []).map(a => a.hs_code);
    const codesToCheck = [primaryCode, ...altCodes];

    const kbContext = knowledgeBase ? `
Knowledge Base for ${knowledgeBase.country}:
Tax Method: ${knowledgeBase.tax_method}
Customs Links: ${knowledgeBase.customs_links}
Trade Agreements: ${knowledgeBase.trade_agreements_links}
` : '';

    const context = `
Destination Country: ${report.destination_country}
HS Codes to check: ${codesToCheck.join(', ')}
Product: ${report.product_name}
${kbContext}
`;

    const systemPrompt = `
You are a Tax Specialist.
Task: Calculate import duties and VAT for [${report.destination_country}]. Use the provided HS Code. Cross-reference with the provided Knowledge Base links if available.
You MUST use the browsing tool to visit the provided Customs Links and find the current 2024/2025 duty rates.

Requirements:
1. For EACH of the HS Codes, determine Duty Rate and VAT.
2. Be precise with the rates.

Output JSON Schema:
{
  "tax_data": {
    "primary": {
      "duty_rate": "string",
      "vat_rate": "string"
    },
    "alternatives": [
      {
        "hs_code": "string",
        "duty_rate": "string",
        "vat_rate": "string"
      }
    ]
  }
}
`;

    const fullPrompt = `${systemPrompt}\n\nDATA:\n${context}`;

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        task_type: 'research', // Maps to Sonar Deep Research
        response_schema: {
            type: "object",
            properties: {
                tax_data: {
                    type: "object",
                    properties: {
                        primary: {
                            type: "object",
                            properties: {
                                duty_rate: { type: "string" },
                                vat_rate: { type: "string" }
                            }
                        },
                        alternatives: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    hs_code: { type: "string" },
                                    duty_rate: { type: "string" },
                                    vat_rate: { type: "string" }
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
        regulatory_data: {
            ...report.regulatory_data,
            primary: { ...(report.regulatory_data?.primary || {}), ...result.tax_data.primary },
            alternatives: result.tax_data.alternatives
        },
        tariff_description: `Duty: ${result.tax_data.primary.duty_rate}, VAT: ${result.tax_data.primary.vat_rate}`
    });
    
    return Response.json({ success: true, status: 'tax_calculated', data: result.tax_data });

  } catch (error) {
    console.error('Agent Tax Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});