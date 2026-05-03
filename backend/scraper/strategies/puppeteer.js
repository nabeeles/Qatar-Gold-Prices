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
    
    // Use 'load' event for better stability with Malabar's hybrid hydration
    const navEvent = provider.name.includes('Malabar') || provider.name.includes('Shine') ? 'load' : 'domcontentloaded';
    
    try {
        await page.goto(provider.url, { waitUntil: navEvent, timeout: 90000 });
        
        if (provider.name.includes('Malabar')) {
            await new Promise(r => setTimeout(r, 15000));
        } else if (provider.name.includes('Joyalukkas')) {
            // Joyalukkas needs explicit selector wait for pricing table
            await page.waitForSelector('body', { timeout: 10000 });
            await new Promise(r => setTimeout(r, 8000));
        } else if (provider.name.includes('Shine')) {
            await new Promise(r => setTimeout(r, 12000));
        }
    } catch (gotoError) {
        console.warn(`   [Warn] Primary navigation event '${navEvent}' for ${provider.name} timed out, attempting extraction anyway...`);
    }
    
    // --- Provider-Specific Stabilization ---
    if (provider.name.includes('Shine')) {
        await new Promise(r => setTimeout(r, 10000));
    }

    const prices = await page.evaluate((pName) => {
        const res = {};
        const bodyText = document.body.innerText.replace(/\s+/g, ' ');
        
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

        /**
         * findPrice (Heuristic Engine)
         */
        const findPrice = (karatLabel, assignedPrices = []) => {
            const index = bodyText.indexOf(karatLabel);
            if (index === -1) return null;
            
            const searchArea = bodyText.substring(index, index + 200);
            const matches = searchArea.match(/(\d{3,}(?:\.\d+)?)/g);
            
            if (matches) {
                const found = matches.find(n => {
                    const cleanN = n.replace(/,/g, '').replace(/\s+\.\s+/g, '.');
                    const val = parseFloat(cleanN);
                    return val > 100 && val < 2000 && !assignedPrices.includes(cleanN);
                });
                return found ? found.replace(/,/g, '').replace(/\s+\.\s+/g, '.') : null;
            }
            return null;
        };

        // --- STRATEGY: Malabar Gold (Table Row Extraction) ---
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

        // --- STRATEGY: Dynamic Heuristic (Joyalukkas, Shine, etc.) ---
        const used = [];
        const k24 = findPrice('24K', used) || findPrice('24KT', used) || findPrice('24 Karat', used);
        if (k24) { res['24k'] = k24; used.push(k24); }
        
        const k22 = findPrice('22K', used) || findPrice('22KT', used) || findPrice('22 Karat', used);
        if (k22) { res['22k'] = k22; used.push(k22); }
        
        const k21 = findPrice('21K', used) || findPrice('21KT', used) || findPrice('21 Karat', used);
        if (k21) { res['21k'] = k21; used.push(k21); }
        
        const k18 = findPrice('18K', used) || findPrice('18KT', used) || findPrice('18 Karat', used);
        if (k18) { res['18k'] = k18; }

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
