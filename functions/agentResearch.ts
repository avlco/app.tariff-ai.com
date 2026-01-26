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
  scrapeEuBti,
  scrapeWithDepth,
  classifySourceAuthority,
  filterSourcesByTier,
  extractRelevantContextWithLLM,
  extractStructuredEN,
  checkENExclusionConflicts
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
 * TARIFF-AI 2.0 FIX: This function now ACTUALLY scrapes URLs using webScraper utilities
 * instead of relying on LLM to generate fake data.
 */
async function retrieveOfficialSources(base44, destCountry, spec, options = {}) {
  const { expandSearch = false, focusAreas = null } = options;
  
  console.log(`[AgentResearch] ═══════════════════════════════════════════`);
  console.log(`[AgentResearch] Phase 0: REAL RETRIEVAL for ${destCountry}${expandSearch ? ' (EXPAND MODE)' : ''}`);
  
  const results = {
    country_validated: false,
    sources_retrieved: [],
    raw_legal_text: '',
    scrape_errors: [],
    scrape_successes: 0,
    scrape_failures: 0
  };
  
  // Validate country exists in knowledge base
  let countryValidation = { valid: false };
  try {
    countryValidation = await validateCountry(base44, destCountry);
  } catch (e) {
    console.warn(`[AgentResearch] Country validation failed: ${e.message}`);
  }
  
  results.country_validated = countryValidation.valid;
  results.normalized_country = countryValidation.normalized_name || destCountry;
  results.hs_structure = countryValidation.hs_structure;
  
  // Get suggested HS code from spec
  const suggestedHsCode = spec?.industry_specific_data?.suggested_hs_code || 
                          spec?.suggested_hs_code || 
                          null;
  
  // Prepare search options based on product spec
  const baseSearchTerms = [
    spec?.standardized_name,
    spec?.material_composition,
    spec?.function
  ].filter(Boolean);
  
  const focusSearchTerms = focusAreas 
    ? focusAreas.split(';').map(s => s.trim()).filter(Boolean)
    : [];
  
  const scrapeOptions = {
    hsCode: suggestedHsCode,
    searchTerms: [...baseSearchTerms, ...focusSearchTerms],
    preserveStructure: true,
    maxLength: expandSearch ? 20000 : 12000,
    maxDepth: expandSearch ? 2 : 0,
    maxLinks: expandSearch ? 3 : 0,
    useCache: true
  };
  
  console.log(`[AgentResearch] Search terms: ${scrapeOptions.searchTerms.join(', ')}`);
  console.log(`[AgentResearch] HS Code hint: ${suggestedHsCode || 'none'}`);
  
  // === STEP 1: Try CountryTradeResource sources first ===
  if (countryValidation.valid) {
    try {
      const allSources = await fetchAllSources(base44, destCountry);
      
      if (allSources.success) {
        results.metadata = allSources.metadata;
        
        // Scrape customs links (primary priority)
        if (allSources.sources.customs?.length > 0) {
          const customsUrls = allSources.sources.customs.slice(0, expandSearch ? 5 : 3);
          console.log(`[AgentResearch] Scraping ${customsUrls.length} customs URLs from CountryTradeResource`);
          
          if (expandSearch && scrapeOptions.maxDepth > 0) {
            for (const url of customsUrls) {
              try {
                const deepResult = await scrapeWithDepth(url, scrapeOptions);
                if (deepResult.success && deepResult.raw_legal_text) {
                  results.sources_retrieved.push({
                    ...deepResult,
                    authority_tier: classifySourceAuthority(url),
                    source_type: 'customs_kb'
                  });
                  results.raw_legal_text += `\n\n=== SOURCE: ${url} ===\n${deepResult.raw_legal_text}`;
                  results.scrape_successes++;
                  console.log(`[AgentResearch] ✓ Deep scraped: ${url.substring(0, 50)}... (${deepResult.raw_legal_text?.length || 0} chars)`);
                } else {
                  results.scrape_errors.push({ url, error: deepResult.error || 'No content' });
                  results.scrape_failures++;
                }
              } catch (e) {
                results.scrape_errors.push({ url, error: e.message });
                results.scrape_failures++;
              }
            }
          } else {
            try {
              const customsResults = await scrapeMultipleUrls(customsUrls, scrapeOptions);
              if (customsResults.success) {
                results.sources_retrieved.push(...customsResults.results.filter(r => r.success).map(r => ({
                  ...r,
                  authority_tier: classifySourceAuthority(r.url),
                  source_type: 'customs_kb'
                })));
                results.raw_legal_text += customsResults.combined_legal_text || '';
                results.scrape_successes += customsResults.successful || 0;
                results.scrape_failures += customsResults.failed || 0;
              }
            } catch (e) {
              console.warn(`[AgentResearch] Customs scraping failed: ${e.message}`);
            }
          }
        }
        
        // Scrape trade agreement links
        if (allSources.sources.trade_agreements?.length > 0) {
          try {
            const ftaUrls = allSources.sources.trade_agreements.slice(0, 2);
            console.log(`[AgentResearch] Scraping ${ftaUrls.length} trade agreement URLs`);
            const ftaResults = await scrapeMultipleUrls(ftaUrls, scrapeOptions);
            
            if (ftaResults.success) {
              results.sources_retrieved.push(...ftaResults.results.filter(r => r.success).map(r => ({
                ...r,
                source_type: 'trade_agreement'
              })));
              results.raw_legal_text += '\n\n=== TRADE AGREEMENTS ===\n' + (ftaResults.combined_legal_text || '');
              results.scrape_successes += ftaResults.successful || 0;
            }
          } catch (e) {
            console.warn(`[AgentResearch] Trade agreement scraping failed: ${e.message}`);
          }
        }
      }
    } catch (e) {
      console.warn(`[AgentResearch] CountryTradeResource fetch failed: ${e.message}`);
    }
  }
  
  // === STEP 2: ALWAYS scrape standard international sources ===
  // This ensures we get REAL data even if CountryTradeResource is empty
  console.log(`[AgentResearch] Scraping standard international sources...`);
  
  // EU TARIC (always relevant for international trade)
  if (suggestedHsCode) {
    try {
      const taricResult = await scrapeEuTaric(suggestedHsCode);
      if (taricResult.success && taricResult.raw_excerpt) {
        results.sources_retrieved.push({
          ...taricResult,
          authority_tier: '1',
          source_type: 'eu_taric'
        });
        results.raw_legal_text += `\n\n=== EU TARIC DATABASE (HS ${suggestedHsCode}) ===\n${taricResult.raw_excerpt}`;
        results.scrape_successes++;
        console.log(`[AgentResearch] ✓ EU TARIC: ${taricResult.raw_excerpt?.length || 0} chars`);
      }
    } catch (e) {
      console.warn(`[AgentResearch] EU TARIC scrape failed: ${e.message}`);
      results.scrape_failures++;
    }
  }
  
  // EU BTI (precedent search)
  const productName = spec?.standardized_name || baseSearchTerms[0];
  if (productName) {
    try {
      const btiResult = await scrapeEuBti(productName, suggestedHsCode);
      if (btiResult.success && (btiResult.raw_excerpt || btiResult.bti_references?.length > 0)) {
        results.sources_retrieved.push({
          ...btiResult,
          authority_tier: '1',
          source_type: 'eu_bti'
        });
        if (btiResult.raw_excerpt) {
          results.raw_legal_text += `\n\n=== EU BTI PRECEDENTS ===\n${btiResult.raw_excerpt}`;
        }
        results.scrape_successes++;
        console.log(`[AgentResearch] ✓ EU BTI: ${btiResult.bti_references?.length || 0} references found`);
      }
    } catch (e) {
      console.warn(`[AgentResearch] EU BTI scrape failed: ${e.message}`);
      results.scrape_failures++;
    }
  }
  
  // Explanatory Notes search
  if (suggestedHsCode && productName) {
    try {
      const enResult = await searchExplanatoryNotes(suggestedHsCode, productName);
      if (enResult.success && enResult.results?.length > 0) {
        const enText = enResult.results.map(r => 
          `Source: ${r.source_url}\n${r.en_excerpts?.join('\n') || ''}`
        ).join('\n\n');
        
        results.sources_retrieved.push({
          ...enResult,
          authority_tier: '2',
          source_type: 'explanatory_notes'
        });
        results.raw_legal_text += `\n\n=== EXPLANATORY NOTES ===\n${enText}`;
        results.scrape_successes++;
        console.log(`[AgentResearch] ✓ EN Search: ${enResult.results.length} sources`);
      }
    } catch (e) {
      console.warn(`[AgentResearch] EN search failed: ${e.message}`);
    }
  }
  
  // === STEP 3: Country-specific scraping ===
  const destLower = destCountry?.toLowerCase() || '';
  
  if (destLower.includes('israel') || destLower.includes('ישראל')) {
    if (suggestedHsCode) {
      try {
        const israelResult = await scrapeIsraelCustoms(suggestedHsCode);
        if (israelResult.success && israelResult.raw_excerpt) {
          results.sources_retrieved.push({
            ...israelResult,
            authority_tier: '1',
            source_type: 'israel_customs'
          });
          results.raw_legal_text += `\n\n=== ISRAEL CUSTOMS (Shaar Olami) ===\n${israelResult.raw_excerpt}`;
          results.scrape_successes++;
          console.log(`[AgentResearch] ✓ Israel Customs: ${israelResult.raw_excerpt?.length || 0} chars`);
        }
      } catch (e) {
        console.warn(`[AgentResearch] Israel Customs scrape failed: ${e.message}`);
      }
    }
  }
  
  if (destLower.includes('us') || destLower.includes('united states') || destLower.includes('america')) {
    if (suggestedHsCode) {
      try {
        const usResult = await scrapeUsHtsus(suggestedHsCode);
        if (usResult.success && usResult.raw_excerpt) {
          results.sources_retrieved.push({
            ...usResult,
            authority_tier: '1',
            source_type: 'us_htsus'
          });
          results.raw_legal_text += `\n\n=== US HTSUS ===\n${usResult.raw_excerpt}`;
          results.scrape_successes++;
          console.log(`[AgentResearch] ✓ US HTSUS: ${usResult.raw_excerpt?.length || 0} chars`);
        }
      } catch (e) {
        console.warn(`[AgentResearch] US HTSUS scrape failed: ${e.message}`);
      }
    }
  }
  
  // === Summary ===
  console.log(`[AgentResearch] ───────────────────────────────────────────`);
  console.log(`[AgentResearch] RETRIEVAL COMPLETE:`);
  console.log(`[AgentResearch]   Sources retrieved: ${results.sources_retrieved.length}`);
  console.log(`[AgentResearch]   Successful scrapes: ${results.scrape_successes}`);
  console.log(`[AgentResearch]   Failed scrapes: ${results.scrape_failures}`);
  console.log(`[AgentResearch]   Total legal text: ${results.raw_legal_text.length} chars`);
  console.log(`[AgentResearch] ═══════════════════════════════════════════`);
  
  return results;
}

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { reportId, knowledgeBase, expandSearch, focusAreas } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });
    
    // Task 5.5: Log expand search parameters
    if (expandSearch) {
      console.log(`[AgentResearch] ═══ EXPAND SEARCH MODE ENABLED ═══`);
      console.log(`[AgentResearch] Focus areas: ${focusAreas || 'none specified'}`);
    }
    
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
    
    const officialSources = await retrieveOfficialSources(base44, destCountry, spec, { expandSearch, focusAreas });
    
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
    
    // Task 5.3: Use LLM to extract relevant context if corpus is large
    let processedCorpus = legalTextCorpus;
    if (legalTextCorpus.length > 25000) {
      console.log(`[AgentResearch] Corpus too large (${legalTextCorpus.length}), using LLM extraction`);
      try {
        processedCorpus = await extractRelevantContextWithLLM(legalTextCorpus, spec, base44);
        console.log(`[AgentResearch] LLM extracted corpus: ${processedCorpus.length} chars`);
      } catch (e) {
        console.warn(`[AgentResearch] LLM extraction failed, using truncated corpus`);
        processedCorpus = legalTextCorpus.substring(0, 30000);
      }
    }
    
    const context = `
Destination Country: ${officialSources.normalized_country || destCountry}
HS Code Structure: ${officialSources.hs_structure || 'Unknown'} digits
Tax Method: ${officialSources.metadata?.tax_method || 'CIF'}
Regional Agreements: ${officialSources.metadata?.regional_agreements || 'None identified'}

Technical Specification:
- Name: ${spec.standardized_name}
- Material: ${spec.material_composition}
- Function: ${spec.function}
- State: ${spec.state}
- Essential Character: ${spec.essential_character}
${spec.components_breakdown ? `- Components: ${JSON.stringify(spec.components_breakdown)}` : ''}
`;

    // Include retrieved legal text as primary context (use processed corpus)
    const retrievedContext = processedCorpus ? `
═══════════════════════════════════════════════════════════════════
RETRIEVED LEGAL TEXT CORPUS (from Official Sources)
Use this as PRIMARY reference. Do NOT contradict this information.
${expandSearch ? '⚠️ EXPANDED SEARCH MODE - Additional sources retrieved' : ''}
═══════════════════════════════════════════════════════════════════
${processedCorpus.substring(0, 35000)}
═══════════════════════════════════════════════════════════════════
` : '';

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

    const fullPrompt = `${systemPrompt}\n\nDATA TO RESEARCH:\n${context}\n${kbContext}\n${retrievedContext}`;

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

    // === DATA NORMALIZATION ===
    // LLM may return objects or nested arrays instead of strings for legal_notes_found
    const normalizedLegalNotes = [];
    const rawNotes = result.legal_notes_found || [];
    
    for (const note of rawNotes) {
      if (typeof note === 'string') {
        normalizedLegalNotes.push(note);
      } else if (Array.isArray(note)) {
        // Handle nested arrays - flatten and convert each item
        for (const subNote of note) {
          if (typeof subNote === 'string') {
            normalizedLegalNotes.push(subNote);
          } else if (typeof subNote === 'object' && subNote !== null) {
            normalizedLegalNotes.push(subNote.exclusion_text || subNote.text || subNote.note || JSON.stringify(subNote));
          }
        }
      } else if (typeof note === 'object' && note !== null) {
        // Convert object to string representation
        normalizedLegalNotes.push(note.exclusion_text || note.text || note.note || JSON.stringify(note));
      } else if (note !== null && note !== undefined) {
        normalizedLegalNotes.push(String(note));
      }
    }
    
    console.log(`[AgentResearch] Normalized ${rawNotes.length} raw notes to ${normalizedLegalNotes.length} string notes`);

    // Task 5.4: Extract structured EN data for candidate headings
    const candidateHeadingsWithEN = (result.candidate_headings || []).map(heading => {
      const enData = extractStructuredEN(processedCorpus, heading.code_4_digit);
      const conflicts = checkENExclusionConflicts(enData, spec.standardized_name);
      
      return {
        ...heading,
        structured_en: enData.scope || enData.inclusions.length > 0 ? enData : null,
        exclusion_conflicts: conflicts.length > 0 ? conflicts : null
      };
    });

    // Task 5.6: Enrich result with retrieval metadata and source authority
    const enrichedResult = {
      ...result,
      // Override candidate_headings with EN-enriched version
      candidate_headings: candidateHeadingsWithEN,
      // Override legal_notes_found with normalized strings
      legal_notes_found: normalizedLegalNotes,
      // Tariff-AI 2.0 metadata
      retrieval_metadata: {
        country_validated: officialSources.country_validated,
        normalized_country: officialSources.normalized_country,
        hs_structure: officialSources.hs_structure,
        sources_retrieved_count: officialSources.sources_retrieved?.length || 0,
        legal_text_corpus_length: legalTextCorpus.length,
        processed_corpus_length: processedCorpus.length,
        retrieval_errors: officialSources.scrape_errors,
        expand_search_used: expandSearch || false,
        focus_areas_used: focusAreas || null,
        llm_extraction_used: legalTextCorpus.length > 25000
      },
      // Include raw legal text for downstream agents (Judge, Tax)
      raw_legal_text_corpus: processedCorpus.substring(0, 50000),
      // BTI results for precedent analysis
      bti_cases: result.bti_cases || (euBtiResult?.bti_references?.map(ref => ({
        reference: ref,
        source: 'EU_BTI_DATABASE'
      })) || []),
      // Confirmed HS structure from CountryTradeResource
      confirmed_hs_structure: officialSources.hs_structure || result.confirmed_hs_structure,
      // Task 5.6: Classify source authority for all verified sources
      verified_sources: (result.verified_sources || []).map(s => ({
        ...s,
        authority_tier: s.authority_tier || classifySourceAuthority(s.url)
      }))
    };
    
    // Log Tier 1 sources count
    const tier1Count = enrichedResult.verified_sources.filter(s => s.authority_tier === '1').length;
    console.log(`[AgentResearch] Verified sources: ${enrichedResult.verified_sources.length} total, ${tier1Count} Tier 1`);

    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        processing_status: 'research_completed',
        research_findings: enrichedResult
    });
    
    return Response.json({ 
      success: true, 
      status: 'research_completed', 
      findings: enrichedResult,
      retrieval_summary: {
        official_sources_used: officialSources.sources_retrieved?.length || 0,
        legal_text_available: legalTextCorpus.length > 0,
        processed_corpus_length: processedCorpus.length,
        country_in_knowledge_base: officialSources.country_validated,
        expand_search_mode: expandSearch || false,
        tier1_sources_count: tier1Count
      }
    });

  } catch (error) {
    console.error('Agent B (Researcher) Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});