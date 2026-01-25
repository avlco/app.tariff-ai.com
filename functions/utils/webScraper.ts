/**
 * Web Scraper Utilities - Tariff-AI 2.0 "Retrieve & Deduce" Architecture
 * 
 * UPGRADED: From "Search & Guess" to targeted retrieval from pre-approved sources.
 * 
 * This module now:
 * 1. Accepts specific URLs from ResourceManager (not free-form search)
 * 2. Extracts raw legal text for context injection into LLM
 * 3. Handles PDF documents via external API (PDFShift)
 * 4. Optimizes context window by extracting relevant sections
 * 5. TARIFF-AI 2.0: Implements caching layer to reduce redundant network calls
 * 
 * Sources:
 * - WCO ECICS (EN database)
 * - EU TARIC
 * - Israel Customs (Shaar Olami)
 * - BTI databases
 * - Any URL from CountryTradeResource
 */

import { get as cacheGet, set as cacheSet, CACHE_KEYS, CACHE_TTL } from './cache.js';

const SOURCES = {
  WCO_ECICS: 'https://www.wcoomd.org/en/topics/nomenclature/instrument-and-tools/hs-online.aspx',
  EU_TARIC: 'https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp',
  ISRAEL_SHAAR: 'https://shaarolami-query.customs.mof.gov.il/CustomspilloTaxesummaryznsql.aspx',
  US_HTSUS: 'https://hts.usitc.gov/',
  EU_BTI: 'https://ec.europa.eu/taxation_customs/dds2/ebti/ebti_consultation.jsp'
};

/**
 * Content type detection
 */
const ContentType = {
  HTML: 'html',
  PDF: 'pdf',
  JSON: 'json',
  XML: 'xml',
  UNKNOWN: 'unknown'
};

/**
 * Detect content type from response headers or URL
 */
function detectContentType(response, url) {
  const contentType = response.headers.get('content-type') || '';
  
  if (contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
    return ContentType.PDF;
  }
  if (contentType.includes('application/json')) {
    return ContentType.JSON;
  }
  if (contentType.includes('text/xml') || contentType.includes('application/xml')) {
    return ContentType.XML;
  }
  if (contentType.includes('text/html')) {
    return ContentType.HTML;
  }
  
  return ContentType.UNKNOWN;
}

/**
 * Fetch with retry and timeout
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  const timeout = options.timeout || 15000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TariffAI/1.0; +https://tariffai.com)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          ...options.headers
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }
      await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
    }
  }
}

/**
 * Extract text content from HTML (enhanced extraction)
 * Preserves structure for legal documents
 */
function extractTextFromHtml(html, preserveStructure = false) {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '') // Remove navigation
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '') // Remove headers
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ''); // Remove footers
  
  if (preserveStructure) {
    // Preserve headings and list structure
    text = text
      .replace(/<h[1-6][^>]*>/gi, '\n\n### ')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/li>/gi, '')
      .replace(/<tr[^>]*>/gi, '\n')
      .replace(/<td[^>]*>/gi, ' | ')
      .replace(/<th[^>]*>/gi, ' | ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p[^>]*>/gi, '\n\n')
      .replace(/<\/p>/gi, '');
  }
  
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Extract PDF text using PDFShift API
 * Requires PDFSHIFT_API_KEY secret
 */
async function extractTextFromPdf(pdfUrl) {
  const apiKey = Deno.env.get('PDFSHIFT_API_KEY');
  
  if (!apiKey) {
    console.warn('[WebScraper] PDFSHIFT_API_KEY not set, PDF extraction disabled');
    return {
      success: false,
      error: 'PDF extraction not configured',
      text: null
    };
  }
  
  try {
    // First, fetch the PDF
    const pdfResponse = await fetchWithRetry(pdfUrl, { timeout: 30000 });
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
    
    // Use PDFShift to convert to text
    const response = await fetch('https://api.pdfshift.io/v3/convert/text', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa('api:' + apiKey)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: `data:application/pdf;base64,${pdfBase64}`
      })
    });
    
    if (!response.ok) {
      throw new Error(`PDFShift error: ${response.status}`);
    }
    
    const text = await response.text();
    
    return {
      success: true,
      text: text,
      source_url: pdfUrl,
      extracted_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('[WebScraper] PDF extraction failed:', error.message);
    return {
      success: false,
      error: error.message,
      text: null
    };
  }
}

/**
 * Extract relevant section from legal text based on HS code
 * Optimizes context window by focusing on relevant chapter/heading
 */
