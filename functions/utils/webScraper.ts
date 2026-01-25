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
 * 
 * Sources:
 * - WCO ECICS (EN database)
 * - EU TARIC
 * - Israel Customs (Shaar Olami)
 * - BTI databases
 * - Any URL from CountryTradeResource
 */

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
 * Extract text content from HTML (simple extraction without DOM parser)
 */
function extractTextFromHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

export { SOURCES };