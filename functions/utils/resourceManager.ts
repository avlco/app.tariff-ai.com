/**
 * ResourceManager - Interface to CountryTradeResource Entity
 * 
 * Provides structured access to official trade data sources.
 * Replaces free-form web search with targeted retrieval from pre-approved sources.
 * 
 * Part of Tariff-AI 2.0 "Retrieve & Deduce" Architecture
 */

/**
 * Category types for resource retrieval
 */
export const ResourceCategory = {
  CUSTOMS: 'customs_links',           // Official customs authority sites
  REGULATIONS: 'regulation_links',    // Standards and import requirements
  TRADE_AGREEMENTS: 'trade_agreements_links', // FTA information
  GOVERNMENT: 'government_links'      // Ministry of trade/economy
};

/**
 * Country name normalization mapping
 */
const COUNTRY_ALIASES = {
  // Common variations
  'israel': 'Israel',
  'il': 'Israel',
  'usa': 'United States',
  'us': 'United States',
  'united states of america': 'United States',
  'uk': 'United Kingdom',
  'britain': 'United Kingdom',
  'great britain': 'United Kingdom',
  'germany': 'Germany',
  'de': 'Germany',
  'france': 'France',
  'fr': 'France',
  'china': 'China',
  'cn': 'China',
  'japan': 'Japan',
  'jp': 'Japan',
  'turkey': 'Türkiye',
  'turkiye': 'Türkiye',
  'tr': 'Türkiye',
  'brazil': 'Brazil',
  'br': 'Brazil',
  'india': 'India',
  'in': 'India',
  'eu': 'European Union',
  'european union': 'European Union'
};

/**
 * Normalize country name for database lookup
 */
function normalizeCountryName(country) {
  if (!country) return null;
  const lower = country.toLowerCase().trim();
  return COUNTRY_ALIASES[lower] || country.trim();
}

/**
 * Parse links from various storage formats
 * CountryTradeResource stores links in different formats (array, newline-separated string)
 */
function parseLinks(linksField) {
  if (!linksField) return [];
  
  if (Array.isArray(linksField)) {
    // If array, each element might still contain newline-separated URLs
    const allLinks = [];
    for (const item of linksField) {
      if (typeof item === 'string') {
        // Split by newline and filter valid URLs
        const urls = item.split(/[\n\r]+/)
          .map(u => u.trim())
          .filter(u => u.startsWith('http'));
        allLinks.push(...urls);
      }
    }
    return allLinks;
  }
  
  if (typeof linksField === 'string') {
    return linksField.split(/[\n\r]+/)
      .map(u => u.trim())
      .filter(u => u.startsWith('http'));
  }
  
  return [];
}

/**
 * Fetch country trade resource from database
 * @param {object} base44Client - Initialized Base44 SDK client
 * @param {string} countryName - Country name to look up
 * @returns {object|null} Country trade resource or null if not found
 */
export async function fetchCountryResource(base44Client, countryName) {
  const normalizedName = normalizeCountryName(countryName);
  if (!normalizedName) return null;
  
  try {
    // Try exact match first
    let resources = await base44Client.asServiceRole.entities.CountryTradeResource.filter({
      country_name: normalizedName
    });
    
    // If not found, try case-insensitive partial match
    if (resources.length === 0) {
      const allResources = await base44Client.asServiceRole.entities.CountryTradeResource.list();
      resources = allResources.filter(r => 
        r.country_name?.toLowerCase().includes(normalizedName.toLowerCase()) ||
        normalizedName.toLowerCase().includes(r.country_name?.toLowerCase())
      );
    }
    
    return resources[0] || null;
  } catch (error) {
    console.error(`[ResourceManager] Error fetching country resource for ${countryName}:`, error.message);
    return null;
  }
}

/**
 * Get official source URLs for a specific category
 * @param {object} base44Client - Initialized Base44 SDK client
 * @param {string} countryName - Country name
 * @param {string} category - One of ResourceCategory values
 * @returns {object} Object containing urls array and metadata
 */
export async function fetchOfficialSources(base44Client, countryName, category) {
  const resource = await fetchCountryResource(base44Client, countryName);
  
  if (!resource) {
    return {
      success: false,
      country: countryName,
      category,
      urls: [],
      error: `No trade resource found for country: ${countryName}`,
      metadata: null
    };
  }
  
  const urls = parseLinks(resource[category]);
  
  return {
    success: true,
    country: resource.country_name,
    category,
    urls,
    metadata: {
      hs_structure: resource.hs_structure,
      tax_method: resource.tax_method,
      regional_agreements: resource.regional_agreements
    }
  };
}

