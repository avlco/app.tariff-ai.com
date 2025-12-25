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
    
    const { reportId } = await req.json();
    if (!reportId) {
      return Response.json({ error: 'Report ID is required' }, { status: 400 });
    }
    
    // Fetch Report
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }
    
    // Update status to analyzing
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'analyzing_data'
    });
    
    // Construct Context
    const context = `
Product Name: ${report.product_name}
Country of Manufacture: ${report.country_of_manufacture}
Country of Origin: ${report.country_of_origin}
Destination Country: ${report.destination_country}

User Input:
${report.user_input_text || 'No text description provided.'}

Files/Links:
${JSON.stringify(report.uploaded_file_urls || [])}
${JSON.stringify(report.external_link_urls || [])}

Chat History:
${JSON.stringify(report.chat_history || [])}
`;

    // System Prompt for Agent A
    const systemPrompt = `
You are an expert Forensic Product Analyst.
Task: Analyze the raw user input and create a standardized Technical Specification in English.

Fail Fast Rule: 
If the input is too vague to classify (e.g., 'A box' without material, 'part 54' without function), return status: 'insufficient_data' and generate a specific question for the user in their language (Hebrew or English based on their input) to get the missing critical info.

Output JSON Schema:
{
  "status": "success" | "insufficient_data",
  "missing_info_question": "string (only if insufficient_data)",
  "technical_spec": {
    "standardized_name": "string",
    "material_composition": "string",
    "function": "string",
    "state": "string (e.g., liquid, solid, frozen)",
    "essential_character": "string"
  },
  "industry_category": "string"
}
`;

    const fullPrompt = `${systemPrompt}\n\nINPUT DATA:\n${context}`;

    // Invoke Analyst (Claude/Gemini)
    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        task_type: 'analysis',
        response_schema: {
            type: "object",
            properties: {
                status: { type: "string", enum: ["success", "insufficient_data"] },
                missing_info_question: { type: "string" },
                technical_spec: {
                    type: "object",
                    properties: {
                        standardized_name: { type: "string" },
                        material_composition: { type: "string" },
                        function: { type: "string" },
                        state: { type: "string" },
                        essential_character: { type: "string" }
                    }
                },
                industry_category: { type: "string" }
            },
            required: ["status"]
        },
        base44_client: base44
    });

    // Post-Processing
    if (result.status === 'insufficient_data') {
        await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
            status: 'waiting_for_user',
            processing_status: 'waiting_for_user',
            missing_info_question: result.missing_info_question,
            // We append the question to chat history as assistant message
            chat_history: [
                ...(report.chat_history || []),
                {
                    role: 'assistant',
                    content: result.missing_info_question,
                    timestamp: new Date().toISOString()
                }
            ]
        });
        
        return Response.json({
            success: true,
            status: 'waiting_for_user',
            question: result.missing_info_question
        });
    } else {
        // Success
        await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
            processing_status: 'analyzing_completed',
            structural_analysis: result.technical_spec
        });
        
        return Response.json({
            success: true,
            status: 'analyzing_completed',
            spec: result.technical_spec
        });
    }

  } catch (error) {
    console.error('Agent A (Analyst) Error:', error);
    // Don't fail the whole report yet, let the system handle retries or manual intervention
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});