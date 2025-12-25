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
    
    const { reportId, intendedUse } = await req.json();
    if (!reportId) {
      return Response.json({ error: 'Report ID is required' }, { status: 400 });
    }
    
    // Fetch Report
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }

    if (!report.classification_results) {
        return Response.json({ error: 'Classification results missing. Run Agent C first.' }, { status: 400 });
    }
    
    // Update status
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'calculating_duties'
    });
    
    const primaryCode = report.classification_results.primary.hs_code;
    const altCodes = report.classification_results.alternatives.map(a => a.hs_code);
    const codesToCheck = [primaryCode, ...altCodes];

    const context = `
Destination Country: ${report.destination_country}
HS Codes to check: ${codesToCheck.join(', ')}
Intended Use: ${intendedUse || 'General purpose'}
Product: ${report.product_name}
`;

    // System Prompt for Agent D
    const systemPrompt = `
You are a Trade Compliance Officer.
Task: Determine Duty Rate, VAT, and Excise Tax for import into [${report.destination_country}] for the provided HS Codes.

Requirements:
1. For EACH of the 3 HS Codes (Primary + Alternatives), determine Duty Rate and VAT.
2. Identify any Import Licensing requirements based on Intended Use.

Output JSON Schema:
{
  "regulatory_data": {
    "primary": {
      "duty_rate": "string (e.g. '0%' or '5.5%')",
      "vat_rate": "string",
      "import_requirements": ["string"]
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

    let fullPrompt = `${systemPrompt}\n\nDATA:\n${context}`;

    if (feedback) {
      fullPrompt += `\n\nIMPORTANT - PREVIOUS ATTEMPT FEEDBACK:
The QA Auditor rejected the previous calculation with these instructions:
${feedback}
Please correct the calculation based on this feedback.`;
    }

    // Invoke Regulator (General - GPT-4o)
    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        task_type: 'general',
        response_schema: {
            type: "object",
            properties: {
                regulatory_data: {
                    type: "object",
                    properties: {
                        primary: {
                            type: "object",
                            properties: {
                                duty_rate: { type: "string" },
                                vat_rate: { type: "string" },
                                import_requirements: { type: "array", items: { type: "string" } }
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

    // Update DB
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        regulatory_data: result.regulatory_data,
        // Legacy flat field update
        tariff_description: `Duty: ${result.regulatory_data.primary.duty_rate}, VAT: ${result.regulatory_data.primary.vat_rate}`
    });
    
    return Response.json({
        success: true,
        status: 'regulation_completed',
        data: result.regulatory_data
    });

  } catch (error) {
    console.error('Agent D (Regulator) Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});