function extractRelevantSection(fullText, hsCode, windowSize = 5000) {
  if (!fullText || !hsCode) return fullText;
  
  const code4 = hsCode.substring(0, 4);
  const code2 = hsCode.substring(0, 2);
  
  // Search patterns in order of specificity
  const patterns = [
    new RegExp(`(${hsCode}[\\s\\S]{0,${windowSize}})`, 'i'),
    new RegExp(`(${code4}[\\s\\S]{0,${windowSize}})`, 'i'),
    new RegExp(`(chapter\\s*${code2}[\\s\\S]{0,${windowSize}})`, 'i'),
    new RegExp(`(heading\\s*${code4}[\\s\\S]{0,${windowSize}})`, 'i')
  ];
  
  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match) {
      // Get context before and after the match
      const matchIndex = fullText.indexOf(match[1]);
      const start = Math.max(0, matchIndex - 500);
      const end = Math.min(fullText.length, matchIndex + match[1].length + 500);
      
      return {
        section: fullText.substring(start, end),
        matched_pattern: pattern.source,
        hs_code: hsCode,
        is_excerpt: true
      };
    }
  }
  
  // No specific match found, return truncated full text
  return {
    section: fullText.substring(0, windowSize * 2),
    matched_pattern: null,
    hs_code: hsCode,
    is_excerpt: true,
    note: 'No specific HS code section found, returning document excerpt'
  };
}

/**
 * Parse HS code structure from text
 */
function parseHsCodeFromText(text, targetCode) {
  const patterns = [
    new RegExp(`${targetCode}[\\s\\-:]+([^\\n]{10,200})`, 'gi'),
    new RegExp(`(${targetCode.substring(0,4)})[\\s\\-:]+([^\\n]{10,200})`, 'gi')
  ];
  
  const matches = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        code: match[1] || targetCode,
        description: (match[2] || match[1]).trim().substring(0, 200)
      });
    }
  }
  
  return matches;
}

/**
 * Scrape EU TARIC database for HS code information
 */
export async function scrapeEuTaric(hsCode) {
  const code4 = hsCode.substring(0, 4);
  const url = `https://ec.europa.eu/taxation_customs/dds2/taric/measures.jsp?Lang=en&Taric=${hsCode}&Domain=TARIC`;
  
  try {
    const response = await fetchWithRetry(url);
    const html = await response.text();
    const text = extractTextFromHtml(html);
    
    // Extract duty rates
    const dutyMatch = text.match(/(?:duty|rate)[:\s]+(\d+(?:\.\d+)?)\s*%/gi);
    const vatMatch = text.match(/(?:vat)[:\s]+(\d+(?:\.\d+)?)\s*%/gi);
    
    // Extract description
    const descMatch = text.match(new RegExp(`${code4}[^\\n]*([^\\n]{20,300})`, 'i'));
    
    return {
      source: 'EU_TARIC',
      url,
      hs_code: hsCode,
      description: descMatch ? descMatch[1].trim() : null,
      duty_rates: dutyMatch ? dutyMatch.map(d => d.replace(/[^\d.%]/g, '')) : [],
      vat_rate: vatMatch ? vatMatch[0].replace(/[^\d.%]/g, '') : null,
      raw_excerpt: text.substring(0, 2000),
      fetched_at: new Date().toISOString(),
      success: true
    };
  } catch (error) {
    return {
      source: 'EU_TARIC',
      url,
      hs_code: hsCode,
      success: false,
      error: error.message
    };
  }
}

/**
 * Scrape Israel Customs (Shaar Olami) for tariff data
 */
export async function scrapeIsraelCustoms(hsCode) {
  const url = `https://shaarolami-query.customs.mof.gov.il/CustomspilloTaxesummaryznsql.aspx?session=&table=CustomspilloTaxesummaryznsql&field=CustomsItem&value=${hsCode}&lang=he`;
  
  try {
    const response = await fetchWithRetry(url);
    const html = await response.text();
    const text = extractTextFromHtml(html);
    
    // Extract Hebrew description
    const hebrewDesc = text.match(/תיאור[:\s]+([^\n]{10,200})/i);
    
    // Extract duty rates (מכס)
    const dutyMatch = text.match(/מכס[:\s]+(\d+(?:\.\d+)?)\s*%/i);
    const purchaseTax = text.match(/מס קנייה[:\s]+(\d+(?:\.\d+)?)\s*%/i);
    
    return {
      source: 'ISRAEL_CUSTOMS',
      url,
      hs_code: hsCode,
      description_he: hebrewDesc ? hebrewDesc[1].trim() : null,
      duty_rate: dutyMatch ? dutyMatch[1] + '%' : null,
      purchase_tax: purchaseTax ? purchaseTax[1] + '%' : null,
      raw_excerpt: text.substring(0, 2000),
      fetched_at: new Date().toISOString(),
      success: true
    };
  } catch (error) {
    return {
      source: 'ISRAEL_CUSTOMS',
      url,
      hs_code: hsCode,
      success: false,
      error: error.message
    };
  }
}

