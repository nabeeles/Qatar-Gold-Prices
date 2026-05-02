const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrapes gold prices using a static HTML parsing strategy with Cheerio.
 * 
 * Orchestration Flow:
 * 1. Executes an HTTP GET request to the provider URL.
 * 2. Parses the resulting HTML into a traversable DOM.
 * 3. Identifies pricing components using a multi-strategy heuristic.
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
     * Skips values that look like years (e.g., 2026) to ensure accuracy.
     */
    const findPrice = (karatLabel) => {
        let price = null;
        
        // Strategy A: DOM Proximity Search
        $(`*:contains("${karatLabel}")`).each((i, el) => {
            if (price) return;
            const text = $(el).text();
            // Match numbers that are likely gold prices (e.g. 250.50) and not years (2024-2030)
            const numbers = text.match(/(\d{3,}(?:\.\d+)?)/g);
            if (numbers) {
                const found = numbers.find(n => {
                    const val = parseFloat(n);
                    return val > 100 && val < 2000; // Realistic price range for 1g of gold
                });
                if (found) price = found;
            }
        });

        // Strategy B: Global Stream Scanning (Next logical number)
        if (!price) {
            const index = bodyText.indexOf(karatLabel);
            if (index !== -1) {
                const afterText = bodyText.substring(index, index + 200);
                const matches = afterText.match(/(\d{3,}(?:\.\d+)?)/g);
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

    if (provider.selectors['24k']) results['24k'] = findPrice(provider.selectors['24k']);
    if (provider.selectors['22k']) results['22k'] = findPrice(provider.selectors['22k']);

    return results;
  } catch (error) {
    console.error(`[Cheerio] Validation error for ${provider.name}:`, error.message);
    return null;
  }
}

module.exports = { scrapeWithCheerio };
