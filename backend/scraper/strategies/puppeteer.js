const puppeteer = require('puppeteer');

/**
 * Executes a browser-based scraping strategy using Puppeteer to extract real-time gold market data.
 * 
 * Capability Overview:
 * - Orchestrates a Chromium instance in headless mode.
 * - Manages complex, stateful interactions (country selection, AJAX form submissions).
 * - Implements robust heuristic data extraction using DOM traversal and regex matching.
 */
async function scrapeWithPuppeteer(provider) {
  console.log(`[Puppeteer] Initializing market synchronization for ${provider.name}...`);
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // Security: Required for many CI environments including GitHub Actions.
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 1200 });

    console.log(`   Navigating to secure endpoint: ${provider.url}...`);
    
    // Use 'load' event for better stability with Malabar's hybrid hydration
    const navEvent = provider.name.includes('Malabar') ? 'load' : 'domcontentloaded';
    
    try {
        await page.goto(provider.url, { waitUntil: navEvent, timeout: 60000 });
        if (provider.name.includes('Malabar')) {
            // New Malabar page takes a few seconds to hydrate the price table
            await new Promise(r => setTimeout(r, 10000));
        }
    } catch (gotoError) {
        console.warn(`   [Warn] Primary navigation event '${navEvent}' timed out, attempting extraction anyway...`);
    }
    
    // --- 1. Provider-Specific Hydration & Interaction ---
    if (provider.name.includes('Shine')) {
        // Shine requires a significant stabilization period for their pricing table to mount.
        await new Promise(r => setTimeout(r, 10000));
    }

    const prices = await page.evaluate((pName) => {
        const res = {};
        
        /**
         * Cleanses raw string data into a standard numeric format for persistence.
         * @param {string} text - Raw innerText from a DOM node.
         */
        const cleanPrice = (text) => {
            if (!text) return null;
            // Matches numeric components with optional decimals, excluding years like 2026
            const match = text.match(/(\d{2,3}(?:\.\d+)?)/);
            return match ? match[1].replace(/,/g, '') : null;
        };

        // --- STRATEGY: Malabar Gold (Table Row Detection) ---
        if (pName.includes('Malabar')) {
            const rows = Array.from(document.querySelectorAll('tr'));
            const qatarRow = rows.find(r => r.innerText.includes('Qatar') && r.innerText.includes('QAR'));
            if (qatarRow) {
                const cells = Array.from(qatarRow.querySelectorAll('td'));
                // Expected format: [Country, 22K Price, 24K Price, Update Time]
                if (cells.length >= 3) {
                    res['22k'] = cleanPrice(cells[1].innerText);
                    res['24k'] = cleanPrice(cells[2].innerText);
                }
            }
            return res;
        }

        // --- STRATEGY: Shine Jewelers (Table Column Mapping) ---
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
            
            // Failover: Recursive label search if table structure is non-standard
            if (Object.keys(res).length === 0) {
                const all = Array.from(document.querySelectorAll('*')).filter(el => !el.children || el.children.length === 0);
                const findByLabel = (label) => {
                    for (const el of all) {
                        if (el.innerText && el.innerText.toLowerCase().includes(label)) {
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

        // --- STRATEGY: Al Fardan (Label-based extraction) ---
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

        // --- GENERIC FALLBACK (Heuristic search for remaining vendors) ---
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
    console.error(`   [Error] Market synchronization failure: ${err.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeWithPuppeteer };
