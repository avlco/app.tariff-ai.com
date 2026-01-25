/**
 * Cache Utility for Web Scraper
 * In-memory caching for scraped content to reduce redundant network calls
 */

const cache = new Map();

export function set(key, value, ttlMs = 3600000) { // Default TTL: 1 hour
  cache.set(key, {
    value,
    expires: Date.now() + ttlMs
  });
}

export function get(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

export const CACHE_KEYS = {
  TARIFF: (country, hs) => `tariff:${country}:${hs}`,
  EN: (hs) => `en:${hs.substring(0, 4)}`,
  BTI: (query) => `bti:${query.substring(0, 30)}`,
  WEBSCRAPE_URL: (url) => `webscrape:${url}`
};

export const CACHE_TTL = {
  TARIFF: 24 * 60 * 60 * 1000,  // 1 day
  EN: 30 * 24 * 60 * 60 * 1000, // 30 days
  BTI: 7 * 24 * 60 * 60 * 1000,  // 7 days
  WEBSCRAPE_URL: 1 * 60 * 60 * 1000 // 1 hour
};