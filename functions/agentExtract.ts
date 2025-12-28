import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@^0.1.0';

// --- INLINED GATEWAY LOGIC (EXTRACTOR - GEMINI) ---

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
    throw new Error("Failed to parse JSON response");
  }
}

async function invokeSpecializedLLM({ prompt, base44_client }) {
  console.log(`[LLM Gateway - Extractor] Using Gemini 3 Flash Preview`);
  
  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error("GEMINI_API_KEY not set");

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-3-flash-preview",
        generationConfig: { responseMimeType: "application/json" }
    });
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return cleanJson(text);
  } catch (e) {
     console.error(`[LLM Gateway] Primary strategy failed:`, e.message);
     // Fallback to Base44 Core
     return await base44_client.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: { type: "object", additionalProperties: true }
    });
  }
}

// --- END INLINED GATEWAY ---

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { chat_history, file_contents } = await req.json();
    
    if (!chat_history || !Array.isArray(chat_history)) {
        return Response.json({ error: 'chat_history array is required' }, { status: 400 });
    }

    const context = `
Chat History:
${JSON.stringify(chat_history)}

File Contents (Optional):
${JSON.stringify(file_contents || [])}
`;

    const systemPrompt = `
You are a Conversation Analyst.
Task: Analyze the conversation. Extract the current state of: origin_country, destination_country, manufacture_country, product_name. Identify if critical info is missing.

Requirements:
1. Extract values if clearly stated or inferred with high confidence.
2. If a value is unknown, set to null.
3. Identify missing critical info (e.g. "Missing destination country").
4. 'ready_to_generate' is true ONLY if product_name and destination_country are present.

Output JSON Schema:
{
  "extracted": {
    "origin_country": "string|null",
    "destination_country": "string|null",
    "manufacture_country": "string|null",
    "product_name": "string|null"
  },
  "missing_info": ["string"],
  "ready_to_generate": boolean
}
`;

    const fullPrompt = `${systemPrompt}\n\nCONVERSATION:\n${context}`;

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        base44_client: base44
    });
    
    return Response.json({ success: true, data: result });

  } catch (error) {
    console.error('Agent Extract Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});