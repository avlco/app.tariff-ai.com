import OpenAI from 'npm:openai@^4.28.0';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@^0.1.0';
import Anthropic from 'npm:@anthropic-ai/sdk@^0.18.0';

// Helper to sanitize JSON
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
    throw new Error("Failed to parse JSON: " + text.substring(0, 50));
  }
}

export async function invokeSpecializedLLM({ prompt, task_type, response_schema, base44_client }) {
  console.log(`[LLM Gateway] Processing task '${task_type}' via Next-Gen Direct SDK`);
  
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    // 1. EXTRACTION -> Google Gemini 3 Flash (Thinking Level: MEDIUM)
    if (task_type === 'extraction' || task_type === 'general') {
        const apiKey = Deno.env.get('GEMINI_API_KEY');
        if (!apiKey) throw new Error("GEMINI_API_KEY not set");
        
        // Note: Using standard GoogleGenerativeAI SDK but pointing to new model
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-3-flash-preview",
            generationConfig: {
                responseMimeType: response_schema ? "application/json" : "text/plain",
                temperature: 1.0 // Recommended for thinking models
            }
        });
        
        const result = await model.generateContent(fullPrompt);
        return response_schema ? cleanJson(result.response.text()) : result.response.text();
    }

    // 2. REASONING (JUDGE) -> OpenAI GPT-5.2 (Responses API)
    if (task_type === 'reasoning') {
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) throw new Error("OPENAI_API_KEY not set");
        
        const openai = new OpenAI({ apiKey });
        
        // Using the new Responses API structure (client.responses.create)
        if (openai.responses) {
            const response = await openai.responses.create({
                model: "gpt-5", // Maps to GPT-5.2
                input: fullPrompt,
                reasoning: { effort: "high" }, // Deep reasoning for Judge
                text: { verbosity: "medium" }
            });
            return response_schema ? cleanJson(response.output_text) : response.output_text;
        } else {
            // Fallback for older SDK version
            const completion = await openai.chat.completions.create({
                model: "gpt-5", 
                messages: [{ role: "user", content: fullPrompt }],
                reasoning_effort: "high"
            });
            return response_schema ? cleanJson(completion.choices[0].message.content) : completion.choices[0].message.content;
        }
    }

    // 3. ANALYSIS -> Anthropic Claude Opus 4.5 (Extended Thinking)
    if (task_type === 'analysis') {
        const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
        if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
        
        const anthropic = new Anthropic({ apiKey });
        const msg = await anthropic.messages.create({
            model: "claude-opus-4-5-20251101",
            max_tokens: 4096,
            thinking: { type: "enabled", budget_tokens: 4000 }, // Extended Thinking
            messages: [{ role: "user", content: fullPrompt }]
        });
        
        // Content blocks: filter for text
        const textBlock = msg.content.find(b => b.type === 'text');
        return response_schema ? cleanJson(textBlock.text) : textBlock.text;
    }

    // 4. RESEARCH / TAX -> Perplexity Sonar Deep Research (High Reasoning)
    if (task_type === 'research') {
        const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
        if (!apiKey) throw new Error("PERPLEXITY_API_KEY not set");
        
        const perplexity = new OpenAI({ apiKey, baseURL: 'https://api.perplexity.ai' });
        const completion = await perplexity.chat.completions.create({
            model: "sonar-deep-research",
            messages: [{ role: "user", content: fullPrompt }],
            // Use extra body parameters for reasoning_effort
            extra_body: { reasoning_effort: "high" }
        });
        return response_schema ? cleanJson(completion.choices[0].message.content) : completion.choices[0].message.content;
    }

    throw new Error(`Unknown task_type: ${task_type}`);

  } catch (error) {
    console.error(`[LLM Gateway] Direct SDK failed for ${task_type}:`, error.message);
    
    // Fallback to Base44 Core (Safety Net)
    if (base44_client) {
        console.log("[LLM Gateway] Engaging Fallback: Base44 Core");
        const result = await base44_client.integrations.Core.InvokeLLM({
            prompt: fullPrompt,
            response_json_schema: response_schema,
            add_context_from_internet: task_type === 'research'
        });
        if (response_schema && typeof result === 'string') return cleanJson(result);
        return result;
    }
    throw error;
  }
}