import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { invokeSpecializedLLM } from './utils/llmGateway.ts';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { chat_history } = await req.json();
    const messages = chat_history || [];
    
    const systemPrompt = `
    You are a Trade Compliance Assistant.
    Your Goal: Continuously analyze the conversation to extract 3 mandatory fields:
    1. Product Description (product_name)
    2. Destination Country (destination_country)
    3. Manufacture/Origin Country (origin_country)

    Instructions:
    - Review the ENTIRE history.
    - Extract values only if clearly stated.
    - 'missing_fields': List which of the 3 are still null.
    - 'bot_question': If fields are missing, generate a natural, short follow-up question to ask the user for them.
    - 'ready_to_generate': true only if ALL 3 fields are present.

    Output JSON Schema:
    {
      "extracted": {
        "product_name": "string|null",
        "destination_country": "string|null",
        "origin_country": "string|null"
      },
      "missing_fields": ["string"],
      "ready_to_generate": boolean,
      "bot_question": "string|null"
    }
    `;

    const context = `CHAT HISTORY:\n${JSON.stringify(messages)}`;

    // Use the Gateway (Routes to Gemini 3 Flash Preview)
    const result = await invokeSpecializedLLM({
        prompt: systemPrompt + "\n\n" + context,
        task_type: 'extraction',
        response_schema: {
            extracted: { product_name: "string", destination_country: "string", origin_country: "string" },
            missing_fields: ["string"],
            ready_to_generate: "boolean",
            bot_question: "string"
        },
        base44_client: base44
    });
    
    return Response.json({ success: true, data: result });

  } catch (error) {
    console.error('Agent Extract Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});