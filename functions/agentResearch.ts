import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import OpenAI from 'npm:openai@^4.28.0';

// --- INLINED GATEWAY LOGIC (RESEARCHER SPECIFIC) ---

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
  console.log(`[LLM Gateway - Researcher] Using Sonar Deep Research`);
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) throw new Error("PERPLEXITY_API_KEY missing");

    // Using raw fetch to access advanced fields (citations, search_results) not always exposed in OpenAI SDK wrapper
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "sonar-deep-research",
            messages: [{ role: "user", content: fullPrompt }],
            // Request citations
            return_citations: true
        })
    });

    if (!response.ok) {
        throw new Error(`Perplexity API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const citations = data.citations || [];
    
    // Parse the JSON content
    let parsedContent = response_schema ? cleanJson(content) : content;
    
    // Inject citations into verified_sources if it's an object and has the field
    if (typeof parsedContent === 'object' && parsedContent.verified_sources && citations.length > 0) {
        // Map citations to the verified_sources structure if strictly strings
        const citationSources = citations.map((url, idx) => ({
            title: `Source ${idx + 1}`,
            url: url,
            date: new Date().toISOString(),
            snippet: "Direct citation from deep research"
        }));
        
        // Merge or replace based on what the model returned
        // We'll append them to ensure we don't lose model-generated context, 
        // but prefer model's structure if it used the URLs.
        // For simplicity/robustness, we'll append if the model didn't return many.
        if (parsedContent.verified_sources.length === 0) {
            parsedContent.verified_sources = citationSources;
        }
    }
    
    return parsedContent;

  } catch (e) {
     console.error(`[LLM Gateway] Primary strategy failed:`, e.message);
     return await base44_client.integrations.Core.InvokeLLM({
        prompt: fullPrompt,
        response_json_schema: response_schema,
        add_context_from_internet: true
    });
  }
}

// --- END INLINED GATEWAY ---

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { reportId, targetLanguage = 'en' } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });
    
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });

    if (!report.structural_analysis) {
        return Response.json({ error: 'Structural analysis missing. Run Agent A first.' }, { status: 400 });
    }
    
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'researching'
    });
    
    const spec = report.structural_analysis;
    const destCountry = report.destination_country;

    // Fetch Official Trade Resources
    const tradeResources = await base44.entities.CountryTradeResource.filter({ country_name: destCountry });
    const resource = tradeResources[0];
    
    const officialLinks = resource ? [
        ...(resource.customs_links || []),
        ...(resource.regulation_links || []),
        ...(resource.trade_agreements_links || []),
        ...(resource.government_links || [])
    ] : [];

    const context = `
Destination Country: ${destCountry}
Current Date: ${new Date().toISOString().split('T')[0]}

COUNTRY TRADE PROFILE (Baseline only - Web Research trumps this):
- Baseline HS Structure: ${resource?.hs_structure || 'Unknown'}
- Regional Agreements: ${resource?.regional_agreements || 'None specified'}
- Tax Method: ${resource?.tax_method || 'CIF (Default)'}

OFFICIAL SOURCE LINKS (PRIORITY 1 - MANDATORY CRAWL):
${officialLinks.length > 0 ? officialLinks.join('\n') : 'No specific official links found in DB.'}

Technical Specification:
- Name: ${spec.standardized_name}
- Material: ${spec.material_composition}
- Function: ${spec.function}
- State: ${spec.state}
- Essential Character: ${spec.essential_character}
`;

    const systemPrompt = `
      You are a Customs Researcher. 
      Task: Intelligence gathering for HS Classification (No final decision).
      Reasoning Effort: HIGH.

      LANGUAGE STRATEGY:
      Target Language: ${targetLanguage === 'he' ? 'HEBREW (עברית)' : 'ENGLISH'}.
      - Perform searches in BOTH English (for international technical data) AND ${targetLanguage === 'he' ? 'Hebrew/Local Language of destination' : 'Local Language of destination'} (for local regulations).
      - Output 'verified_sources' snippets and descriptions in ${targetLanguage === 'he' ? 'HEBREW' : 'ENGLISH'}.
      - Output 'candidate_headings' descriptions in ${targetLanguage === 'he' ? 'HEBREW' : 'ENGLISH'}.

      PROTOCOL - 3-LAYER SEARCH (STRICT ORDER):
1. **Priority 1 (Mandatory Crawl):** ACTIVELY CRAWL the provided "OFFICIAL SOURCE LINKS". You MUST attempt to extract data directly from these URLs first.
2. **Priority 2 (Secondary Search - Regional):** If Priority 1 fails, search specifically for the "Regional Agreements" listed in the profile (e.g., "${resource?.regional_agreements || 'Trade Agreements'}") combined with the product description in Global Trade Databases.
3. **Priority 3 (Fallback):** Open web search is ONLY allowed if Priority 1 & 2 yield zero specific results for the HS Code.

FRESHNESS CONSTRAINT:
- Compare identified rates against today's date (2025).
- **Golden Rule:** If a conflict exists between your training data and the source URL text, the **source URL wins**.
- Explicitly check for recent tax changes (even 1% differences).

Objectives:
1. **Dynamic HS Structure Discovery:** Explicitly research "What is the current HS code structure for import declarations in [${destCountry}] in 2025?". Verify the required digit count (e.g. 8, 10, or 12 digits). If it differs from the Baseline, your finding is the Truth.
2. Find the **2025 Customs Tariff** for [${destCountry}].
3. Search for **Explanatory Notes** and legal exclusions relevant to: ${spec.standardized_name} (${spec.material_composition}).
4. Search for previous rulings or precedents for similar items in ${destCountry} or WCO.
5. Find 3-5 potential HS Headings (4-digit) that might fit.

Output JSON Schema:
{
  "confirmed_hs_structure": "string (e.g., '10 digits' or '8 digits + 3 statistical suffixes')",
  "verified_sources": [
    { "title": "string", "url": "string", "date": "string", "snippet": "string" }
  ],
  "candidate_headings": [
    { "code_4_digit": "string", "description": "string" }
  ],
  "legal_notes_found": ["string"]
}
`;

    const fullPrompt = `${systemPrompt}\n\nDATA TO RESEARCH:\n${context}`;

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        task_type: 'research',
        response_schema: {
            type: "object",
            properties: {
                verified_sources: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            title: { type: "string" },
                            url: { type: "string" },
                            date: { type: "string" },
                            snippet: { type: "string" }
                        }
                    }
                },
                candidate_headings: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            code_4_digit: { type: "string" },
                            description: { type: "string" }
                        }
                    }
                },
                legal_notes_found: {
                    type: "array",
                    items: { type: "string" }
                },
                confirmed_hs_structure: { type: "string" }
            }
        },
        base44_client: base44
    });

    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        processing_status: 'research_completed',
        research_findings: result
    });
    
    return Response.json({ success: true, status: 'research_completed', findings: result });

  } catch (error) {
    console.error('Agent B (Researcher) Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});