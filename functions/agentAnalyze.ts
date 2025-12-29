import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Anthropic from 'npm:@anthropic-ai/sdk@^0.18.0';

// --- INLINED GATEWAY LOGIC (ANALYST SPECIFIC) ---

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

async function invokeSpecializedLLM({ prompt, task_type, response_schema, base44_client }) {
  console.log(`[LLM Gateway - Analyst] Using Claude Sonnet 4.5`);
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
        model: "claude-sonnet-4.5",
        max_tokens: 8192, // High context window support
        messages: [{ role: "user", content: fullPrompt }]
    });
    
    const content = msg.content[0].text;
    return response_schema ? cleanJson(content) : content;
  } catch (e) {
     console.error(`[LLM Gateway] Primary strategy failed:`, e.message);
     return await base44_client.integrations.Core.InvokeLLM({
        prompt: fullPrompt,
        response_json_schema: response_schema
    });
  }
}

// --- END INLINED GATEWAY ---

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { reportId } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });
    
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });
    
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'analyzing_data'
    });
    
    // --- Multimodal Extraction & Knowledge Synthesis ---
    
    let aggregatedContext = `
Product Name: ${report.product_name}
Country of Manufacture: ${report.country_of_manufacture}
Destination Country: ${report.destination_country}

User Input (Chat History):
${report.chat_history?.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n') || 'No chat history.'}
`;

    // 1. Process Uploaded Files
    const fileUrls = report.uploaded_file_urls || [];
    if (fileUrls.length > 0) {
        aggregatedContext += "\n--- EXTRACTED FILE DATA ---\n";
        
        // Extract in parallel
        const filePromises = fileUrls.map(async (url, idx) => {
            try {
                // Using ExtractDataFromUploadedFile for all supported types (PDF, CSV, IMG).
                // For DOC/DOCX, if not supported, we might get an error or raw text.
                // We provide a broad schema to capture everything.
                const extraction = await base44.integrations.Core.ExtractDataFromUploadedFile({
                    file_url: url,
                    json_schema: {
                        type: "object",
                        properties: {
                            product_name: { type: "string" },
                            materials: { type: "string" },
                            function_description: { type: "string" },
                            model_number: { type: "string" },
                            full_text_content: { type: "string", description: "The full raw text of the document" }
                        }
                    }
                });
                
                if (extraction.status === 'success' && extraction.output) {
                    return `File ${idx + 1} (${url}):\n${JSON.stringify(extraction.output, null, 2)}`;
                } else {
                    return `File ${idx + 1} (${url}): Extraction failed or format unsupported.`;
                }
            } catch (e) {
                return `File ${idx + 1} (${url}): Error extracting data - ${e.message}`;
            }
        });
        
        const fileResults = await Promise.all(filePromises);
        aggregatedContext += fileResults.join('\n\n');
    }

    // 2. Process External Links (Web Crawling)
    const linkUrls = report.external_link_urls || [];
    if (linkUrls.length > 0) {
        aggregatedContext += "\n--- SCRAPED WEB CONTENT ---\n";
        
        const linkPromises = linkUrls.map(async (url, idx) => {
            try {
                // Using InvokeLLM with internet access to scrape
                const scrapeResult = await base44.integrations.Core.InvokeLLM({
                    prompt: `Visit this URL: ${url}\nExtract technical specifications: Material, Function, State, Essential Character.`,
                    add_context_from_internet: true
                });
                return `Link ${idx + 1} (${url}):\n${scrapeResult}`;
            } catch (e) {
                return `Link ${idx + 1} (${url}): Error scraping - ${e.message}`;
            }
        });

        const linkResults = await Promise.all(linkPromises);
        aggregatedContext += linkResults.join('\n\n');
    }

    const context = aggregatedContext;

    const systemPrompt = `
You are a Forensic Data Gatherer operating under the GRI 1-6 International Framework.
Task: Synthesize all provided data (Chat + Files + Links) to extract precise technical data.

CRITICAL:
- You have access to the CONTENT of attached files and links in the "EXTRACTED FILE DATA" and "SCRAPED WEB CONTENT" sections.
- **NEVER** ask for a file or link if the user has already provided one (e.g., if you see "File 1" data, do not ask "Please attach a file").
- Instead, say: "Analyzing the attached document..." or "Based on the link provided...".
- If the file content is empty or unreadable, explicitly state: "I see a file attached, but could not read its content. Please paste the text or try a different format."

Protocol GRI 1-6 Data Extraction:
1. **Material Composition (GRI 2):** Exact % of materials.
2. **Function (GRI 1):** Mechanical/Electrical function.
3. **State:** Physical state.
4. **Essential Character (GRI 3b):** What defines the item?

Readiness Threshold (Strict 80%):
- Score < 80: 'insufficient_data'. Ask for specific evidence ONLY if not already present.
- Score >= 80: 'success'.

Evidence Request Logic (If score < 80):
- If missing technical data: Ask for "Technical Spec (PDF) or Product Link".
- If missing visual confirmation: Ask for "Label Image or Nameplate Photo".

Form Field Extraction:
- Attempt to extract: 'country_of_manufacture', 'destination_country', 'intended_use'.

Output JSON Schema:
{
  "status": "success" | "insufficient_data",
  "readiness_score": "number (0-100)",
  "assumptions_made": ["string"],
  "missing_info_question": "string",
  "detected_form_fields": {
    "country_of_manufacture": "string (ISO code or name) or null",
    "destination_country": "string or null",
    "intended_use": "string or null"
  },
  "technical_spec": {
    "standardized_name": "string",
    "material_composition": "string",
    "function": "string",
    "state": "string",
    "essential_character": "string"
  },
  "industry_category": "string"
}
`;

    const fullPrompt = `${systemPrompt}\n\nINPUT DATA:\n${context}`;

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        task_type: 'analysis',
        response_schema: {
            type: "object",
            properties: {
                status: { type: "string", enum: ["success", "insufficient_data"] },
                missing_info_question: { type: "string" },
                detected_form_fields: {
                    type: "object",
                    properties: {
                         country_of_manufacture: { type: ["string", "null"] },
                         destination_country: { type: ["string", "null"] },
                         intended_use: { type: ["string", "null"] }
                    }
                },
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

    // Check readiness score logic (Threshold raised to 80)
    const isReady = result.status === 'success' && (result.readiness_score && result.readiness_score >= 80);

    if (!isReady) {
        await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
            status: 'waiting_for_user',
            processing_status: 'waiting_for_user',
            missing_info_question: result.missing_info_question,
            chat_history: [
                ...(report.chat_history || []),
                {
                    role: 'assistant',
                    content: result.missing_info_question,
                    timestamp: new Date().toISOString()
                }
            ]
        });
        return Response.json({ success: true, status: 'waiting_for_user', question: result.missing_info_question });
    } else {
        await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
            processing_status: 'analyzing_completed',
            structural_analysis: result.technical_spec,
            // Store assumptions or other metadata if schema allows, or just log
        });
        return Response.json({ 
            success: true, 
            status: 'analyzing_completed', 
            spec: result.technical_spec,
            readiness: result.readiness_score,
            detected_form_fields: result.detected_form_fields
        });
    }

  } catch (error) {
    console.error('Agent A (Analyst) Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});