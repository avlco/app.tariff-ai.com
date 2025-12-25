import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import OpenAI from 'npm:openai@^4.28.0';
import Anthropic from 'npm:@anthropic-ai/sdk@^0.18.0';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@^0.1.0';

// --- INLINED GATEWAY LOGIC ---

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
 * Supports multi-provider fallbacks.
 */
async function invokeSpecializedLLM({ prompt, task_type, response_schema, base44_client }) {
  console.log(`[LLM Gateway] Processing task: ${task_type}`);
  
  // Append JSON instruction if schema provided
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  
  const fullPrompt = prompt + jsonInstruction;

  try {
    // --- STRATEGY: ANALYSIS ---
    // Primary: Claude 3.5 Sonnet -> Fallback: Gemini 1.5 Pro
    if (task_type === 'analysis') {
        try {
            // 1. Primary: Claude 3.5 Sonnet
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
        } catch (e) {
            console.warn(`[LLM Gateway] Claude failed for analysis, trying Gemini: ${e.message}`);
            
            // 2. Fallback: Gemini 1.5 Pro
            const geminiKey = Deno.env.get('GEMINI_API_KEY');
            if (!geminiKey) throw new Error("GEMINI_API_KEY not set");

            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ 
                model: "gemini-1.5-pro",
                // Gemini supports native JSON enforcement
                generationConfig: response_schema ? { responseMimeType: "application/json" } : undefined
            });
            
            const result = await model.generateContent(fullPrompt);
            const text = result.response.text();
            return response_schema ? cleanJson(text) : text;
        }
    }
    
    // --- STRATEGY: REASONING ---
    // Primary: o1-preview -> Fallback: gpt-4o
    if (task_type === 'reasoning') {
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) throw new Error("OPENAI_API_KEY not set");
        
        const openai = new OpenAI({ apiKey });
        
        try {
             const completion = await openai.chat.completions.create({
                model: "o1-preview", 
                messages: [{ role: "user", content: fullPrompt }]
            });
            const content = completion.choices[0].message.content;
            return response_schema ? cleanJson(content) : content;
        } catch (e) {
            console.warn("[LLM Gateway] o1-preview failed, falling back to gpt-4o", e.message);
             const completion = await openai.chat.completions.create({
                model: "gpt-4o", 
                messages: [{ role: "user", content: fullPrompt }],
                response_format: { type: "json_object" }
            });
            const content = completion.choices[0].message.content;
            return response_schema ? cleanJson(content) : content;
        }
    }

    // --- STRATEGY: RESEARCH ---
    // Primary: Perplexity (Sonar Reasoning)
    if (task_type === 'research') {
        const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
        
        if (apiKey) {
            const perplexity = new OpenAI({ 
                apiKey, 
                baseURL: 'https://api.perplexity.ai' 
            });
            
            const completion = await perplexity.chat.completions.create({
                model: "sonar-reasoning-pro",
                messages: [{ role: "user", content: fullPrompt }]
            });
            const content = completion.choices[0].message.content;
            return response_schema ? cleanJson(content) : content;
        }
        throw new Error("Perplexity key missing, triggering fallback");
    }

    // --- STRATEGY: GENERAL ---
    // Primary: GPT-4o -> Fallback: OpenRouter (Llama 3.1 405b)
    if (task_type === 'general') {
        const openAIKey = Deno.env.get('OPENAI_API_KEY');
        
        try {
            // 1. Primary: GPT-4o
            if (!openAIKey) throw new Error("OPENAI_API_KEY not set");
            
            const openai = new OpenAI({ apiKey: openAIKey });
            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: fullPrompt }],
                response_format: response_schema ? { type: "json_object" } : undefined
            });
            const content = completion.choices[0].message.content;
            return response_schema ? cleanJson(content) : content;
        } catch (e) {
            console.warn(`[LLM Gateway] GPT-4o failed for general, trying OpenRouter: ${e.message}`);
            
            // 2. Fallback: OpenRouter (Llama 3.1 405b)
            const routerKey = Deno.env.get('OPENROUTER_API_KEY');
            if (!routerKey) throw new Error("OPENROUTER_API_KEY not set");

            const openRouter = new OpenAI({
                apiKey: routerKey,
                baseURL: "https://openrouter.ai/api/v1"
            });
            
            const completion = await openRouter.chat.completions.create({
                model: "meta-llama/llama-3.1-405b-instruct",
                messages: [{ role: "user", content: fullPrompt }],
                // Llama 3.1 supports JSON mode via response_format in many providers
                response_format: response_schema ? { type: "json_object" } : undefined
            });
            const content = completion.choices[0].message.content;
            return response_schema ? cleanJson(content) : content;
        }
    }

    throw new Error(`Unknown task_type: ${task_type}`);

  } catch (error) {
    console.error(`[LLM Gateway] All specialized strategies failed for ${task_type}:`, error.message);
    
    if (!base44_client) throw new Error("Base44 client required for fallback");

    console.log("[LLM Gateway] Engaging Final Fallback: Base44 Core Integration");
    
    // Final Fallback: Base44 Core (GPT-4o)
    const result = await base44_client.integrations.Core.InvokeLLM({
        prompt: fullPrompt,
        response_json_schema: response_schema,
        add_context_from_internet: task_type === 'research'
    });
    
    return result;
  }
}

// --- END INLINED GATEWAY ---

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