/**
 * Scrape EU BTI (Binding Tariff Information) database
 */
export async function scrapeEuBti(productKeywords, hsCode = null) {
  const searchTerms = encodeURIComponent(productKeywords);
  const url = `https://ec.europa.eu/taxation_customs/dds2/ebti/ebti_consultation.jsp?Lang=en&Expand=true&offset=1&criteria1=GDINF&Criteria1Value=${searchTerms}`;
  
  try {
    const response = await fetchWithRetry(url);
    const html = await response.text();
    const text = extractTextFromHtml(html);
    
    // Parse BTI entries
    const btiPattern = /BTI\s*(?:Reference|Number)?[:\s]*([A-Z]{2}[\w\-]+)/gi;
    const btiMatches = [];
    let match;
    
    while ((match = btiPattern.exec(text)) !== null) {
      btiMatches.push(match[1]);
    }
    
    // Extract HS codes mentioned
    const hsPattern = /(\d{4})\s*(\d{2})?\s*(\d{2})?\s*(\d{2})?/g;
    const hsMatches = [];
    while ((match = hsPattern.exec(text)) !== null) {
      const code = [match[1], match[2], match[3], match[4]].filter(Boolean).join('');
      if (code.length >= 4 && code.length <= 10) {
        hsMatches.push(code);
      }
    }
    
    return {
      source: 'EU_BTI',
      url,
      search_terms: productKeywords,
      bti_references: [...new Set(btiMatches)].slice(0, 10),
      hs_codes_found: [...new Set(hsMatches)].slice(0, 20),
      result_count: btiMatches.length,
      raw_excerpt: text.substring(0, 3000),
      fetched_at: new Date().toISOString(),
      success: true
    };
  } catch (error) {
    return {
      source: 'EU_BTI',
      url,
      search_terms: productKeywords,
      success: false,
      error: error.message
    };
  }
}

/**
 * Scrape US HTSUS for tariff information
 */
export async function scrapeUsHtsus(hsCode) {
  const code4 = hsCode.substring(0, 4);
  const url = `https://hts.usitc.gov/current?search=${code4}`;
  
  try {
    const response = await fetchWithRetry(url);
    const html = await response.text();
    const text = extractTextFromHtml(html);
    
    // Parse entries
    const entries = parseHsCodeFromText(text, hsCode);
    
    // Extract duty rates
    const dutyMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:ad valorem|free)/gi);
    
    return {
      source: 'US_HTSUS',
      url,
      hs_code: hsCode,
      entries: entries.slice(0, 10),
      duty_indications: dutyMatch ? dutyMatch.slice(0, 5) : [],
      raw_excerpt: text.substring(0, 2000),
      fetched_at: new Date().toISOString(),
      success: true
    };
  } catch (error) {
    return {
      source: 'US_HTSUS',
      url,
      hs_code: hsCode,
      success: false,
      error: error.message
    };
  }
}

/**
 * Search for WCO Explanatory Notes via web search fallback
 * (Direct WCO access requires subscription - use public mirrors)
 */
export async function searchExplanatoryNotes(hsCode, productDescription) {
  const code4 = hsCode.substring(0, 4);
  const searchQuery = encodeURIComponent(`HS ${code4} explanatory notes WCO ${productDescription}`);
  
  // Try multiple public sources that often host EN excerpts
  const sources = [
    `https://www.foreign-trade.com/reference/hscode.cfm?code=${code4}`,
    `https://www.cybex.in/hs-code/${code4}.aspx`
  ];
  
  const results = [];
  
  for (const sourceUrl of sources) {
    try {
      const response = await fetchWithRetry(sourceUrl, { timeout: 10000 });
      const html = await response.text();
      const text = extractTextFromHtml(html);
      
      // Look for EN-like content
      const enPatterns = [
        /(?:explanatory notes?|EN)[:\s]*([^.]{50,500})/gi,
        /(?:this heading covers|includes?|excludes?)[:\s]*([^.]{30,300})/gi,
        /(?:chapter notes?|section notes?)[:\s]*([^.]{30,300})/gi
      ];
      
      const excerpts = [];
      for (const pattern of enPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          excerpts.push(match[1].trim());
        }
      }
      
      if (excerpts.length > 0) {
        results.push({
          source_url: sourceUrl,
          hs_code: code4,
          en_excerpts: excerpts.slice(0, 5),
          success: true
        });
      }
    } catch (e) {
      // Continue to next source
    }
  }
  
  return {
    source: 'EN_SEARCH',
    hs_code: hsCode,
    results,
    fetched_at: new Date().toISOString(),
    success: results.length > 0
  };
}

