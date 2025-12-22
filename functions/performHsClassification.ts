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
      processing_status: 'classifying_hs'
    });
    
    // Fetch relevant data from Google Sheets if spreadsheet ID provided
    let sheetData = null;
    if (spreadsheetId) {
      try {
        const sheetResult = await base44.asServiceRole.functions.invoke('fetchGoogleSheetData', {
          spreadsheetId,
          range: 'Database | HS by countries',
          countries: [report.destination_country, report.country_of_origin, report.country_of_manufacture].filter(Boolean)
        });
        sheetData = sheetResult.data;
      } catch (error) {
        console.error('Error fetching sheet data:', error);
      }
    }
    
    // Perform web search for official sources
    const searchQuery = `HS code classification ${report.product_name} ${report.destination_country} customs tariff`;
    const searchResults = await base44.integrations.Core.InvokeLLM({
      prompt: searchQuery,
      add_context_from_internet: true
    });
    
    // Build comprehensive classification prompt
    const classificationPrompt = `
You are an expert customs classification specialist with deep knowledge of the Harmonized System (HS) and General Interpretative Rules (GIR 1-6).

PRODUCT INFORMATION:
- Product Name: ${report.product_name}
- Country of Manufacture: ${report.country_of_manufacture}
- Country of Origin: ${report.country_of_origin}
- Destination Country: ${report.destination_country}
- Product Characteristics: ${JSON.stringify(report.product_characteristics || [])}
- Additional Context: ${report.user_input_text || 'None'}

GOOGLE SHEETS DATA:
${sheetData ? JSON.stringify(sheetData, null, 2) : 'Not available'}

WEB RESEARCH RESULTS:
${searchResults}

TASK:
Apply the General Interpretative Rules (GIR 1-6) to classify this product:
1. GIR 1: Classification by heading text
2. GIR 2: Classification of incomplete/unfinished articles
3. GIR 3: Classification when goods could fall under multiple headings
4. GIR 4: Classification of goods not specified elsewhere
5. GIR 5: Classification of packing materials and containers
6. GIR 6: Classification at subheading level

Provide a detailed classification with:
1. Primary HS Code (with proper structure for destination country)
2. Confidence score (0-100)
3. Detailed reasoning based on GIR analysis
4. Alternative classifications (at least 2) with explanations
5. Official sources used

Return in JSON format.
`;
    
    const classification = await base44.integrations.Core.InvokeLLM({
      prompt: classificationPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          hs_code: { type: "string" },
          confidence_score: { type: "number" },
          classification_reasoning: { type: "string" },
          alternative_classifications: {
            type: "array",
            items: {
              type: "object",
              properties: {
                hs_code: { type: "string" },
                explanation: { type: "string" }
              }
            }
          },
          official_sources: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                url: { type: "string" }
              }
            }
          }
        }
      }
    });
    
    // Update report with classification results
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      hs_code: classification.hs_code,
      confidence_score: classification.confidence_score,
      classification_reasoning: classification.classification_reasoning,
      alternative_classifications: classification.alternative_classifications,
      official_sources: classification.official_sources,
      processing_status: 'calculating_duties'
    });
    
    return Response.json({
      success: true,
      classification,
      message: 'HS classification completed'
    });
    
  } catch (error) {
    console.error('Error performing HS classification:', error);
    
    // Update report status to failed
    if (req.json) {
      const { reportId } = await req.json();
      if (reportId) {
        await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
          processing_status: 'failed',
          status: 'failed'
        });
      }
    }
    
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});