import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { reportId, spreadsheetId } = await req.json();
    
    if (!reportId) {
      return Response.json({ error: 'Report ID is required' }, { status: 400 });
    }
    
    // Get the report
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }
    
    // Update status
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'checking_regulations'
    });
    
    // Fetch tariff data from Google Sheets if available
    let tariffData = null;
    if (spreadsheetId) {
      try {
        const sheetResult = await base44.asServiceRole.functions.invoke('fetchGoogleSheetData', {
          spreadsheetId,
          range: 'Database | HS by countries',
          countries: [report.destination_country]
        });
        tariffData = sheetResult.data;
      } catch (error) {
        console.error('Error fetching tariff data:', error);
      }
    }
    
    // Research duties and regulations
    const dutiesPrompt = `
You are a customs duty and regulation expert.

PRODUCT CLASSIFICATION:
- HS Code: ${report.hs_code}
- Product: ${report.product_name}
- Origin: ${report.country_of_origin}
- Destination: ${report.destination_country}

TARIFF DATABASE:
${tariffData ? JSON.stringify(tariffData, null, 2) : 'Not available'}

TASK:
Research and provide detailed information about:
1. Import duties and tariff rates for this HS code
2. VAT/GST rates applicable
3. Any special regulations or restrictions
4. Required import documentation and certifications
5. Regulatory compliance requirements
6. Any trade agreements that might affect duties

Return comprehensive information in JSON format.
`;
    
    const dutiesInfo = await base44.integrations.Core.InvokeLLM({
      prompt: dutiesPrompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          tariff_description: { type: "string" },
          import_requirements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" }
              }
            }
          },
          duty_rate: { type: "string" },
          vat_rate: { type: "string" },
          additional_notes: { type: "string" }
        }
      }
    });
    
    // Update report with duties and regulations
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      tariff_description: dutiesInfo.tariff_description,
      import_requirements: dutiesInfo.import_requirements,
      processing_status: 'generating_report'
    });
    
    return Response.json({
      success: true,
      dutiesInfo,
      message: 'Duties and regulations calculated'
    });
    
  } catch (error) {
    console.error('Error calculating duties:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});