/**
 * Aggregate scraping from multiple sources for a given HS code
 */
export async function scrapeAllSources(hsCode, productDescription, destinationCountry = 'IL') {
  const tasks = [
    scrapeEuTaric(hsCode),
    scrapeEuBti(productDescription, hsCode),
    searchExplanatoryNotes(hsCode, productDescription)
  ];
  
  // Add country-specific scraping
  if (destinationCountry === 'IL') {
    tasks.push(scrapeIsraelCustoms(hsCode));
  } else if (destinationCountry === 'US') {
    tasks.push(scrapeUsHtsus(hsCode));
  }
  
  const results = await Promise.allSettled(tasks);
  
  return {
    hs_code: hsCode,
    product: productDescription,
    destination: destinationCountry,
    sources: results.map((r, i) => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message }),
    scraped_at: new Date().toISOString()
  };
}

// ============================================================================
// NEW: Targeted URL Scraping (Tariff-AI 2.0)
// ============================================================================

/**
 * Scrape content from a specific URL (from ResourceManager)
 * This is the primary method for the new architecture
 * 
 * @param {string} url - Specific URL to scrape
 * @param {object} options - Scraping options
 * @param {string} options.hsCode - HS code to focus extraction on
 * @param {string[]} options.searchTerms - Terms to look for in the content
 * @param {boolean} options.preserveStructure - Keep document structure
 * @param {number} options.maxLength - Maximum content length to return
 * @returns {object} Scraped content result
 */
export async function scrapeTargetedUrl(url, options = {}) {
  const {
    hsCode = null,
    searchTerms = [],
    preserveStructure = true,
    maxLength = 15000,
    useCache = true
  } = options;
  
  // TARIFF-AI 2.0: Check cache first
  if (useCache) {
    const cacheKey = CACHE_KEYS.WEBSCRAPE_URL(url);
    const cached = cacheGet(cacheKey);
    if (cached) {
      console.log(`[WebScraper] Cache HIT for ${url.substring(0, 50)}...`);
      return {
        ...cached,
        from_cache: true
      };
    }
  }
  
  try {
    const response = await fetchWithRetry(url, { timeout: 20000 });
    const contentType = detectContentType(response, url);
    
    let rawText = '';
    let extractionMethod = 'html';
    
    if (contentType === ContentType.PDF) {
      // Extract text from PDF
      const pdfResult = await extractTextFromPdf(url);
      if (pdfResult.success) {
        rawText = pdfResult.text;
        extractionMethod = 'pdf';
      } else {
        return {
          success: false,
          url,
          content_type: contentType,
          error: `PDF extraction failed: ${pdfResult.error}`
        };
      }
    } else {
      // Extract from HTML
      const html = await response.text();
      rawText = extractTextFromHtml(html, preserveStructure);
      extractionMethod = 'html';
    }
    
    // Extract relevant section if HS code provided
    let finalContent = rawText;
    let sectionInfo = null;
    
    if (hsCode && rawText.length > maxLength) {
      const extracted = extractRelevantSection(rawText, hsCode, maxLength / 2);
      if (typeof extracted === 'object') {
        finalContent = extracted.section;
        sectionInfo = {
          matched_pattern: extracted.matched_pattern,
          is_excerpt: extracted.is_excerpt,
          note: extracted.note
        };
      } else {
        finalContent = extracted;
      }
    }
    
    // Truncate if still too long
    if (finalContent.length > maxLength) {
      finalContent = finalContent.substring(0, maxLength) + '\n[... content truncated ...]';
    }
    
    // Search for specific terms
    const foundTerms = [];
    for (const term of searchTerms) {
      if (finalContent.toLowerCase().includes(term.toLowerCase())) {
        foundTerms.push(term);
      }
    }
    
    const result = {
      success: true,
      url,
      content_type: contentType,
      extraction_method: extractionMethod,
      raw_legal_text: finalContent,
      content_length: finalContent.length,
      original_length: rawText.length,
      section_info: sectionInfo,
      found_terms: foundTerms,
      hs_code_referenced: hsCode,
      fetched_at: new Date().toISOString()
    };
    
    // TARIFF-AI 2.0: Store in cache
    if (useCache) {
      const cacheKey = CACHE_KEYS.WEBSCRAPE_URL(url);
      cacheSet(cacheKey, result, CACHE_TTL.WEBSCRAPE_URL);
    }
    
    return result;
    
  } catch (error) {
    return {
      success: false,
      url,
      error: error.message,
      fetched_at: new Date().toISOString()
    };
  }
}

