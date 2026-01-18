// 📁 File: functions/agentResearch.ts
// [האפליקציה - app.tariff-ai.com]

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { decrypt } from './utils/encryption.ts'; // ✅ ייבוא מנוע ההצפנה

// --- INLINED GATEWAY LOGIC (RESEARCHER SPECIFIC) ---

function cleanJson(text: any) {
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

async function invokeSpecializedLLM({ prompt, response_schema, base44_client }: any) {
  console.log(`[LLM Gateway - Researcher] Using Sonar Deep Research`);
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) throw new Error("PERPLEXITY_API_KEY missing");

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "sonar-deep-research",
            messages: [{ role: "user", content: fullPrompt }],
            return_citations: true
        })
    });

    if (!response.ok) {
        throw new Error(`Perplexity API Error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const citations = data.citations || [];
    
    let parsedContent = response_schema ? cleanJson(content) : content;
    
    if (typeof parsedContent === 'object' && parsedContent.verified_sources && citations.length > 0) {
        const citationSources = citations.map((url: string, idx: number) => ({
            title: `Source ${idx + 1}`,
            url: url,
            date: new Date().toISOString(),
            snippet: "Direct citation from deep research"
        }));
        if (!parsedContent.verified_sources.length) {
            parsedContent.verified_sources = citationSources;
        }
    }
    
    return parsedContent;

  } catch (e: any) {
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
    
    // 🔐 פענוח שם המוצר (חשוב לדיוק החיפוש)
    const decryptedProductName = await decrypt(report.product_name);

    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'researching'
    });
    
    const spec = report.structural_analysis;
    const destCountry = report.destination_country;

    const countryLangMap: Record<string, string> = {
        'Israel': 'he',
        'USA': 'en', 'United States': 'en', 'UK': 'en', 'United Kingdom': 'en', 'Canada': 'en', 'Australia': 'en',
        'France': 'fr', 'Germany': 'de', 'Spain': 'es', 'Mexico': 'es', 'Argentina': 'es',
        'China': 'zh-CN', 'Japan': 'ja', 'Italy': 'it', 'Brazil': 'pt', 'Portugal': 'pt', 'Russia': 'ru'
    };
    const searchLang = countryLangMap[destCountry] || 'en';

    const tradeResources = await base44.entities.CountryTradeResource.filter({ country_name: destCountry });
    const resource = tradeResources[0];
    
    const officialLinks = resource ? [
        ...(resource.customs_links || []),
        ...(resource.regulation_links || []),
        ...(resource.trade_agreements_links || []),
        ...(resource.government_links || [])
    ] : [];

    // הוספת השם המקורי המפוענח לקונטקסט
    const technicalContext = `
Product (Original Name): ${decryptedProductName}
Product (Standardized): ${spec.standardized_name}
Material: ${spec.material_composition}
Function: ${spec.function}
Links: ${officialLinks.join(', ')}
`;

    // 1. Technical Query
    const technicalPrompt = `
      You are a Customs Technical Researcher.
      Task: Determine the HS Code Structure and Technical Classification possibilities for: ${spec.standardized_name}.
      
      Destination: ${destCountry}
      
      1. Find the current 2024/2025 HS Code Structure for [${destCountry}] (e.g., 8, 10, or 12 digits).
      2. Identify 3-5 Potential WCO Chapters/Headings based on the material: ${spec.material_composition}.
      3. Look for "Explanatory Notes" relevant to this product function: ${spec.function}.
      
      Output JSON Schema:
      {
        "confirmed_hs_structure": "string",
        "candidate_headings": [
            { "code_4_digit": "string", "description": "string" }
        ]
      }
    `;

    // 2. Regulatory Query
    const regulatoryPrompt = `
      You are a Local Customs Researcher.
      Task: Find local regulations, taxes, and legal notes in the local language of ${destCountry}.
      
      Product: ${spec.standardized_name}
      
      SEARCH STRATEGY:
      - Search for import duties, taxes, and restrictions for ${spec.standardized_name} importing into ${destCountry}.
      - **IMPORTANT:** Perform search queries in **${searchLang}** (Language Code) to find official local government sources.
      
      Output JSON Schema:
      {
        "verified_sources": [
            { "title": "string", "url": "string", "date": "string", "snippet": "string" }
        ],
        "legal_notes_found": ["string"]
      }
    `;

    console.log('[Agent B] Starting Hybrid Search Strategy...');
    
    const [technicalResult, regulatoryResult] = await Promise.all([
        invokeSpecializedLLM({
            prompt: technicalPrompt + `\n\nContext:\n${technicalContext}`,
            response_schema: {
                type: "object",
                properties: {
                    confirmed_hs_structure: { type: "string" },
                    candidate_headings: { type: "array", items: { type: "object", properties: { code_4_digit: { type: "string" }, description: { type: "string" } } } }
                }
            },
            base44_client: base44
        }),
        invokeSpecializedLLM({
            prompt: regulatoryPrompt + `\n\nContext:\n${technicalContext}`,
            response_schema: {
                type: "object",
                properties: {
                    verified_sources: { type: "array", items: { type: "object", properties: { title: { type: "string" }, url: { type: "string" }, date: { type: "string" }, snippet: { type: "string" } } } },
                    legal_notes_found: { type: "array", items: { type: "string" } }
                }
            },
            base44_client: base44
        })
    ]);

    const mergedResults = {
        confirmed_hs_structure: technicalResult.confirmed_hs_structure,
        candidate_headings: technicalResult.candidate_headings,
        verified_sources: regulatoryResult.verified_sources,
        legal_notes_found: regulatoryResult.legal_notes_found
    };

    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        processing_status: 'research_completed',
        research_findings: mergedResults
    });
    
    return Response.json({ success: true, status: 'research_completed', findings: mergedResults });

  } catch (error: any) {
    console.error('Agent B (Researcher) Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
