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
     */
    const findPrice = (karatLabel, nextKaratLabel = null, assignedPrices = []) => {
        let price = null;
        
        const startIndex = bodyText.indexOf(karatLabel);
        if (startIndex === -1) return null;
        
        // Search in a narrow 150-char window AFTER the label
        const windowSize = 150;
        const searchArea = bodyText.substring(startIndex, startIndex + windowSize);

        const matches = searchArea.match(/(\d{2,3}\.\d{2})/g) || searchArea.match(/(\d{2,3})/g);
        if (matches) {
            // Find the first valid price that isn't already assigned to a higher karat
            const found = matches.find(n => {
                const val = parseFloat(n);
                return val > 100 && val < 2000 && !assignedPrices.includes(n);
            });
            if (found) price = found;
        }

        return price;
    };

    /**
     * Aggregator-Specific Mapping
     */
    if (provider.url.includes('goldpriceqatar.com')) {
        const text = $('body').text();
        const match24 = text.match(/24 Karat Gold is QAR\s*(\d+\.\d+)/i);
        const match22 = text.match(/22 Karat Gold is QAR\s*(\d+\.\d+)/i);
        const match18 = text.match(/18 Karat Gold is QAR\s*(\d+\.\d+)/i);
        
        if (match24) results['24k'] = match24[1];
        if (match22) results['22k'] = match22[1];
        if (match18) results['18k'] = match18[1];
    }

    // Dynamic Heuristic with Uniqueness check
    const used = [];
    if (!results['24k']) {
        results['24k'] = findPrice('24K', null, used) || findPrice('24KT', null, used);
        if (results['24k']) used.push(results['24k']);
    }
    if (!results['22k']) {
        results['22k'] = findPrice('22K', null, used) || findPrice('22KT', null, used);
        if (results['22k']) used.push(results['22k']);
    }
    if (!results['18k']) {
        results['18k'] = findPrice('18K', null, used) || findPrice('18KT', null, used);
    }

    return results;
  } catch (error) {
    console.error(`[Cheerio] Network or validation error for ${provider.name}:`, error.message);
    return null;
  }
}

module.exports = { scrapeWithCheerio };
