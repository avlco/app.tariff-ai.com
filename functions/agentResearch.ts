import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import OpenAI from 'npm:openai@^4.28.0';

// --- TARIFF-AI 2.0: RETRIEVE & DEDUCE ARCHITECTURE ---
// This agent now prioritizes targeted retrieval from CountryTradeResource
// over free-form web search. The LLM synthesizes scraped legal text.

import { 
  fetchAllSources, 
  getTariffLookupUrl, 
  getTradeAgreementSources,
  validateCountry,
  getHsCodeStructure 
} from './utils/resourceManager.js';

import { 
  scrapeTargetedUrl, 
  scrapeMultipleUrls,
  scrapeEuTaric,
  scrapeEuBti
} from './utils/webScraper.js';

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

    const perplexity = new OpenAI({ 
        apiKey, 
        baseURL: 'https://api.perplexity.ai' 
    });
    
    const completion = await perplexity.chat.completions.create({
        model: "sonar-deep-research",
        messages: [{ role: "user", content: fullPrompt }]
    });
    const content = completion.choices[0].message.content;
    return response_schema ? cleanJson(content) : content;
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

/**
 * PHASE 0: Retrieve official sources from CountryTradeResource
 * This is the NEW primary data gathering method
 */
async function retrieveOfficialSources(base44, destCountry, spec) {
  console.log(`[AgentResearch] Phase 0: Retrieving official sources for ${destCountry}`);
  
  const results = {
    country_validated: false,
    sources_retrieved: [],
    raw_legal_text: '',
    scrape_errors: []
  };
  
  // Validate country exists in knowledge base
  const countryValidation = await validateCountry(base44, destCountry);
  results.country_validated = countryValidation.valid;
  results.normalized_country = countryValidation.normalized_name;
  results.hs_structure = countryValidation.hs_structure;
  
  if (!countryValidation.valid) {
    console.warn(`[AgentResearch] Country ${destCountry} not found in knowledge base`);
    return results;
  }
  
  // Get all available sources
  const allSources = await fetchAllSources(base44, destCountry);
  
  if (!allSources.success) {
    console.warn(`[AgentResearch] Failed to fetch sources: ${allSources.error}`);
    return results;
  }
  
  results.metadata = allSources.metadata;
  
  // Prepare search options based on product spec
  const scrapeOptions = {
    hsCode: spec.industry_specific_data?.suggested_hs_code || null,
    searchTerms: [
      spec.standardized_name,
      spec.material_composition,
      spec.function
    ].filter(Boolean),
    preserveStructure: true,
    maxLength: 12000
  };
  
  // Scrape customs links (primary priority)
  if (allSources.sources.customs?.length > 0) {
    console.log(`[AgentResearch] Scraping ${allSources.sources.customs.length} customs URLs`);
    const customsResults = await scrapeMultipleUrls(allSources.sources.customs.slice(0, 3), scrapeOptions);
    
    if (customsResults.success) {
      results.sources_retrieved.push(...customsResults.results.filter(r => r.success));
      results.raw_legal_text += customsResults.combined_legal_text || '';
    }
    results.scrape_errors.push(...customsResults.results.filter(r => !r.success).map(r => r.error));
  }
  
  // Scrape trade agreement links
  if (allSources.sources.trade_agreements?.length > 0) {
    console.log(`[AgentResearch] Scraping ${allSources.sources.trade_agreements.length} trade agreement URLs`);
    const ftaResults = await scrapeMultipleUrls(allSources.sources.trade_agreements.slice(0, 2), scrapeOptions);
    
    if (ftaResults.success) {
      results.sources_retrieved.push(...ftaResults.results.filter(r => r.success));
      results.raw_legal_text += '\n\n--- TRADE AGREEMENTS ---\n' + (ftaResults.combined_legal_text || '');
    }
  }
  
  console.log(`[AgentResearch] Retrieved ${results.sources_retrieved.length} sources, ${results.raw_legal_text.length} chars of legal text`);
  
  return results;
}

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { reportId, knowledgeBase } = await req.json();
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
    
    // ═══════════════════════════════════════════════════════════════════
    // TARIFF-AI 2.0: PHASE 0 - Retrieve from CountryTradeResource
    // ═══════════════════════════════════════════════════════════════════
    console.log('[AgentResearch] Starting RETRIEVE & DEDUCE workflow');
    
    const officialSources = await retrieveOfficialSources(base44, destCountry, spec);
    
    // Also scrape standard sources (EU TARIC, BTI) for supplementary data
    const standardSourcesTasks = [
      scrapeEuTaric(spec.industry_specific_data?.suggested_hs_code || '0000'),
      scrapeEuBti(spec.standardized_name || report.product_name)
    ];
    
    const standardResults = await Promise.allSettled(standardSourcesTasks);
    const euTaricResult = standardResults[0].status === 'fulfilled' ? standardResults[0].value : null;
    const euBtiResult = standardResults[1].status === 'fulfilled' ? standardResults[1].value : null;
    
    // Build the LEGAL_TEXT_CORPUS for context injection
    let legalTextCorpus = '';
    
    if (officialSources.raw_legal_text) {
      legalTextCorpus += `\n\n=== OFFICIAL SOURCES (${officialSources.normalized_country || destCountry}) ===\n`;
      legalTextCorpus += officialSources.raw_legal_text;
    }
    
    if (euTaricResult?.success && euTaricResult.raw_excerpt) {
      legalTextCorpus += `\n\n=== EU TARIC DATABASE ===\n`;
      legalTextCorpus += euTaricResult.raw_excerpt;
    }
    
    if (euBtiResult?.success && euBtiResult.raw_excerpt) {
      legalTextCorpus += `\n\n=== EU BTI PRECEDENTS ===\n`;
      legalTextCorpus += euBtiResult.raw_excerpt;
    }
    
    console.log(`[AgentResearch] Total LEGAL_TEXT_CORPUS: ${legalTextCorpus.length} chars`);
    
    const context = `
Destination Country: ${destCountry}
Technical Specification:
- Name: ${spec.standardized_name}
- Material: ${spec.material_composition}
- Function: ${spec.function}
- State: ${spec.state}
- Essential Character: ${spec.essential_character}
`;

    const kbContext = knowledgeBase ? `
Knowledge Base for ${knowledgeBase.country}:
Regulation Links: ${knowledgeBase.regulation_links}
Trade Agreements: ${knowledgeBase.trade_agreements_links}
` : '';

    const systemPrompt = `
You are a CUSTOMS RESEARCH SPECIALIST with access to global trade databases and internet search.

YOUR MISSION: Conduct COMPREHENSIVE intelligence gathering for HS classification.

═══════════════════════════════════════════════════════════════════
RESEARCH PROTOCOL - EXECUTE IN THIS ORDER:
═══════════════════════════════════════════════════════════════════

**PHASE 1: HIERARCHICAL HS STRUCTURE ANALYSIS**

Step 1.1: Identify Potential HS SECTION (1 of 21 sections)
Based on product material/function, which Section(s) apply?
Example: "Machinery and Mechanical Appliances" = Section XVI

Step 1.2: Narrow to CHAPTER (2-digit)
Within identified Section, find 5-8 candidate chapters
Example: Chapter 84 (Machinery), Chapter 85 (Electrical equipment)

Step 1.3: Identify HEADINGS (4-digit)
For each candidate chapter, list 3-5 potential headings
Example: 8471 (ADP machines), 8473 (Parts of ADP), 8517 (Telecom)

Step 1.4: Extract Section and Chapter Notes
For each candidate:
• Section Notes (scope and exclusions)
• Chapter Notes (definitions, special rules)
• Subheading Notes (if applicable)

Format:
"Section XVI Note 2: 'Subject to Note 1 to this Section...parts are classified according to...'"

═══════════════════════════════════════════════════════════════════
**PHASE 2: EXPLANATORY NOTES RESEARCH**
═══════════════════════════════════════════════════════════════════

For top 3-5 candidate headings, you MUST find:

Source: HS 2022 Explanatory Notes (Official WCO Publication)
Search terms: "[Heading number] explanatory notes HS 2022"

Extract:
1. Scope of the heading ("This heading covers...")
2. Explicit inclusions ("This heading includes...")
3. Explicit exclusions ("This heading does not cover...")
4. Classification criteria (numbered lists of requirements)
5. Examples of products covered

Example output:
"Heading 8471 Explanatory Note:
Scope: 'This heading covers automatic data processing machines...'
Criteria: (1) Storing the processing program, (2) Being freely programmed, (3) Performing arithmetical computations, (4) Executing programs with logical decision-making
Inclusions: Portable computers, laptops, notebooks, tablets (if meet criteria)
Exclusions: Simple calculators (8470), Game consoles primarily for gaming (9504)"

═══════════════════════════════════════════════════════════════════
**PHASE 3: WCO CLASSIFICATION OPINIONS & RULINGS**
═══════════════════════════════════════════════════════════════════

Search WCO databases:
• WCO CROSS (Classification References Online Search System)
• WCO HS Committee Classification Decisions
• WCO Classification Opinions

Search terms:
- "[Product type] HS classification WCO"
- "[Heading number] WCO classification opinion"
- "WCO CROSS [product keywords]"

For each ruling found:
• Opinion/Decision number
• Date issued
• Product described
• Classification decided
• Reasoning summary
• Official URL

Priority: Opinions from 2020-2025 (HS 2022 era)

Example:
"WCO Classification Opinion 8471.30/1 (2023-06-15):
Product: Portable computers with integrated wireless communication
Classification: 8471.30 (ADP machines)
Reasoning: Wireless capability is 'incorporated additional function' not affecting primary classification
URL: http://www.wcoomd.org/..."

═══════════════════════════════════════════════════════════════════
**PHASE 4: DESTINATION COUNTRY-SPECIFIC RESEARCH**
═══════════════════════════════════════════════════════════════════

Search for: [${destCountry}] customs classification

Find:
1. National Tariff Schedule (most recent year - 2025 preferred)
   • Full HS code structure (8/10/12 digits)
   • Country-specific subheadings
   • National interpretative notes

2. Customs Authority Rulings Database
   • Advance Rulings
   • Classification precedents
   • Binding Tariff Information (BTI) - for EU
   • Customs Rulings Online Search System (CROSS) - for US

3. Recent Tariff Changes
   • Amendments effective 2024-2025
   • New subheadings or reclassifications

Example for Israel:
"Israel Customs Tariff 2025 - Chapter 84
Source: https://taxes.gov.il/customs/tariff2025
HS Code Structure: 10-digit (XXXX.XX.XX.XX)
8471.30.00.10: Portable ADP machines, weighing ≤2 kg
8471.30.00.90: Other portable ADP machines (residual)
National Note: Gaming laptops classified same as general laptops under .90"

═══════════════════════════════════════════════════════════════════
**PHASE 5: TRADE AGREEMENTS & PREFERENTIAL TREATMENT**
═══════════════════════════════════════════════════════════════════

Identify applicable Free Trade Agreements (FTAs):
Between: [Country of Origin] and [${destCountry}]

Search:
• "[Country A] [${destCountry}] free trade agreement"
• "Preferential tariff ${destCountry}"
• "GSP ${destCountry}" (Generalized System of Preferences)

Document:
• FTA name
• HS codes with preferential rates
• Rules of Origin requirements
• Certificate of Origin needed

Example:
"US-Israel FTA:
HS 8471: Duty-free if 35% value added in Israel
Certificate: Form A required
Source: https://..."

═══════════════════════════════════════════════════════════════════
**PHASE 6: SOURCE QUALITY VALIDATION**
═══════════════════════════════════════════════════════════════════

For EVERY source you cite, verify:

Priority Tier 1 (MOST AUTHORITATIVE):
✓ WCO HS 2022 Explanatory Notes
✓ WCO Classification Opinions/Decisions
✓ Destination country official gazette
✓ Destination country customs authority website

Priority Tier 2 (AUTHORITATIVE):
✓ National tariff schedules (official government)
✓ Advance ruling databases (official)
✓ Court decisions on classification disputes

Priority Tier 3 (REFERENCE ONLY):
• Industry association guidance
• Customs broker articles (if citing official sources)

UNACCEPTABLE SOURCES:
✗ Unverified blogs
✗ Commercial sites without citations
✗ Outdated sources (pre-2020 for HS 2022 questions)

For each source, document:
• Title
• URL
• Publication/Last Updated Date
• Authority level (Tier 1/2/3)
• Relevant excerpt/quote

═══════════════════════════════════════════════════════════════════
CRITICAL: Your research quality determines classification accuracy.
Be thorough. Prioritize official sources. Document everything.
═══════════════════════════════════════════════════════════════════

OUTPUT: Return comprehensive JSON with all research findings.
`;

    const fullPrompt = `${systemPrompt}\n\nDATA TO RESEARCH:\n${context}\n${kbContext}`;

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        task_type: 'research',
        response_schema: {
            type: "object",
            properties: {
                section_identified: {
                    type: "string",
                    description: "HS Section identified (e.g., 'Section XVI: Machinery and Mechanical Appliances')"
                },
                candidate_chapters: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            chapter: {
                                type: "string",
                                description: "2-digit chapter code"
                            },
                            description: {
                                type: "string",
                                description: "Chapter name/description"
                            },
                            likelihood: {
                                type: "string",
                                enum: ["HIGH", "MEDIUM", "LOW"],
                                description: "Likelihood this chapter applies"
                            }
                        }
                    },
                    description: "5-8 candidate chapters identified"
                },
                candidate_headings: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            code_4_digit: {
                                type: "string",
                                description: "4-digit HS heading code"
                            },
                            description: {
                                type: "string",
                                description: "Heading description"
                            },
                            likelihood: {
                                type: "string",
                                enum: ["PRIMARY", "SECONDARY", "TERTIARY"],
                                description: "How likely this heading fits"
                            },
                            explanatory_note_summary: {
                                type: "string",
                                description: "Summary of HS 2022 Explanatory Note for this heading (scope, criteria, inclusions, exclusions)"
                            },
                            section_chapter_notes: {
                                type: "array",
                                items: { type: "string" },
                                description: "Relevant Section/Chapter Notes affecting this heading"
                            }
                        },
                        required: ["code_4_digit", "description", "likelihood"]
                    },
                    description: "3-5 potential headings with EN summaries"
                },
                wco_precedents: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            opinion_number: {
                                type: "string",
                                description: "WCO Opinion/Decision number (e.g., '8471.30/1')"
                            },
                            date: {
                                type: "string",
                                description: "Date issued (YYYY-MM-DD)"
                            },
                            product: {
                                type: "string",
                                description: "Product described in the ruling"
                            },
                            classification: {
                                type: "string",
                                description: "HS code decided"
                            },
                            reasoning: {
                                type: "string",
                                description: "Summary of reasoning"
                            },
                            url: {
                                type: "string",
                                description: "Official URL to the ruling"
                            }
                        }
                    },
                    description: "WCO Classification Opinions and rulings found (if any)"
                },
                country_specific_data: {
                    type: "object",
                    properties: {
                        tariff_year: {
                            type: "string",
                            description: "Year of tariff schedule (e.g., '2025')"
                        },
                        hs_structure: {
                            type: "string",
                            description: "HS code structure for this country (e.g., '10-digit', '8-digit')"
                        },
                        national_codes: {
                            type: "array",
                            items: { type: "string" },
                            description: "Full national-level HS codes found (8-10 digits)"
                        },
                        national_notes: {
                            type: "array",
                            items: { type: "string" },
                            description: "Country-specific notes or interpretations"
                        },
                        official_source: {
                            type: "string",
                            description: "URL to official national tariff schedule"
                        }
                    },
                    description: "Destination country-specific tariff data"
                },
                trade_agreements: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            name: {
                                type: "string",
                                description: "FTA name (e.g., 'US-Israel FTA')"
                            },
                            preferential_rate: {
                                type: "string",
                                description: "Preferential duty rate if applicable"
                            },
                            origin_requirements: {
                                type: "string",
                                description: "Rules of Origin summary"
                            },
                            certificate_needed: {
                                type: "string",
                                description: "Certificate of Origin required (e.g., 'Form A', 'EUR.1')"
                            }
                        }
                    },
                    description: "Trade agreements applicable between origin and destination"
                },
                verified_sources: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            title: {
                                type: "string",
                                description: "Source title"
                            },
                            url: {
                                type: "string",
                                description: "URL"
                            },
                            date: {
                                type: "string",
                                description: "Publication/update date"
                            },
                            authority_tier: {
                                type: "string",
                                enum: ["1", "2", "3"],
                                description: "Authority level: 1=Official WCO/Government, 2=National official, 3=Reference"
                            },
                            snippet: {
                                type: "string",
                                description: "Relevant excerpt"
                            }
                        },
                        required: ["title", "date", "authority_tier"]
                    },
                    description: "All sources cited with quality tier"
                },
                legal_notes_found: {
                    type: "array",
                    items: { type: "string" },
                    description: "Section/Chapter Notes found during research"
                },
                en_exclusions: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            heading: { type: "string" },
                            exclusion_text: { type: "string" },
                            redirect_heading: { type: "string" }
                        }
                    },
                    description: "EN exclusions found that redirect products to other headings"
                },
                bti_cases: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            reference: { type: "string" },
                            country: { type: "string" },
                            hs_code: { type: "string" },
                            product_description: { type: "string" },
                            date: { type: "string" }
                        }
                    },
                    description: "EU BTI cases found for similar products"
                },
                confirmed_hs_structure: {
                    type: "string",
                    description: "Confirmed HS digit structure for destination country (e.g., '10 digits')"
                }
            },
            required: ["candidate_headings", "verified_sources"]
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