const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrapes gold prices using a static HTML parsing strategy with Cheerio.
 * 
 * Orchestration Flow:
 * 1. Executes an HTTP GET request to the provider URL with professional browser headers.
 * 2. Loads the response body into a Cheerio (jQuery-like) instance.
 * 3. Primary Discovery: Iterates through table rows (<tr>) to find labels matching the karat selectors.
 * 4. Secondary Fallback: If table extraction fails, executes a Regular Expression match on the normalized body text.
 * 
 * @async
 * @function scrapeWithCheerio
 * @param {Object} provider - The data provider configuration object.
 * @param {string} provider.name - Name of the retail provider.
 * @param {string} provider.url - Target URL for price extraction.
 * @param {Object} provider.selectors - Key-value pairs for karat-specific search terms.
 * @returns {Promise<Object|null>} - Returns a mapping of karats to prices or null if an error occurs.
 * @throws {Error} - Propagates network or parsing exceptions with detailed logs.
 */
async function scrapeWithCheerio(provider) {
  console.log(`[Cheerio] Synchronizing market data for ${provider.name}...`);
  
  try {
    const { data } = await axios.get(provider.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      timeout: 30000
    });

    const $ = cheerio.load(data);
    const results = {};
    const bodyText = $('body').text().replace(/\s+/g, ' ');

    /**
     * Internal utility to isolate prices from unstructured text or table data.
     * @param {string} karatLabel - The label to search for (e.g., "24k").
     */
    const findPrice = (karatLabel) => {
        let price = null;
        
        // Strategy A: Targeted Table Row Search
        $('tr').each((i, row) => {
            const rowText = $(row).text();
            if (rowText.includes(karatLabel)) {
                const numbers = rowText.match(/\d+(?:\.\d+)?/g);
                if (numbers) {
                    // Filter out the karat number itself to identify the price component
                    const karatNum = karatLabel.match(/\d+/)[0];
                    const found = numbers.find(n => n !== karatNum);
                    if (found) price = found;
                }
            }
        });

        // Strategy B: Heuristic Body Text Regex Fallback
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
