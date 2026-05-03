const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Cheerio Scraping Strategy
 * 
 * Capability Overview:
 * Executes high-performance, lightweight HTML parsing for static data sources and 
 * market aggregators. This engine is optimized for stability and speed, serving 
 * as the primary fail-safe for critical retail providers.
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
        
        /**
         * Cleanses raw string data into a standard numeric format.
         */
        const cleanPrice = (text) => {
            if (!text) return null;
            // Normalize: remove commas and handle spaced decimals (e.g., "556 . 00")
            const clean = text.replace(/,/g, '').replace(/\s+\.\s+/g, '.');
            const match = clean.match(/(\d{3,}(?:\.\d+)?)/);
            
            if (match) {
                const val = parseFloat(match[1]);
                if (val > 100 && val < 2000) return match[1];
            }
            return null;
        };

        // Strategy A: Targeted DOM Search
        $(`*:contains("${karatLabel}")`).each((i, el) => {
            if (price) return;
            const contextText = $(el).parent().text() || $(el).text();
            price = cleanPrice(contextText.substring(contextText.indexOf(karatLabel)));
        });

        // Strategy B: Global Stream Scanning
        if (!price) {
            const index = bodyText.indexOf(karatLabel);
            if (index !== -1) {
                price = cleanPrice(bodyText.substring(index));
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
