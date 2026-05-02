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
     */
    const findPrice = (karatLabel) => {
        let price = null;
        
        // Strategy A: Targeted DOM Search
        // We look for the label and then find the *next* numeric value in the same context
        $(`*:contains("${karatLabel}")`).each((i, el) => {
            if (price) return;
            
            // Get text from the element or its parent (wider context)
            const contextText = $(el).parent().text() || $(el).text();
            
            // Capture decimal prices after the label
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

        // Strategy B: Global Stream Scanning
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

    // Specific mapping for goldpriceqatar.com if URL matches
    if (provider.url.includes('goldpriceqatar.com')) {
        const text = $('body').text();
        // The main rate is usually in a clear sentence: "24 Karat Gold is QAR 552.50"
        const match24 = text.match(/24 Karat Gold is QAR\s*(\d+\.\d+)/i) || text.match(/24K.*?QAR\s*(\d+\.\d+)/i);
        const match22 = text.match(/22 Karat Gold is QAR\s*(\d+\.\d+)/i) || text.match(/22K.*?QAR\s*(\d+\.\d+)/i);
        
        if (match24) results['24k'] = match24[1];
        if (match22) results['22k'] = match22[1];
    }

    // Fallback to heuristic if specific mapping failed
    if (!results['24k']) results['24k'] = findPrice('24K') || findPrice('24 KT');
    if (!results['22k']) results['22k'] = findPrice('22K') || findPrice('22 KT');

    return results;
  } catch (error) {
    console.error(`[Cheerio] Validation error for ${provider.name}:`, error.message);
    return null;
  }
}

module.exports = { scrapeWithCheerio };
