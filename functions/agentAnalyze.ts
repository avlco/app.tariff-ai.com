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
  console.log(`[LLM Gateway - Analyst] Using Claude 3.5 Sonnet`);
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 8192,
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
    
    // EXTRACT FORCE PROCEED
    const { reportId, forceProceed } = await req.json();
    
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

User Input:
${report.user_input_text || ''}
`;

    // 1. Prepare Promises for Parallel Execution
    const fileUrls = report.uploaded_file_urls || [];
    const linkUrls = report.external_link_urls || [];
    
    const filePromises = fileUrls.map(async (url, idx) => {
        try {
            // Check for unsupported formats (DOC/DOCX)
            if (url.match(/\.docx?$/i)) {
                return `File ${idx + 1} (${url}): File format requires manual text extraction if unreadable. Treat as attached document.`;
            }

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

    const linkPromises = linkUrls.map(async (url, idx) => {
        try {
            const scrapeResult = await base44.integrations.Core.InvokeLLM({
                prompt: `Visit this URL: ${url}\nExtract technical specifications: Material, Function, State, Essential Character.`,
                add_context_from_internet: true
            });
            return `Link ${idx + 1} (${url}):\n${scrapeResult}`;
        } catch (e) {
            return `Link ${idx + 1} (${url}): Error scraping - ${e.message}`;
        }
    });

    // 2. Execute All Concurrent Operations
    const [fileResults, linkResults] = await Promise.all([
        Promise.all(filePromises),
        Promise.all(linkPromises)
    ]);

    // 3. Construct Context
    if (fileResults.length > 0) {
        aggregatedContext += "\n--- EXTRACTED FILE DATA ---\n" + fileResults.join('\n\n');
    }
    if (linkResults.length > 0) {
        aggregatedContext += "\n--- SCRAPED WEB CONTENT ---\n" + linkResults.join('\n\n');
    }

    const context = aggregatedContext;

    const systemPrompt = `
You are a Forensic Data Gatherer operating under the GRI 1-6 International Framework.
Task: Synthesize all provided data (Chat + Files + Links) to extract precise technical data.

CRITICAL:
- You have access to the CONTENT of attached files and links in the "EXTRACTED FILE DATA" and "SCRAPED WEB CONTENT" sections.
- **NEVER** ask for a file or link if the user has already provided one (e.g., if you see "File 1" data, do not ask "Please attach a file").
- **TRUST VERIFIED DATA:** If you see technical info in "EXTRACTED FILE DATA" or "SCRAPED WEB CONTENT", treat it as Verified ('true') for the GRI Indicators, even if the user didn't type it in chat.
- Instead of asking, say: "Analyzing the attached document..." or "Based on the link provided...".
- If the file content is empty or unreadable (especially .doc/docx), explicitly state: "I see a file attached, but could not read its content. Please paste the text or try a different format."

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

    // --- ONE-SHOT LOGIC UPGRADE ---
    // Detect if user provided clarification in the text (Mandatory Proceed)
    const hasClarification = report.user_input_text && report.user_input_text.includes('[User Clarification]:');

    // Logic: Pass if Score >= 80 OR Force Flag OR User Clarified
    const scorePasses = result.status === 'success' && (result.readiness_score && result.readiness_score >= 80);
    const isReady = scorePasses || (forceProceed === true) || hasClarification;

    if (!isReady) {
        await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
            status: 'waiting_for_user',
            processing_status: 'waiting_for_user',
            missing_info_question: result.missing_info_question,
            country_of_manufacture: result.detected_form_fields?.country_of_manufacture || report.country_of_manufacture,
            destination_country: result.detected_form_fields?.destination_country || report.destination_country
        });
        
        // Email logic remains here...
        if (user.email) {
            try {
                const appUrl = Deno.env.get('PUBLIC_SITE_BASE_URL') || 'https://app.base44.com'; // fallback
                const actionLink = `${appUrl}/reports/clarify?id=${reportId}`;
                
                await base44.integrations.Core.SendEmail({
                    to: user.email,
                    subject: `Action Required: Report #${reportId} pending clarification`,
                    body: `
                        <h2>Expert Clarification Needed</h2>
                        <p>We've analyzed your product data but need a few more details to ensure accurate classification.</p>
                        <p><strong>Missing Information:</strong> ${result.missing_info_question}</p>
                        <p><a href="${actionLink}" style="background-color: #D89C42; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Resolve Issue Now</a></p>
                        <p>Or click here: <a href="${actionLink}">${actionLink}</a></p>
                        <br/>
                        <p>Best regards,<br/>Tariff AI Team</p>
                    `
                });
            } catch (emailErr) {
                console.error("Failed to send notification email:", emailErr);
            }
        }

        return Response.json({ 
            success: true, 
            status: 'waiting_for_user', 
            question: result.missing_info_question
        });
    } else {
        // Proceeding
        let finalSpec = result.technical_spec;
        
        if (hasClarification && !scorePasses) {
            finalSpec.data_quality_note = "Proceeding based on user clarification (Best Effort)";
        } else if (forceProceed && !scorePasses) {
            finalSpec.data_quality_note = "User forced classification despite missing data.";
        }

        await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
            processing_status: 'analyzing_completed',
            structural_analysis: finalSpec
        });
        return Response.json({ 
            success: true, 
            status: 'analyzing_completed', 
            spec: finalSpec,
            readiness: result.readiness_score,
            detected_form_fields: result.detected_form_fields
        });
    }

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});