/**
 * Scrape multiple URLs and aggregate results
 * Used when ResourceManager returns multiple sources
 * 
 * @param {string[]} urls - Array of URLs to scrape
 * @param {object} options - Scraping options (same as scrapeTargetedUrl)
 * @returns {object} Aggregated scraping results
 */
export async function scrapeMultipleUrls(urls, options = {}) {
  if (!urls || urls.length === 0) {
    return {
      success: false,
      error: 'No URLs provided',
      results: []
    };
  }
  
  const tasks = urls.map(url => scrapeTargetedUrl(url, options));
  const results = await Promise.allSettled(tasks);
  
  const processedResults = results.map((r, i) => {
    if (r.status === 'fulfilled') {
      return r.value;
    }
    return {
      success: false,
      url: urls[i],
      error: r.reason?.message || 'Unknown error'
    };
  });
  
  const successfulResults = processedResults.filter(r => r.success);
  
  return {
    success: successfulResults.length > 0,
    total_urls: urls.length,
    successful: successfulResults.length,
    failed: urls.length - successfulResults.length,
    results: processedResults,
    // Combine all raw legal text for LLM context
    combined_legal_text: successfulResults
      .map(r => `\n--- SOURCE: ${r.url} ---\n${r.raw_legal_text}`)
      .join('\n\n'),
    fetched_at: new Date().toISOString()
  };
}

/**
 * Validate that HS code exists in scraped content
 * Part of QA "Existence Check"
 * 
 * @param {string} content - Scraped legal text
 * @param {string} hsCode - Full HS code to validate
 * @returns {object} Validation result
 */
export function validateHsCodeInContent(content, hsCode) {
  if (!content || !hsCode) {
    return {
      valid: false,
      error: 'Content or HS code missing'
    };
  }
  
  // Clean the HS code (remove dots, spaces)
  const cleanCode = hsCode.replace(/[\s.]/g, '');
  
  // Check for exact match
  const exactMatch = content.includes(cleanCode);
  
  // Check for formatted variations (with dots, spaces)
  const formattedVariations = [
    hsCode,
    cleanCode.substring(0, 4) + '.' + cleanCode.substring(4, 6) + '.' + cleanCode.substring(6),
    cleanCode.substring(0, 4) + ' ' + cleanCode.substring(4, 6) + ' ' + cleanCode.substring(6),
    cleanCode.substring(0, 4) + '.' + cleanCode.substring(4)
  ];
  
  const anyMatch = formattedVariations.some(variant => 
    content.includes(variant)
  );
  
  // Check for partial match (4-digit heading)
  const headingMatch = content.includes(cleanCode.substring(0, 4));
  
  return {
    valid: exactMatch || anyMatch,
    exact_match: exactMatch,
    formatted_match: anyMatch,
    heading_match: headingMatch,
    hs_code: hsCode,
    checked_variations: formattedVariations
  };
}

// ============================================================================
// Task 5.1: Source Authority Classification (5.2a.1)
// ============================================================================

/**
 * Tier 1: Official government customs authorities and WCO
 */
const TIER1_DOMAINS = [
  // International organizations
  'wcoomd.org', 'wto.org', 'wcotradetools.org',
  // Israel
  'gov.il', 'customs.gov.il', 'mof.gov.il', 'taxes.gov.il', 'shaarolami',
  // USA
  'cbp.gov', 'usitc.gov', 'trade.gov',
  // EU
  'ec.europa.eu', 'taxation_customs',
  // UK
  'gov.uk', 'hmrc.gov.uk',
  // China
  'customs.gov.cn', 'mofcom.gov.cn',
  // Japan
  'customs.go.jp', 'meti.go.jp',
  // Germany
  'zoll.de', 'bmwk.de',
  // France
  'douane.gouv.fr',
  // Canada
  'cbsa-asfc.gc.ca',
  // Australia
  'abf.gov.au', 'homeaffairs.gov.au'
];

/**
 * Tier 2: Official government trade/commerce departments
 */
const TIER2_DOMAINS = [
  'eur-lex.europa.eu', 'legislation.gov',
  'export.gov', 'commerce.gov',
  'trade.ec.europa.eu',
  'wipo.int', 'unctad.org',
  'itamaraty.gov.br', 'economia.gob.mx'
];

/**
 * Classify source authority based on URL domain
 * @param {string} url - URL to classify
 * @returns {string} Authority tier: '1' (highest), '2' (medium), '3' (reference only)
 */
