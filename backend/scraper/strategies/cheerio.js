const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Cheerio Scraping Strategy
 * 
 * Capability Overview:
 * Executes high-performance, lightweight HTML parsing for static data sources and 
 * market aggregators. This engine is optimized for stability and speed, serving 
 * as the primary fail-safe for critical retail providers.
 * 
 * Orchestration Flow:
 * 1. GET: Retrieves the raw HTML document via Axios with browser-spoofing headers.
 * 2. DOM: Loads the document into a traversable Cheerio object.
 * 3. SCAN: Applies multi-stage heuristic analysis to identify pricing components.
 */
async function scrapeWithCheerio(provider) {
  try {
    console.log(`[Cheerio] Synchronizing market data for ${provider.name}...`);
    const { data: html } = await axios.get(provider.url, {
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
    });
    
    const $ = cheerio.load(html);
    const results = {};
    const bodyText = $('body').text().replace(/\s+/g, ' ');

    /**
     * findPrice (Heuristic Engine)
     * 
     * Identifies numeric gold rates by scanning for "Karat Anchors" and evaluating 
     * the immediate textual surroundings.
     * 
     * Filtering Logic:
     * - Decimals Required: Targets high-precision strings (e.g., 552.50) to ignore 
     *   integer counts (like "380 stores") or years (e.g., "2026").
     * - Market Range: Validates that the price is between 100 and 2000 QAR/gram.
     */
    const findPrice = (karatLabel) => {
        let price = null;
        
        // Strategy A: Contextual DOM Proximity
        // Look for the label and scan the immediate parent's text for decimal values.
        $(`*:contains("${karatLabel}")`).each((i, el) => {
            if (price) return;
            const contextText = $(el).parent().text() || $(el).text();
            const labelIndex = contextText.indexOf(karatLabel);
            if (labelIndex !== -1) {
                const searchArea = contextText.substring(labelIndex, labelIndex + 150);
                const matches = searchArea.match(/(\d{2,3}\.\d{2})/g);
                if (matches) {
                    const found = matches.find(n => {
                        const val = parseFloat(n);
                        return val > 100 && val < 2000;
                    });
                    if (found) price = found;
                }
            }
        });

        // Strategy B: Global Body Stream Scanning
        // Fallback for non-standard or fragmented HTML layouts.
        if (!price) {
            const index = bodyText.indexOf(karatLabel);
            if (index !== -1) {
                const afterText = bodyText.substring(index, index + 200);
                const matches = afterText.match(/(\d{2,3}\.\d{2})/g);
                if (matches) {
                    const found = matches.find(n => {
                        const val = parseFloat(n);
                        return val > 100 && val < 2000;
                    });
                    if (found) price = found;
                }
            }
        }

        return price;
    };

    /**
     * Aggregator-Specific Mapping
     * Explicit logic for goldpriceqatar.com to ensure 100% extraction fidelity.
     */
    if (provider.url.includes('goldpriceqatar.com')) {
        const text = $('body').text();
        const match24 = text.match(/24 Karat Gold is QAR\s*(\d+\.\d+)/i) || text.match(/24K.*?QAR\s*(\d+\.\d+)/i);
        const match22 = text.match(/22 Karat Gold is QAR\s*(\d+\.\d+)/i) || text.match(/22K.*?QAR\s*(\d+\.\d+)/i);
        
        if (match24) results['24k'] = match24[1];
        if (match22) results['22k'] = match22[1];
    }

    // Dynamic Heuristic Fallback
    if (!results['24k']) results['24k'] = findPrice('24K') || findPrice('24 KT');
    if (!results['22k']) results['22k'] = findPrice('22K') || findPrice('22 KT');

    return results;
  } catch (error) {
    console.error(`[Cheerio] Network or validation error for ${provider.name}:`, error.message);
    return null;
  }
}

module.exports = { scrapeWithCheerio };
