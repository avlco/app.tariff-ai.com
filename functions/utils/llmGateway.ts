import OpenAI from 'npm:openai@^4.28.0';
import Anthropic from 'npm:@anthropic-ai/sdk@^0.18.0';

/**
 * Clean and parse JSON from LLM output
 */
function cleanJson(text) {
  if (typeof text === 'object') return text;
  
  try {
    return JSON.parse(text);
  } catch (e) {
    // Try to extract from markdown blocks
    const match = text.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e2) {
        // continue
      }
    }
    
    // Try to find first { and last }
    const firstOpen = text.indexOf('{');
    const lastClose = text.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
      try {
        return JSON.parse(text.substring(firstOpen, lastClose + 1));
      } catch (e3) {
        // continue
      }
    }
    throw new Error("Failed to parse JSON response");
  }
}

/**
 * Specialized LLM Gateway
 * Routes tasks to the most appropriate model based on type.
 * 
 * @param {Object} params
 * @param {string} params.prompt - The prompt to send
 * @param {string} params.task_type - 'analysis' | 'research' | 'reasoning' | 'general'
 * @param {Object} params.response_schema - Optional JSON schema for output
 * @param {Object} params.base44_client - Base44 client for fallback
 */
export async function invokeSpecializedLLM({ prompt, task_type, response_schema, base44_client }) {
  console.log(`[LLM Gateway] Processing task: ${task_type}`);
  
  // Append JSON instruction if schema provided
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  
  const fullPrompt = prompt + jsonInstruction;

  try {
    // --- STRATEGY: ANALYSIS (Claude 3.5 Sonnet) ---
    if (task_type === 'analysis') {
        const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
        if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

        const anthropic = new Anthropic({ apiKey });
        const msg = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 4096,
            messages: [{ role: "user", content: fullPrompt }]
        });
        
        const content = msg.content[0].text;
        return response_schema ? cleanJson(content) : content;
    }
    
    // --- STRATEGY: REASONING (OpenAI o1/gpt-4o) ---
    if (task_type === 'reasoning') {
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) throw new Error("OPENAI_API_KEY not set");
        
        const openai = new OpenAI({ apiKey });
        
        try {
            // Attempt o1-preview for superior reasoning
            // Note: o1-preview has rate limits and beta restrictions
             const completion = await openai.chat.completions.create({
                model: "o1-preview", 
                messages: [{ role: "user", content: fullPrompt }]
            });
            const content = completion.choices[0].message.content;
            return response_schema ? cleanJson(content) : content;
        } catch (e) {
            console.warn("[LLM Gateway] o1-preview failed, falling back to gpt-4o", e.message);
            // Fallback to gpt-4o with JSON mode
             const completion = await openai.chat.completions.create({
                model: "gpt-4o", 
                messages: [{ role: "user", content: fullPrompt }],
                response_format: { type: "json_object" }
            });
            const content = completion.choices[0].message.content;
            return response_schema ? cleanJson(content) : content;
        }
    }

    // --- STRATEGY: RESEARCH (Perplexity) ---
    if (task_type === 'research') {
        const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
        
        if (apiKey) {
            const perplexity = new OpenAI({ 
                apiKey, 
                baseURL: 'https://api.perplexity.ai' 
            });
            
            // Perplexity models often require explicit instructions to be chatty or JSON
            const completion = await perplexity.chat.completions.create({
                model: "sonar-reasoning-pro", // High capability online model
                messages: [{ role: "user", content: fullPrompt }]
            });
            const content = completion.choices[0].message.content;
            return response_schema ? cleanJson(content) : content;
        }
        // If no key, throw to trigger Base44 fallback which supports browsing
        throw new Error("Perplexity key missing, triggering fallback");
    }

    // --- STRATEGY: GENERAL (OpenAI gpt-4o) ---
    if (task_type === 'general') {
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) throw new Error("OPENAI_API_KEY not set");

        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: fullPrompt }],
            response_format: response_schema ? { type: "json_object" } : undefined
        });
        const content = completion.choices[0].message.content;
        return response_schema ? cleanJson(content) : content;
    }

    throw new Error(`Unknown task_type: ${task_type}`);

  } catch (error) {
    console.error(`[LLM Gateway] Strategy failed for ${task_type}:`, error.message);
    
    if (!base44_client) throw new Error("Base44 client required for fallback");

    console.log("[LLM Gateway] Engaging Fallback: Base44 Core Integration");
    
    // Fallback uses Base44's built-in GPT-4o integration
    // We enable internet context for research tasks if original strategy failed
    const result = await base44_client.integrations.Core.InvokeLLM({
        prompt: fullPrompt,
        response_json_schema: response_schema,
        add_context_from_internet: task_type === 'research'
    });
    
    return result;
  }
}