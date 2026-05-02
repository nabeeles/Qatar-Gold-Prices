const puppeteer = require('puppeteer');

/**
 * Puppeteer Scraping Strategy
 * 
 * Capability Overview:
 * Orchestrates a Chromium instance in headless mode to handle dynamic, 
 * stateful, or heavily hydrated retail websites. This engine is the primary 
 * choice for providers requiring regional selection or DOM-resident price tables.
 * 
 * Interaction Lifecycle:
 * 1. LAUNCH: Starts a sandboxed browser instance with no-sandbox flags for CI safety.
 * 2. NAVIGATE: Visits the secure endpoint with custom User-Agent and viewport.
 * 3. HYDRATE: Implements provider-specific wait periods for AJAX/React mounting.
 * 4. EXTRACT: Executes in-browser JS to parse structured DOM elements.
 */
async function scrapeWithPuppeteer(provider) {
  console.log(`[Puppeteer] Initializing market synchronization for ${provider.name}...`);
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 1200 });

    console.log(`   Navigating to secure endpoint: ${provider.url}...`);
    
    // Malabar's new stores page requires 'load' event for the pricing table to appear reliably
    const navEvent = provider.name.includes('Malabar') ? 'load' : 'domcontentloaded';
    
    try {
        await page.goto(provider.url, { waitUntil: navEvent, timeout: 60000 });
        if (provider.name.includes('Malabar')) {
            // Explicit debounce for table hydration
            await new Promise(r => setTimeout(r, 10000));
        }
    } catch (gotoError) {
        console.warn(`   [Warn] Primary navigation event '${navEvent}' timed out, attempting extraction anyway...`);
    }
    
    // --- Provider-Specific Stabilization ---
    if (provider.name.includes('Shine')) {
        await new Promise(r => setTimeout(r, 10000));
    }

    const prices = await page.evaluate((pName) => {
        const res = {};
        
        /**
         * Cleanses raw string data into a standard numeric format.
         */
        const cleanPrice = (text) => {
            if (!text) return null;
            const match = text.match(/(\d{2,3}(?:\.\d+)?)/);
            return match ? match[1].replace(/,/g, '') : null;
        };

        // --- STRATEGY: Malabar Gold (Table Row Extraction) ---
        // New structure targets the Qatar-specific row in the global rates table.
        if (pName.includes('Malabar')) {
            const rows = Array.from(document.querySelectorAll('tr'));
            const qatarRow = rows.find(r => r.innerText.includes('Qatar') && r.innerText.includes('QAR'));
            if (qatarRow) {
                const cells = Array.from(qatarRow.querySelectorAll('td'));
                if (cells.length >= 3) {
                    res['22k'] = cleanPrice(cells[1].innerText);
                    res['24k'] = cleanPrice(cells[2].innerText);
                }
            }
            return res;
        }

        // --- STRATEGY: Shine Jewelers (Tabular Index Mapping) ---
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
            return res;
        }

        // --- STRATEGY: Heuristic Fallback (Label Anchoring) ---
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
    console.error(`   [Puppeteer] Critical synchronization failure: ${err.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeWithPuppeteer };
