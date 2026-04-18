const puppeteer = require('puppeteer');

/**
 * Scrapes gold prices using Puppeteer for the specified provider.
 * 
 * Strategy Overview:
 * - Uses a generic Puppeteer instance with headless: true.
 * - Navigates to the provider URL and waits for network stability.
 * - Handles provider-specific interactions (e.g., selecting country QA for Malabar).
 * - Executes an in-page script to extract prices for common gold karats (24k, 22k, 21k, 18k).
 * - Implements specific selectors and parsing logic for known providers:
 *   - Shine Jewelers: Table-based parsing or generic fallback label search.
 *   - Al Fardan: Searches for text matching KARAT labels.
 *   - GoodReturns: Parses an aggregator table for 1g prices.
 *   - Malabar: Targets specific class names for different karats.
 * 
 * @param {Object} provider - Provider details (id, name, url).
 * @returns {Promise<Object|null>} - A mapping of karats to prices (e.g., { '24k': 255.50 }) or null if extraction failed.
 */
async function scrapeWithPuppeteer(provider) {
  console.log(`[Puppeteer] Scraping ${provider.name}...`);
  const browser = await puppeteer.launch({ 
    headless: true,
    args: []
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 1200 });

    console.log(`   Navigating to ${provider.url}...`);
    await page.goto(provider.url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // 1. PROVIDER SPECIFIC INTERACTIONS
    if (provider.name.includes('Malabar')) {
        console.log('   Selecting Qatar for Malabar...');
        await page.select('#gold-country-list', 'QA');
        await page.evaluate(() => {
            const btn = document.querySelector('.gold-rate-btn') || document.querySelector('button.gold-rate-btn');
            if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 12000));
    } 
    else if (provider.name.includes('Shine')) {
        await new Promise(r => setTimeout(r, 10000));
    }
    else {
        await new Promise(r => setTimeout(r, 8000));
    }

    const prices = await page.evaluate((pName) => {
        const res = {};
        
        const cleanPrice = (text) => {
            if (!text) return null;
            // Extract number like 571 or 602.50
            const match = text.match(/(\d{3,}(?:\.\d+)?)/);
            return match ? match[1].replace(/,/g, '') : null;
        };

        // --- STRATEGY: Shine Jewelers ---
        if (pName.includes('Shine')) {
            const rows = Array.from(document.querySelectorAll('tr'));
            const headerRow = rows.find(r => r.innerText.includes('24ct') && r.innerText.includes('22ct'));
            const priceRow = rows.find(r => r.innerText.includes('QAR'));

            if (headerRow && priceRow) {
                const headers = Array.from(headerRow.querySelectorAll('th, td'));
                const pricesCells = Array.from(priceRow.querySelectorAll('th, td'));
                
                headers.forEach((h, i) => {
                    const text = h.innerText.toLowerCase();
                    const p = cleanPrice(pricesCells[i]?.innerText);
                    if (!p) return;
                    if (text.includes('24ct')) res['24k'] = p;
                    else if (text.includes('22ct')) res['22k'] = p;
                    else if (text.includes('21ct')) res['21k'] = p;
                    else if (text.includes('18ct')) res['18k'] = p;
                });
            }
            
            // Fallback for older or different layout
            if (Object.keys(res).length === 0) {
                const all = Array.from(document.querySelectorAll('*')).filter(el => !el.children || el.children.length === 0);
                const findByLabel = (label) => {
                    for (const el of all) {
                        if (el.innerText && el.innerText.toLowerCase().includes(label)) {
                            // Check next element or parent's next element
                            const next = el.nextElementSibling?.innerText || el.parentElement?.nextElementSibling?.innerText;
                            const p = cleanPrice(next);
                            if (p) return p;
                        }
                    }
                    return null;
                };
                res['24k'] = findByLabel('24ct');
                res['22k'] = findByLabel('22ct');
                res['21k'] = findByLabel('21ct');
                res['18k'] = findByLabel('18ct');
            }
            return res;
        }

        // --- STRATEGY: Al Fardan ---
        if (pName.includes('Fardan')) {
            const all = Array.from(document.querySelectorAll('*')).filter(el => !el.children || el.children.length === 0);
            const findGeneric = (label) => {
                for (const el of all) {
                    if (el.innerText && el.innerText.toUpperCase().includes(label)) {
                        const text = el.parentElement ? el.parentElement.innerText : el.innerText;
                        const p = cleanPrice(text);
                        if (p) return p;
                    }
                }
                return null;
            };
            res['24k'] = findGeneric('24 KARAT') || findGeneric('24K');
            res['22k'] = findGeneric('22 KARAT') || findGeneric('22K');
            res['21k'] = findGeneric('21 KARAT') || findGeneric('21K');
            res['18k'] = findGeneric('18 KARAT') || findGeneric('18K');
            return res;
        }

        // --- STRATEGY: GoodReturns ---
        if (pName.includes('GoodReturns')) {
            const rows = Array.from(document.querySelectorAll('tr'));
            const gramRows = rows.filter(r => r.innerText.trim().match(/^1\s?﷼/));
            if (gramRows.length >= 2) {
                res['24k'] = cleanPrice(gramRows[0].innerText.split(/[\t\s]+/)[1]);
                res['22k'] = cleanPrice(gramRows[1].innerText.split(/[\t\s]+/)[1]);
                if (gramRows[2]) res['18k'] = cleanPrice(gramRows[2].innerText.split(/[\t\s]+/)[1]);
            }
            return res;
        }

        // --- STRATEGY: LivePriceOfGold ---
        if (pName.includes('LivePrice')) {
            const rows = Array.from(document.querySelectorAll('tr'));
            for (const row of rows) {
                const rowText = row.innerText.trim();
                if (rowText.includes('Gold/gram')) {
                    const parts = rowText.split(/\s+/).filter(p => p.length > 0);
                    const price = cleanPrice(parts[3]);
                    if (!price) continue;
                    if (rowText.includes('24K')) res['24k'] = price;
                    else if (rowText.includes('22K')) res['22k'] = price;
                    else if (rowText.includes('21K')) res['21k'] = price;
                    else if (rowText.includes('18K')) res['18k'] = price;
                }
            }
            return res;
        }

        // --- STRATEGY: Malabar ---
        if (pName.includes('Malabar')) {
            const p24 = document.querySelector('[class*="24kt-price"]');
            const p22 = document.querySelector('[class*="22kt-price"]');
            const p18 = document.querySelector('[class*="18kt-price"]');
            if (p24 && !p24.innerText.includes('INR')) res['24k'] = cleanPrice(p24.innerText);
            if (p22 && !p22.innerText.includes('INR')) res['22k'] = cleanPrice(p22.innerText);
            if (p18 && !p18.innerText.includes('INR')) res['18k'] = cleanPrice(p18.innerText);
            return res;
        }

        // --- GENERIC FALLBACK (Joyalukkas) ---
        const all = Array.from(document.querySelectorAll('*')).filter(el => !el.children || el.children.length === 0);
        const findGeneric = (label) => {
            for (const el of all) {
                if (el.innerText && el.innerText.toUpperCase().includes(label)) {
                    const text = el.parentElement ? el.parentElement.innerText : el.innerText;
                    const p = cleanPrice(text);
                    if (p) return p;
                }
            }
            return null;
        };
        res['24k'] = findGeneric('24K') || findGeneric('24 KARAT');
        res['22k'] = findGeneric('22K') || findGeneric('22 KARAT');
        res['21k'] = findGeneric('21K') || findGeneric('21 KARAT');
        res['18k'] = findGeneric('18K') || findGeneric('18 KARAT');

        return res;
    }, provider.name);

    return prices;

  } catch (err) {
    console.error(`   [Error] ${err.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeWithPuppeteer };
