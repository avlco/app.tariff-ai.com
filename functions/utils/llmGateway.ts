import OpenAI from 'npm:openai@^4.28.0';

/**
 * Clean and parse JSON from LLM output
 */
function cleanJson(text) {
  if (typeof text === 'object') return text;
  try {
    return JSON.parse(text);
  } catch (e) {
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

/**
 * Specialized LLM Gateway - Updated for Next-Gen Models
 * Uses OpenRouter as the primary backbone for access to GPT-5.2, Gemini 3, etc.
 */
export async function invokeSpecializedLLM({ prompt, task_type, response_schema, base44_client }) {
  console.log(`[LLM Gateway] Processing task: ${task_type}`);
  
  // JSON enforcement
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  
  const fullPrompt = prompt + jsonInstruction;

  // Configuration for OpenRouter
  const routerKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!routerKey) throw new Error("OPENROUTER_API_KEY not set");

  const openRouter = new OpenAI({
      apiKey: routerKey,
      baseURL: "https://openrouter.ai/api/v1"
  });

  let modelId = '';
  // SELECT MODEL BASED ON TASK (Updated Prices & Capabilities)
  switch (task_type) {
      case 'analysis': // Deep Analysis
          // Anthropic Claude Opus 4.5 ($5 input / $25 output) - High Intelligence
          modelId = "anthropic/claude-opus-4.5"; 
          break;
      case 'reasoning': // Complex Logic / HS Code
          // OpenAI GPT-5.2 ($1.75 input / $14 output) - Excellent balance of smarts and price
          modelId = "openai/gpt-5.2"; 
          break;
      case 'research': // Web Search
          // Perplexity Sonar Deep Research ($2 input / $8 output)
          modelId = "perplexity/sonar-deep-research"; 
          break;
      case 'extraction': // Fast processing
      case 'general':
      default:
          // Google Gemini 3 Flash Preview ($0.50 input / $3 output) - Ultra fast & cheap context
          modelId = "google/gemini-3-flash-preview";
          break;
  }

  console.log(`[LLM Gateway] Routing to model: ${modelId}`);

  try {
    const completion = await openRouter.chat.completions.create({
        model: modelId,
        messages: [{ role: "user", content: fullPrompt }],
        // Most new models support JSON mode, but we use safe parsing anyway
        response_format: response_schema ? { type: "json_object" } : undefined
    });

    const content = completion.choices[0].message.content;
    return response_schema ? cleanJson(content) : content;

  } catch (error) {
    console.error(`[LLM Gateway] OpenRouter failed for ${modelId}:`, error.message);
    
    // Fallback to Base44 Core Integration
    if (base44_client) {
        console.log("[LLM Gateway] Engaging Fallback: Base44 Core");
        return await base44_client.integrations.Core.InvokeLLM({
            prompt: fullPrompt,
            response_json_schema: response_schema
        });
    }
    throw error;
  }
}