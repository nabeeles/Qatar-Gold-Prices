const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Cheerio Scraping Strategy
 * 
 * Optimized for high-fidelity extraction from market aggregator homes.
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
    const findPrice = (karatLabel, assignedPrices = []) => {
        let price = null;
        const startIndex = bodyText.indexOf(karatLabel);
        if (startIndex === -1) return null;
        
        const searchArea = bodyText.substring(startIndex, startIndex + 150);
        const matches = searchArea.match(/(\d{3,}\.\d{2})/g);
        
        if (matches) {
            const found = matches.find(n => {
                const val = parseFloat(n);
                return val > 300 && val < 1000 && !assignedPrices.includes(n);
            });
            if (found) price = found;
        }
        return price;
    };

    /**
     * Brand-Specific High-Fidelity Mapping
     */
    const name = provider.name.toLowerCase();
    
    // Malabar specific pattern: "The gold rate in Qatar in Malabar is 552.50"
    if (name.includes('malabar')) {
        const match = bodyText.match(/Malabar is\s*(\d+\.\d{2})/i);
        if (match) results['24k'] = match[1];
    }
    
    // Joyalukkas specific pattern
    if (name.includes('joyalukkas')) {
        const match = bodyText.match(/Joyalukkas is\s*(\d+\.\d{2})/i);
        if (match) results['24k'] = match[1];
    }

    // Al Fardan specific pattern
    if (name.includes('fardan')) {
        const match = bodyText.match(/Al Fardan is\s*(\d+\.\d{2})/i);
        if (match) results['24k'] = match[1];
    }

    // Shine specific pattern
    if (name.includes('shine')) {
        const match = bodyText.match(/Shine is\s*(\d+\.\d{2})/i);
        if (match) results['24k'] = match[1];
    }

    // Apply General Heuristic for all categories (24k, 22k, 18k)
    const used = Object.values(results).filter(v => !!v);
    if (!results['24k']) {
        results['24k'] = findPrice('24K', used) || findPrice('24KT', used) || findPrice('24 Karat', used);
        if (results['24k']) used.push(results['24k']);
    }
    
    if (!results['22k']) {
        results['22k'] = findPrice('22K', used) || findPrice('22KT', used) || findPrice('22 Karat', used);
        if (results['22k']) used.push(results['22k']);
    }
    
    if (!results['18k']) {
        results['18k'] = findPrice('18K', used) || findPrice('18KT', used) || findPrice('18 Karat', used);
    }

    return results;
  } catch (error) {
    console.error(`[Cheerio] Network or validation error for ${provider.name}:`, error.message);
    return null;
  }
}

module.exports = { scrapeWithCheerio };
