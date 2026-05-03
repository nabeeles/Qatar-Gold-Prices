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
     * findPrice (Heuristic Engine)
     * 
     * Robustness:
     * - Uses "Ranged Anchoring": Searches for the price between the current karat 
     *   label and the next logical label to prevent cross-contamination.
     * - Prioritizes market-realistic decimal values.
     */
    const findPrice = (karatLabel, nextKaratLabel = null) => {
        let price = null;
        
        // Define search boundary to avoid picking up the wrong karat's price
        const startIndex = bodyText.indexOf(karatLabel);
        if (startIndex === -1) return null;
        
        const endIndex = nextKaratLabel ? bodyText.indexOf(nextKaratLabel, startIndex) : startIndex + 300;
        const searchArea = bodyText.substring(startIndex, endIndex === -1 ? startIndex + 300 : endIndex);

        // Regex targets values with decimals (e.g., 250.50 or 2,500.00)
        const matches = searchArea.match(/(\d{2,3}\.\d{2})/g) || searchArea.match(/(\d{2,3})/g);
        if (matches) {
            const found = matches.find(n => {
                const val = parseFloat(n);
                return val > 100 && val < 2000;
            });
            if (found) price = found;
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

    // Dynamic Ranged Heuristic Fallback
    if (!results['24k']) {
        results['24k'] = findPrice('24K', '22K') || findPrice('24KT', '22KT') || findPrice('24 Karat', '22 Karat');
    }
    if (!results['22k']) {
        results['22k'] = findPrice('22K', '21K') || findPrice('22KT', '21KT') || findPrice('22 Karat', '21 Karat');
    }
    if (!results['21k']) {
        results['21k'] = findPrice('21K', '18K') || findPrice('21KT', '18KT') || findPrice('21 Karat', '18 Karat');
    }
    if (!results['18k']) {
        results['18k'] = findPrice('18K', '14K') || findPrice('18KT', '14KT') || findPrice('18 Karat', '14 Karat');
    }

    return results;
  } catch (error) {
    console.error(`[Cheerio] Network or validation error for ${provider.name}:`, error.message);
    return null;
  }
}

module.exports = { scrapeWithCheerio };
