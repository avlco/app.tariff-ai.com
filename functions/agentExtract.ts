import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// --- INLINED LLM CLIENT (GEMINI SPECIFIC) ---
async function callGeminiExtract(messages: any[]) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const systemPrompt = `
    You are a Trade Compliance Assistant.
    Goal: Continuously analyze conversation to extract 3 mandatory fields:
    1. Product Description (product_name)
    2. Destination Country (destination_country)
    3. Manufacture/Origin Country (origin_country)

    Instructions:
    - Review ENTIRE history.
    - Extract values only if clearly stated.
    - 'missing_fields': List which of the 3 are still null.
    - 'bot_question': If missing, ask for them specifically.
    - 'ready_to_generate': true only if ALL 3 present.

    Output Schema:
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

  // Construct the prompt for Gemini REST API
  const context = `CHAT HISTORY:\n${JSON.stringify(messages)}`;
  const fullPrompt = `${systemPrompt}\n\n${context}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2
          }
      })
  });

  if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!rawText) throw new Error("Empty response from Gemini");

  try {
      return JSON.parse(rawText);
  } catch (e) {
      // Cleanup markdown if present
      const match = rawText.match(/```(?:json)?\n([\s\S]*?)\n```/);
      if (match) return JSON.parse(match[1]);
      throw new Error("Failed to parse JSON from Gemini");
  }
}
// --- END INLINED CLIENT ---

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { chat_history } = await req.json();
    
    // Call the inlined Gemini function directly
    const result = await callGeminiExtract(chat_history || []);
    
    return Response.json({ success: true, data: result });

  } catch (error) {
    console.error('Agent Extract Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});