export function classifySourceAuthority(url) {
  if (!url) return '3';
  const urlLower = url.toLowerCase();
  
  // Check Tier 1 domains
  if (TIER1_DOMAINS.some(d => urlLower.includes(d))) return '1';
  
  // Check Tier 2 domains
  if (TIER2_DOMAINS.some(d => urlLower.includes(d))) return '2';
  
  // Default to Tier 3 (reference only)
  return '3';
}

/**
 * Filter sources by minimum authority tier
 * @param {Array} sources - Array of source objects with url property
 * @param {string} minTier - Minimum tier ('1', '2', or '3')
 * @returns {Array} Filtered sources
 */
export function filterSourcesByTier(sources, minTier = '2') {
  if (!Array.isArray(sources)) return [];
  
  return sources.filter(s => {
    const tier = classifySourceAuthority(s.url);
    return parseInt(tier) <= parseInt(minTier);
  });
}

// ============================================================================
// Task 5.2: Enhanced Deep Link Scraping (5.2b.1)
// ============================================================================

/**
 * Extract internal links from HTML content
 * @param {string} html - HTML content
 * @param {string} baseDomain - Base domain to filter internal links
 * @returns {Array<string>} Array of internal URLs
 */
function extractInternalLinks(html, baseDomain) {
  if (!html || !baseDomain) return [];
  
  const linkPattern = /href=["']([^"'#]+)["']/gi;
  const links = [];
  let match;
  
  while ((match = linkPattern.exec(html)) !== null) {
    try {
      const href = match[1];
      // Only include http links from same domain
      if (href.startsWith('http') && href.includes(baseDomain)) {
        // Filter out common non-content links
        if (!href.includes('login') && 
            !href.includes('signup') && 
            !href.includes('contact') &&
            !href.includes('cookie') &&
            !href.includes('privacy') &&
            !href.includes('.pdf') &&
            !href.includes('.zip')) {
          links.push(href);
        }
      }
    } catch (e) {
      // Skip invalid URLs
    }
  }
  
  return [...new Set(links)]; // Remove duplicates
}

/**
 * Scrape URL with recursive depth following internal links
 * Used when expand_search is enabled for richer legal text corpus
 * 
 * @param {string} url - Starting URL to scrape
 * @param {object} options - Scraping options
 * @param {number} options.maxDepth - Maximum link depth to follow (default: 1)
 * @param {number} options.maxLinks - Maximum links to follow per page (default: 3)
 * @param {Set} options.visitedUrls - Already visited URLs (for recursion)
 * @returns {object} Scraping result with combined content
 */
export async function scrapeWithDepth(url, options = {}) {
  const {
    maxDepth = 1,
    currentDepth = 0,
    visitedUrls = new Set(),
    maxLinks = 3,
    hsCode = null,
    searchTerms = [],
    preserveStructure = true,
    maxLength = 20000
  } = options;

  // Prevent infinite loops and respect depth limit
  if (currentDepth > maxDepth || visitedUrls.has(url)) {
    return { 
      success: true, 
      raw_legal_text: '', 
      depth_reached: currentDepth,
      skipped: true,
      reason: visitedUrls.has(url) ? 'already_visited' : 'max_depth_reached'
    };
  }
  
  visitedUrls.add(url);
  
  // Scrape the current URL
  const result = await scrapeTargetedUrl(url, {
    hsCode,
    searchTerms,
    preserveStructure,
    maxLength: maxLength / (currentDepth + 1) // Reduce length for deeper pages
  });
  
  if (!result.success) {
    return result;
  }
  
  // If we've reached max depth or got little content, stop here
  if (currentDepth >= maxDepth || result.raw_legal_text.length < 200) {
    return {
      ...result,
      depth_reached: currentDepth,
      links_followed: 0
    };
  }
  
  // Extract internal links from same domain
  let baseDomain;
  try {
    baseDomain = new URL(url).hostname;
  } catch (e) {
    return { ...result, depth_reached: currentDepth, links_followed: 0 };
  }
  
  const internalLinks = extractInternalLinks(result.raw_legal_text, baseDomain)
    .slice(0, maxLinks);
  
  if (internalLinks.length === 0) {
    return { ...result, depth_reached: currentDepth, links_followed: 0 };
  }
  
  console.log(`[WebScraper] Depth ${currentDepth}: Following ${internalLinks.length} internal links from ${baseDomain}`);
  
  // Recursively scrape relevant internal links
  let combinedText = result.raw_legal_text;
  let linksFollowed = 0;
  
  for (const link of internalLinks) {
    // Only follow links that seem relevant to customs/tariffs
    const linkLower = link.toLowerCase();
    const isRelevant = linkLower.includes('tariff') || 
                       linkLower.includes('customs') || 
                       linkLower.includes('import') ||
                       linkLower.includes('hs') ||
                       linkLower.includes('code') ||
                       linkLower.includes('chapter') ||
                       linkLower.includes('heading') ||
                       (hsCode && linkLower.includes(hsCode.substring(0, 4)));
    
    if (!isRelevant && currentDepth > 0) continue;
    
    const subResult = await scrapeWithDepth(link, {
      maxDepth,
      currentDepth: currentDepth + 1,
      visitedUrls,
      maxLinks: Math.max(1, maxLinks - 1), // Reduce for deeper levels
      hsCode,
      searchTerms,
      preserveStructure,
      maxLength
    });
    
    if (subResult.success && subResult.raw_legal_text && !subResult.skipped) {
      combinedText += `\n\n--- LINKED PAGE (depth ${currentDepth + 1}): ${link} ---\n${subResult.raw_legal_text}`;
      linksFollowed++;
    }
  }
  
  return { 
    ...result, 
    raw_legal_text: combinedText.substring(0, maxLength * 2), // Allow some overflow for deep scraping
    depth_reached: currentDepth,
    links_followed: linksFollowed,
    total_visited: visitedUrls.size
  };
}

