const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Cheerio Scraping Strategy
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
        
        const windowSize = 300;
        const searchArea = bodyText.substring(startIndex, startIndex + windowSize);

        const matches = searchArea.match(/(\d{3,}\.\d{2})/g) || searchArea.match(/(\d{3,})/g);
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
     * Brand-Specific Mapping (Malabar, etc.)
     */
    if (provider.name.includes('Malabar')) {
        const malabarMatch = bodyText.match(/Malabar is\s*(\d+\.\d+)/i);
        if (malabarMatch) {
            results['24k'] = malabarMatch[1];
            // 22k is usually ~92% of 24k, but we'll try to find it in the text
            const m22 = bodyText.match(/22 Karat Gold is QAR\s*(\d+\.\d+)/i);
            if (m22) results['22k'] = m22[1];
        }
    }

    // Dynamic Heuristic with Uniqueness check
    const used = [];
    if (!results['24k']) {
        results['24k'] = findPrice('24K', used) || findPrice('24KT', used);
        if (results['24k']) used.push(results['24k']);
    }
    if (!results['22k']) {
        results['22k'] = findPrice('22K', used) || findPrice('22KT', used);
        if (results['22k']) used.push(results['22k']);
    }
    if (!results['18k']) {
        results['18k'] = findPrice('18K', used) || findPrice('18KT', used);
    }

    return results;
  } catch (error) {
    console.error(`[Cheerio] Network or validation error for ${provider.name}:`, error.message);
    return null;
  }
}

module.exports = { scrapeWithCheerio };
