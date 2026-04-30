const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrapes gold prices using a static HTML parsing strategy with Cheerio.
 * 
 * Orchestration Flow:
 * 1. Executes an HTTP GET request to the provider URL.
 * 2. Parses the resulting HTML into a traversable DOM.
 * 3. Identifies pricing components using a multi-strategy heuristic.
 * 
 * @async
 * @function scrapeWithCheerio
 * @param {Object} provider - Metadata for the retail or aggregator source.
 * @returns {Promise<Object|null>} - Returns found prices or null on network/validation failure.
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
     * Heuristic Engine: Finds numeric price values associated with a karat label.
     * @param {string} karatLabel - The target karat string (e.g., '24K').
     */
    const findPrice = (karatLabel) => {
        let price = null;
        
        // Strategy A: DOM Proximity Search
        $(`*:contains("${karatLabel}")`).each((i, el) => {
            if (price) return;
            const text = $(el).text();
            const numbers = text.match(/(\d{3,}(?:\.\d+)?)/g);
            if (numbers) {
                if (text.includes('QAR') || text.includes('﷼') || text.includes('Rate')) {
                    const karatNum = karatLabel.match(/\d+/)[0];
                    const found = numbers.find(n => n !== karatNum);
                    if (found) price = found;
                }
            }
        });

        // Strategy B: Global Stream Scanning (Next logical number)
        if (!price) {
            const index = bodyText.indexOf(karatLabel);
            if (index !== -1) {
                const afterText = bodyText.substring(index, index + 100);
                const match = afterText.match(/(\d{3,}(?:\.\d+)?)/);
                if (match) price = match[1];
            }
        }

        // Strategy C: Exact RegEx Fallback
        if (!price) {
            const regex = new RegExp(`${karatLabel}\\s*\\/g\\s*[^\\d]*(\\d+(?:\\.\\d+)?)`, 'i');
            const match = bodyText.match(regex);
            if (match) price = match[1];
        }

        return price;
    };

    if (provider.selectors['24k']) results['24k'] = findPrice(provider.selectors['24k']);
    if (provider.selectors['22k']) results['22k'] = findPrice(provider.selectors['22k']);

    return results;
  } catch (error) {
    console.error(`[Cheerio] Validation error for ${provider.name}:`, error.message);
    return null;
  }
}

module.exports = { scrapeWithCheerio };
