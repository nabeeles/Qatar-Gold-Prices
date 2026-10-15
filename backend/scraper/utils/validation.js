const VALID_KARATS = new Set([24, 22, 21, 18]);
const MIN_VALID_PRICE = 100;
const MAX_VALID_PRICE = 2000;

/**
 * Checks whether a numeric QAR/g gold price falls within the plausible range [100, 2000].
 */
function isValidGoldPrice(price) {
  const num = Number(price);
  return Number.isFinite(num) && num >= MIN_VALID_PRICE && num <= MAX_VALID_PRICE;
}

/**
 * Filters and normalizes an array of scraped provider price records, keeping only valid karats
 * (24, 22, 21, 18) and plausible QAR/g prices, and rejecting inverted karat hierarchies
 * where a lower karat exceeds a higher karat's price.
 */
function validateProviderPrices(prices) {
  if (!Array.isArray(prices)) return [];
  const seenKarats = new Set();
  const valid = [];

  for (const item of prices) {
    if (!item) continue;
    const karat = Number(item.karat);
    const price = Number(item.price_per_gram ?? item.price);
    if (!VALID_KARATS.has(karat)) continue;
    if (!isValidGoldPrice(price)) continue;
    if (seenKarats.has(karat)) continue;
    seenKarats.add(karat);
    valid.push({
      ...item,
      karat,
      price_per_gram: Number(price.toFixed(2)),
      currency: item.currency || 'QAR',
    });
  }

  valid.sort((a, b) => b.karat - a.karat);
  for (let i = 1; i < valid.length; i++) {
    if (valid[i].price_per_gram > valid[i - 1].price_per_gram) {
      return [];
    }
  }

  return valid;
}

/**
 * Normalizes a strategy result map (e.g., { '24k': '325.5', '22k': '302.1' }),
 * filtering out invalid karats or out-of-range prices, formatting values to 2 decimals,
 * and rejecting inverted karat hierarchies (e.g., 22k > 24k).
 */
function normalizePriceMap(priceMap) {
  if (!priceMap || typeof priceMap !== 'object' || Array.isArray(priceMap)) {
    return {};
  }
  const entries = [];
  for (const [key, rawVal] of Object.entries(priceMap)) {
    const match = key.match(/^(\d+)k$/i);
    if (!match) continue;
    const karat = Number(match[1]);
    if (!VALID_KARATS.has(karat)) continue;
    const cleaned = typeof rawVal === 'string' ? rawVal.replace(/,/g, '').trim() : rawVal;
    const num = Number(cleaned);
    if (!isValidGoldPrice(num)) continue;
    entries.push({ karat, price_per_gram: num });
  }

  const validated = validateProviderPrices(entries);
  const normalized = {};
  for (const item of validated) {
    normalized[`${item.karat}k`] = item.price_per_gram.toFixed(2);
  }
  return normalized;
}

/**
 * Returns true if primary extraction failed or returned partial data missing 24K or 22K.
 * Supports both array-of-objects and strategy price maps ({ '24k': ..., '22k': ... }).
 */
function isFallbackEligible(prices) {
  if (!prices) return true;
  if (Array.isArray(prices)) {
    const valid = validateProviderPrices(prices);
    if (valid.length === 0) return true;
    const karats = new Set(valid.map((p) => p.karat));
    return !karats.has(24) || !karats.has(22);
  }
  const normalized = normalizePriceMap(prices);
  return !normalized['24k'] || !normalized['22k'];
}

/**
 * Formats a price to strictly two decimal places for push notifications and logs.
 */
function formatAlertPrice(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(2);
}

module.exports = {
  VALID_KARATS,
  MIN_VALID_PRICE,
  MAX_VALID_PRICE,
  isValidGoldPrice,
  validateProviderPrices,
  normalizePriceMap,
  isFallbackEligible,
  formatAlertPrice,
};
