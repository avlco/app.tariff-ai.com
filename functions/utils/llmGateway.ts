import OpenAI from 'npm:openai';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';
import Anthropic from 'npm:@anthropic-ai/sdk';

// Helper to sanitize JSON response from LLMs
function cleanJson(text) {
  if (typeof text === 'object') return text;
  try { return JSON.parse(text); } catch (e) {
    // Try to extract JSON from code blocks
    const match = text.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (match) { try { return JSON.parse(match[1]); } catch (e2) {} }
    
    // Try to find first { and last }
    const firstOpen = text.indexOf('{');
    const lastClose = text.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
      try { return JSON.parse(text.substring(firstOpen, lastClose + 1)); } catch (e3) {}
    }
    throw new Error("Failed to parse JSON response: " + text.substring(0, 50) + "...");
  }
}

export async function invokeSpecializedLLM({ prompt, task_type, response_schema, base44_client }) {
  console.log(`[LLM Gateway] Processing task '${task_type}'`);
  
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    // 1. EXTRACTION -> Google Gemini 3 Flash
    if (task_type === 'extraction' || task_type === 'general') {
        const apiKey = Deno.env.get('GEMINI_API_KEY');
        if (!apiKey) throw new Error("GEMINI_API_KEY not set");
        
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-3-flash-preview",
            generationConfig: {
                responseMimeType: response_schema ? "application/json" : "text/plain",
                // Dynamic spread to bypass strict typing for new beta features
                ...({ thinking_config: { thinking_level: "MEDIUM" } }) 
            }
        });
        
        const result = await model.generateContent(fullPrompt);
        const text = result.response.text();
        return response_schema ? cleanJson(text) : text;
    }

    // 2. REASONING (JUDGE) -> OpenAI GPT-5.2
    if (task_type === 'reasoning') {
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) throw new Error("OPENAI_API_KEY not set");
        
        const openai = new OpenAI({ apiKey });
        
        // Using Chat Completions (Stable) with specific GPT-5.2 model ID
        const completion = await openai.chat.completions.create({
            model: "gpt-5.2-2025-12-11", 
            messages: [{ role: "user", content: fullPrompt }],
            // Pass new parameters via extra_body
            extra_body: { reasoning_effort: "high" },
            response_format: response_schema ? { type: "json_object" } : undefined
        });
        
        const content = completion.choices[0].message.content;
        return response_schema ? cleanJson(content) : content;
    }

    // 3. ANALYSIS -> Anthropic Claude Opus 4.5
    if (task_type === 'analysis') {
        const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
        if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
        
        const anthropic = new Anthropic({ apiKey });
        const msg = await anthropic.messages.create({
            model: "claude-opus-4-5-20251101", 
            max_tokens: 4096,
            thinking: { type: "enabled", budget_tokens: 4000 },
            messages: [{ role: "user", content: fullPrompt }]
        });
        
        const textBlock = msg.content.find(b => b.type === 'text');
        if (!textBlock) throw new Error("No text content in Claude response");
        return response_schema ? cleanJson(textBlock.text) : textBlock.text;
    }

    // 4. RESEARCH / TAX -> Perplexity Sonar Deep Research
    if (task_type === 'research') {
        const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
        if (!apiKey) throw new Error("PERPLEXITY_API_KEY not set");
        
        const perplexity = new OpenAI({ apiKey, baseURL: 'https://api.perplexity.ai' });
        const completion = await perplexity.chat.completions.create({
            model: "sonar-deep-research",
            messages: [{ role: "user", content: fullPrompt }],
            extra_body: { reasoning_effort: "high" }
        });
        
        const content = completion.choices[0].message.content;
        return response_schema ? cleanJson(content) : content;
    }

    throw new Error(`Unknown task_type: ${task_type}`);

  } catch (error) {
    // Log detailed error for debugging via Base44 logs
    console.error(`[LLM Gateway] Critical Failure for ${task_type}:`, error);
    // Re-throw to ensure the frontend receives the specific error message
    throw new Error(`${error.message} (Provider: ${task_type})`);
  }
}