// ============================================================================
// Task 5.3: LLM Context Extraction (5.2b.2)
// ============================================================================

/**
 * Use LLM to extract only relevant customs/legal content from raw scraped text
 * This optimizes the context window by removing irrelevant content
 * 
 * @param {string} rawText - Raw scraped text (may contain navigation, ads, etc.)
 * @param {object} productSpec - Product specification for context
 * @param {object} base44Client - Base44 SDK client for LLM invocation
 * @returns {string} Filtered relevant content
 */
export async function extractRelevantContextWithLLM(rawText, productSpec, base44Client) {
  // Skip if text is already short enough
  if (!rawText || rawText.length < 1000) return rawText;
  
  // Skip if no client provided
  if (!base44Client) {
    console.warn('[WebScraper] No base44Client provided for LLM extraction');
    return rawText.substring(0, 15000);
  }
  
  const productContext = [
    productSpec?.standardized_name,
    productSpec?.material_composition,
    productSpec?.function
  ].filter(Boolean).join(', ');

  const prompt = `You are a customs legal text extractor. Extract ONLY sections relevant to customs classification from the following text.

KEEP:
- HS code definitions and descriptions
- Tariff rates and duty percentages
- Section/Chapter/Heading notes
- Import requirements and regulations
- Legal definitions and exclusions
- Classification criteria and rules
- BTI/Advance Ruling references

REMOVE:
- Website navigation and menus
- Advertisements and promotions
- Cookie notices and privacy policies
- Contact information and addresses
- User interface elements
- Unrelated content

PRODUCT CONTEXT: ${productContext || 'General customs classification'}

SOURCE TEXT (extract relevant parts only):
${rawText.substring(0, 30000)}

Return ONLY the extracted legal/regulatory text. No explanations or commentary.`;

  try {
    const extracted = await base44Client.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: null
    });
    
    if (extracted && typeof extracted === 'string' && extracted.length > 100) {
      console.log(`[WebScraper] LLM extraction: ${rawText.length} -> ${extracted.length} chars`);
      return extracted;
    }
    
    return rawText.substring(0, 15000);
  } catch (e) {
    console.warn('[WebScraper] LLM extraction failed:', e.message);
    return rawText.substring(0, 15000);
  }
}

// ============================================================================
// Task 5.4: Structured EN Extraction (5.2c.1)
// ============================================================================

/**
 * Extract structured Explanatory Notes data from text
 * Parses scope, inclusions, exclusions, criteria, and redirect headings
 * 
 * @param {string} text - Text containing EN information
 * @param {string} headingCode - 4-digit heading code
 * @returns {object} Structured EN data
 */
