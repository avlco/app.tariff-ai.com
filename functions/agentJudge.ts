import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import OpenAI from 'npm:openai@^4.28.0';

// --- INLINED GATEWAY LOGIC (JUDGE SPECIFIC) ---

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
  console.log(`[LLM Gateway - Judge] Using GPT-5.2 (Responses API)`);
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");

    // Using the new /v1/responses endpoint for GPT-5.2 as requested
    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "gpt-5.2-2025-12-11",
            messages: [{ role: "user", content: fullPrompt }],
            // New parameters for GPT-5.2
            reasoning: { effort: "high" },
            text: { verbosity: "high" },
            response_format: response_schema ? { type: "json_object" } : undefined
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI Responses API Error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    // Assuming new response structure is similar or compatible with standard choices
    const content = data.choices ? data.choices[0].message.content : data.output; // Fallback for hypothetical API structure
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
    
    const { reportId, intendedUse, feedback, targetLanguage = 'en', skipResearch = false } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });

    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });

    if (!report.structural_analysis || (!report.research_findings && !skipResearch)) {
        return Response.json({ error: 'Prerequisites missing. Run Agent A & B first.' }, { status: 400 });
    }

    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'classifying_hs'
    });

    const research = report.research_findings || {};

    let context = `
    Product Spec: ${JSON.stringify(report.structural_analysis)}
    Intended Use: ${intendedUse || 'General purpose'}
    Destination Country: ${report.destination_country}
    `;

    if (skipResearch) {
        context += `
    Research Context: Standard consumer good. Use internal knowledge base for classification.
    Confirmed HS Structure: Standard (Follow Country Rules)
    `;
    } else {
        context += `
    Research Findings: ${JSON.stringify(research)}
    Confirmed HS Structure: ${research.confirmed_hs_structure || 'Standard (Follow Country Rules)'}
    `;
    }

    const systemPrompt = `
      You are a Senior Customs Judge.
      Task: Apply GRI 1-6 rules to determine the classification based on the provided technical spec and research.

      LANGUAGE INSTRUCTION:
      - **ANALYSIS PHASE:** Think and analyze in **ENGLISH** to ensure maximum accuracy with WCO standards.
      - **OUTPUT PHASE:** Write the final 'reasoning' and 'rejection_reason' in **${targetLanguage === 'he' ? 'HEBREW (עברית)' : 'ENGLISH'}**.
      - Maintain international technical terms (e.g., chemical names) in English within parentheses.

      METHODOLOGY - GRI APPLICATION (STRICT):
      1. **GRI 1 (Terms of Headings):** Start here. Classification is determined according to the terms of the headings and any relative Section or Chapter Notes.
      2. **GRI 2(a) (Incomplete/Unfinished):** If the product is disassembled or incomplete but has the essential character of the finished article, classify as finished.
      3. **GRI 3(b) (Mixtures/Sets):** If a set or mixture, classify by the component giving the "Essential Character".
      4. **GRI 6:** Apply the same logic to subheadings.

      VERTICAL SPECIFICS:
      - **Chemicals:** If the product is a chemical, you MUST reference the CAS Number if available. If missing, note it.
      - **Parts & Accessories:** Check Section Note 2 to Section XVI. Is it a "part of general use" (e.g., screw, spring)? If so, classify by material. Is it a specialized part? Classify with the machine.
      ${skipResearch ? '- **Simple Goods:** For low complexity items, rely on your internal knowledge base and standard headings.' : ''}

      Requirements:
      1. **Strict HS Code Format:** Digits ONLY (No dots/spaces). Leading zeros allowed. Precision: ${research.confirmed_hs_structure || 'Match Destination Country Standard'}.
      2. **Legal Basis:** You MUST explicitly state which GRI or Section Note was the deciding factor (e.g., "Determined per GRI 3(b) due to essential character...").
      3. **Primary + 2 Alternatives:** Best legal fit + 2 defensible alternatives.

      Output JSON Schema:
      {
        "classification_results": {
          "primary": {
            "hs_code": "string",
            "confidence_score": "number (0-100)",
            "reasoning": "string (in ${targetLanguage})",
            "legal_basis": "string (e.g. 'GRI 1', 'GRI 3(b)', 'Note 2(b) to Section XVI')"
          },
          "alternatives": [
            {
              "hs_code": "string",
              "confidence_score": "number",
              "reasoning": "string (in ${targetLanguage})",
              "rejection_reason": "string (in ${targetLanguage})"
            }
          ]
        }
      }
      `;

    let fullPrompt = `${systemPrompt}\n\nCASE EVIDENCE:\n${context}`;
    
    if (feedback) {
      fullPrompt += `\n\nIMPORTANT - PREVIOUS ATTEMPT FEEDBACK:\nThe QA Auditor rejected the previous classification with these instructions:\n${feedback}\nPlease correct the analysis based on this feedback.`;
    }

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        task_type: 'reasoning',
        response_schema: {
            type: "object",
            properties: {
                classification_results: {
                    type: "object",
                    properties: {
                        primary: {
                            type: "object",
                            properties: {
                                hs_code: { type: "string" },
                                confidence_score: { type: "number" },
                                reasoning: { type: "string" },
                                legal_basis: { type: "string" }
                            }
                        },
                        alternatives: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    hs_code: { type: "string" },
                                    confidence_score: { type: "number" },
                                    reasoning: { type: "string" },
                                    rejection_reason: { type: "string" }
                                }
                            }
                        }
                    }
                }
            }
        },
        base44_client: base44
    });

    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        classification_results: result.classification_results,
        hs_code: result.classification_results.primary.hs_code,
        confidence_score: result.classification_results.primary.confidence_score,
        classification_reasoning: result.classification_results.primary.reasoning,
        ai_analysis_summary: result.classification_results.primary.legal_basis // Storing legal basis in a relevant field or metadata
    });
    
    return Response.json({ success: true, status: 'classification_completed', results: result.classification_results });

  } catch (error) {
    console.error('Agent C (Judge) Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});