/**
 * Get all available source URLs for a country
 * @param {object} base44Client - Initialized Base44 SDK client
 * @param {string} countryName - Country name
 * @returns {object} Complete source map for the country
 */
export async function fetchAllSources(base44Client, countryName) {
  const resource = await fetchCountryResource(base44Client, countryName);
  
  if (!resource) {
    return {
      success: false,
      country: countryName,
      error: `No trade resource found for country: ${countryName}`,
      sources: {}
    };
  }
  
  return {
    success: true,
    country: resource.country_name,
    sources: {
      customs: parseLinks(resource.customs_links),
      regulations: parseLinks(resource.regulation_links),
      trade_agreements: parseLinks(resource.trade_agreements_links),
      government: parseLinks(resource.government_links)
    },
    metadata: {
      hs_structure: resource.hs_structure,
      tax_method: resource.tax_method,
      regional_agreements: resource.regional_agreements
    }
  };
}

/**
 * Determine the best URL to use for tariff lookup based on country
 * @param {object} base44Client - Initialized Base44 SDK client
 * @param {string} countryName - Country name
 * @returns {object} Primary tariff lookup URL and fallbacks
 */
export async function getTariffLookupUrl(base44Client, countryName) {
  const sources = await fetchOfficialSources(base44Client, countryName, ResourceCategory.CUSTOMS);
  
  if (!sources.success || sources.urls.length === 0) {
    return {
      success: false,
      country: countryName,
      primary_url: null,
      fallback_urls: [],
      error: sources.error || 'No customs URLs available'
    };
  }
  
  return {
    success: true,
    country: sources.country,
    primary_url: sources.urls[0],
    fallback_urls: sources.urls.slice(1),
    hs_structure: sources.metadata?.hs_structure,
    tax_method: sources.metadata?.tax_method
  };
}

/**
 * Get regulation/standards URLs for compliance checking
 * @param {object} base44Client - Initialized Base44 SDK client
 * @param {string} countryName - Country name
 * @returns {object} Regulation URLs
 */
export async function getRegulationUrls(base44Client, countryName) {
  const sources = await fetchOfficialSources(base44Client, countryName, ResourceCategory.REGULATIONS);
  
  return {
    success: sources.success,
    country: sources.country || countryName,
    urls: sources.urls,
    error: sources.error
  };
}

/**
 * Get trade agreement URLs for preferential duty analysis
 * @param {object} base44Client - Initialized Base44 SDK client  
 * @param {string} countryName - Country name
 * @returns {object} Trade agreement URLs and regional info
 */
export async function getTradeAgreementSources(base44Client, countryName) {
  const sources = await fetchOfficialSources(base44Client, countryName, ResourceCategory.TRADE_AGREEMENTS);
  
  return {
    success: sources.success,
    country: sources.country || countryName,
    urls: sources.urls,
    regional_agreements: sources.metadata?.regional_agreements,
    error: sources.error
  };
}

/**
 * Validate that a country exists in the knowledge base
 * @param {object} base44Client - Initialized Base44 SDK client
 * @param {string} countryName - Country name to validate
 * @returns {object} Validation result with normalized name
 */
export async function validateCountry(base44Client, countryName) {
  const resource = await fetchCountryResource(base44Client, countryName);
  
  return {
    valid: !!resource,
    original_input: countryName,
    normalized_name: resource?.country_name || null,
    hs_structure: resource?.hs_structure || null
  };
}

/**
 * Get HS code digit structure for a country
 * @param {object} base44Client - Initialized Base44 SDK client
 * @param {string} countryName - Country name
 * @returns {number|null} Number of digits in HS code structure
 */
export async function getHsCodeStructure(base44Client, countryName) {
  const resource = await fetchCountryResource(base44Client, countryName);
  
  if (!resource?.hs_structure) return null;
  
  const digits = parseInt(resource.hs_structure, 10);
  return isNaN(digits) ? null : digits;
}

export default {
  ResourceCategory,
  fetchCountryResource,
  fetchOfficialSources,
  fetchAllSources,
  getTariffLookupUrl,
  getRegulationUrls,
  getTradeAgreementSources,
  validateCountry,
  getHsCodeStructure
};