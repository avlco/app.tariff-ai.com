import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
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
    
    // Get the report
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }
    
    // Process chat history to extract key information
    const chatSummary = report.chat_history && report.chat_history.length > 0
      ? report.chat_history.map(msg => `${msg.role}: ${msg.content}`).join('\n')
      : 'No additional chat information provided';
    
    // Get current date for LLM context
    const today = new Date().toISOString().split('T')[0];
    
    // Analyze chat and extract insights using LLM
    const analysisPrompt = `
CURRENT DATE: ${today}

You are an expert in product analysis for customs classification. 
Analyze the following product information and extract key details:

Product Name: ${report.product_name}
Country of Manufacture: ${report.country_of_manufacture}
Country of Origin: ${report.country_of_origin}
Destination Country: ${report.destination_country}

Chat History:
${chatSummary}

Extract and return the following in JSON format:
- product_characteristics: Array of key product features and materials
- additional_details: Any other relevant information for HS classification
- user_intent: What the user wants to achieve with this classification
`;
    
    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt: analysisPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          product_characteristics: {
            type: "array",
            items: { type: "string" }
          },
          additional_details: { type: "string" },
          user_intent: { type: "string" }
        }
      }
    });
    
    // Update report with initial analysis
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'analyzing_data',
      product_characteristics: analysis.product_characteristics,
      user_input_text: `${chatSummary}\n\nAdditional Details: ${analysis.additional_details}`
    });
    
    return Response.json({
      success: true,
      analysis,
      message: 'Initial processing completed'
    });
    
  } catch (error) {
    console.error('Error initializing report processing:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});