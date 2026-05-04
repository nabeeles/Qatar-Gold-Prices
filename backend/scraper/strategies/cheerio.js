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
    
    // Clean up HTML: Remove scripts, styles, and other non-text elements
    $('script, style, noscript, iframe, .adsbygoogle').remove();
    
    const results = {};
    const bodyText = $('body').text().replace(/\s+/g, ' ');

    /**
     * DOM-Specific Strategy: goldpriceqatar.com (Primary Aggregator)
     */
    if (provider.url.includes('goldpriceqatar.com')) {
        console.log('   [Aggregator] Applying high-fidelity table extraction for goldpriceqatar.com...');
        $('tr').each((i, row) => {
            const text = $(row).text().replace(/\s+/g, ' ');
            const cells = $(row).find('td');
            
            if (text.includes('1 Gram') && cells.length >= 3) {
                const p22 = $(cells[1]).text().replace(/[^0-9.]/g, '');
                const p24 = $(cells[2]).text().replace(/[^0-9.]/g, '');
                if (parseFloat(p22) > 300) results['22k'] = p22;
                if (parseFloat(p24) > 300) results['24k'] = p24;
            }
            
            if (text.includes('18K Gold') && cells.length >= 2) {
                const p18 = $(cells[1]).text().replace(/[^0-9.]/g, '');
                if (parseFloat(p18) > 300) results['18k'] = p18;
            }
            if (text.includes('21K Gold') && cells.length >= 2) {
                const p21 = $(cells[1]).text().replace(/[^0-9.]/g, '');
                if (parseFloat(p21) > 300) results['21k'] = p21;
            }
        });
        
        if (Object.keys(results).length > 0) return results;
    }

    /**
     * DOM-Specific Strategy: livepriceofgold.com
     */
    if (provider.url.includes('livepriceofgold.com')) {
        console.log('   [Aggregator] Applying high-fidelity table extraction for livepriceofgold.com...');
        $('tr').each((i, row) => {
            const text = $(row).text().toUpperCase();
            const cells = $(row).find('td');
            if (cells.length >= 2) {
                const price = $(cells[1]).text().trim().replace(/,/g, '');
                const val = parseFloat(price);
                if (val > 300 && val < 1000) {
                    if (text.includes('24K')) results['24k'] = price;
                    else if (text.includes('22K')) results['22k'] = price;
                    else if (text.includes('21K')) results['21k'] = price;
                    else if (text.includes('18K')) results['18k'] = price;
                }
            }
        });
        if (Object.keys(results).length > 0) return results;
    }

    /**
     * findPrice (Heuristic Engine)
     */
    const findPrice = (karatLabel, assignedPrices = []) => {
        let price = null;
        const startIndex = bodyText.indexOf(karatLabel);
        if (startIndex === -1) return null;
        
        const windowSize = 300;
        const searchArea = bodyText.substring(startIndex, startIndex + windowSize);

        const matches = searchArea.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g);
        
        if (matches) {
            const candidates = matches
                .map(n => n.replace(/,/g, ''))
                .filter(n => {
                    const val = parseFloat(n);
                    return val > 300 && val < 1000 && !assignedPrices.includes(n);
                });

            if (candidates.length > 0) {
                price = candidates[0];
            }
        }
        return price;
    };

    /**
     * Brand-Specific High-Fidelity Mapping
     */
    const name = provider.name.toLowerCase();
    const brandPattern = new RegExp(`${provider.name.split(' ')[0]} is\\s*(\\d+(?:\\.\\d{1,2})?)`, 'i');
    const match = bodyText.match(brandPattern);
    if (match) {
        results['24k'] = match[1];
    }

    // Apply General Heuristic for all categories (24k, 22k, 18k)
    const used = Object.values(results).filter(v => !!v);
    
    if (!results['24k']) {
        results['24k'] = findPrice('24 Karat', used) || findPrice('24KT', used) || findPrice('24K', used) || findPrice('24ct', used);
        if (results['24k']) used.push(results['24k']);
    }
    
    if (!results['22k']) {
        results['22k'] = findPrice('22 Karat', used) || findPrice('22KT', used) || findPrice('22K', used) || findPrice('22ct', used);
        if (results['22k']) used.push(results['22k']);
    }
    
    if (!results['21k']) {
        results['21k'] = findPrice('21 Karat', used) || findPrice('21KT', used) || findPrice('21K', used) || findPrice('21ct', used);
        if (results['21k']) used.push(results['21k']);
    }

    if (!results['18k']) {
        results['18k'] = findPrice('18 Karat', used) || findPrice('18KT', used) || findPrice('18K', used) || findPrice('18ct', used);
    }

    return results;
  } catch (error) {
    console.error(`[Cheerio] Network or validation error for ${provider.name}:`, error.message);
    return null;
  }
}

module.exports = { scrapeWithCheerio };