export function extractStructuredEN(text, headingCode) {
  const result = {
    heading: headingCode,
    scope: null,
    inclusions: [],
    exclusions: [],
    criteria: [],
    redirect_headings: [],
    raw_en_text: null
  };
  
  if (!text || !headingCode) return result;
  
  // Try to find the EN section for this heading
  const headingPattern = new RegExp(
    `(?:heading\\s*${headingCode}|${headingCode}[\\s\\-:]+)[\\s\\S]{0,5000}?(?=heading\\s*\\d{4}|$)`,
    'i'
  );
  const headingMatch = text.match(headingPattern);
  const relevantText = headingMatch ? headingMatch[0] : text.substring(0, 5000);
  result.raw_en_text = relevantText.substring(0, 2000);
  
  // Scope extraction ("This heading covers...")
  const scopePatterns = [
    /(?:this heading covers?)[:\s]*([^.]{30,500})/i,
    /(?:scope)[:\s]*([^.]{30,500})/i,
    /(?:this heading includes?)[:\s]*([^.]{30,500})/i
  ];
  
  for (const pattern of scopePatterns) {
    const scopeMatch = relevantText.match(pattern);
    if (scopeMatch) {
      result.scope = scopeMatch[1].trim();
      break;
    }
  }
  
  // Inclusions extraction
  const inclusionPatterns = [
    /(?:includes?|also covers?|comprising)[:\s]*([^.]{20,300})/gi,
    /(?:the heading covers)[:\s]*([^.]{20,300})/gi
  ];
  
  for (const pattern of inclusionPatterns) {
    const matches = relevantText.matchAll(pattern);
    for (const m of matches) {
      const inclusion = m[1].trim();
      if (!result.inclusions.includes(inclusion)) {
        result.inclusions.push(inclusion);
      }
    }
  }
  
  // Exclusions extraction with redirect headings
  const exclusionPatterns = [
    /(?:excludes?|does not cover|not included)[:\s]*([^.]{20,300})(?:[^.]*?(?:see|classified under|heading)\s*(\d{4}))?/gi,
    /(?:however,?\s*(?:this heading )?does not (?:cover|include))[:\s]*([^.]{20,300})/gi
  ];
  
  for (const pattern of exclusionPatterns) {
    const matches = relevantText.matchAll(pattern);
    for (const m of matches) {
      const exclusionText = m[1].trim();
      const redirectHeading = m[2] || null;
      
      result.exclusions.push({
        text: exclusionText,
        redirect_heading: redirectHeading
      });
      
      if (redirectHeading && !result.redirect_headings.includes(redirectHeading)) {
        result.redirect_headings.push(redirectHeading);
      }
    }
  }
  
  // Also look for explicit redirects
  const redirectPattern = /(?:see|classified under|falls under)\s*(?:heading\s*)?(\d{4})/gi;
  const redirectMatches = relevantText.matchAll(redirectPattern);
  for (const m of redirectMatches) {
    if (!result.redirect_headings.includes(m[1])) {
      result.redirect_headings.push(m[1]);
    }
  }
  
  // Classification criteria extraction (numbered or lettered lists)
  const criteriaPatterns = [
    /\(([a-z])\)\s*([^;)(]{20,200})/gi,  // (a) criteria text
    /\((\d+)\)\s*([^;)(]{20,200})/gi,    // (1) criteria text
    /(?:must|shall|should)\s+([^.]{20,150})/gi  // must/shall requirements
  ];
  
  for (const pattern of criteriaPatterns) {
    const matches = relevantText.matchAll(pattern);
    for (const m of matches) {
      const criterion = m[2] ? `(${m[1]}) ${m[2].trim()}` : m[1].trim();
      if (criterion.length > 20 && !result.criteria.some(c => c.includes(criterion.substring(0, 30)))) {
        result.criteria.push(criterion);
      }
    }
  }
  
  // Limit arrays
  result.inclusions = result.inclusions.slice(0, 10);
  result.exclusions = result.exclusions.slice(0, 10);
  result.criteria = result.criteria.slice(0, 10);
  result.redirect_headings = result.redirect_headings.slice(0, 5);
  
  return result;
}

/**
 * Cross-reference EN exclusions with product description
 * Returns potential conflicts that should be reviewed
 * 
 * @param {object} enData - Structured EN data from extractStructuredEN
 * @param {string} productDescription - Product description to check
 * @returns {Array} Array of potential conflicts
 */
export function checkENExclusionConflicts(enData, productDescription) {
  if (!enData || !productDescription) return [];
  
  const conflicts = [];
  const productLower = productDescription.toLowerCase();
  
  for (const exclusion of enData.exclusions || []) {
    const exclusionLower = exclusion.text.toLowerCase();
    
    // Check for keyword overlap
    const exclusionKeywords = exclusionLower.split(/\s+/).filter(w => w.length > 4);
    const matchingKeywords = exclusionKeywords.filter(kw => productLower.includes(kw));
    
    if (matchingKeywords.length >= 2) {
      conflicts.push({
        exclusion_text: exclusion.text,
        redirect_heading: exclusion.redirect_heading,
        matching_keywords: matchingKeywords,
        confidence: matchingKeywords.length >= 3 ? 'high' : 'medium'
      });
    }
  }
  
  return conflicts;
}

export { SOURCES, ContentType, extractTextFromHtml, extractTextFromPdf, extractRelevantSection };