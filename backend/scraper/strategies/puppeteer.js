const puppeteer = require('puppeteer');

/**
 * Puppeteer Scraping Strategy
 * 
 * Capability Overview:
 * Orchestrates a Chromium instance in headless mode to handle dynamic, 
 * stateful, or heavily hydrated retail websites. This engine is the primary 
 * choice for providers requiring regional selection or DOM-resident price tables.
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
    
    // Using 'load' event for maximum visibility of dynamic elements
    const navEvent = 'load';
    
    try {
        await page.goto(provider.url, { waitUntil: navEvent, timeout: 90000 });
        
        // Stabilization debounce
        const waitTime = provider.name.includes('Malabar') ? 15000 : 8000;
        await new Promise(r => setTimeout(r, waitTime));
    } catch (gotoError) {
        console.warn(`   [Warn] Primary navigation event '${navEvent}' for ${provider.name} timed out, attempting extraction anyway...`);
    }

    const prices = await page.evaluate((pName) => {
        const res = {};
        if (!document.body) return null;
        
        const bodyText = document.body.innerText.replace(/\s+/g, ' ');
        
        /**
         * Cleanses raw string data into a standard numeric format.
         */
        const cleanPrice = (text) => {
            if (!text) return null;
            const clean = text.replace(/,/g, '').replace(/\s+\.\s+/g, '.');
            const match = clean.match(/(\d{3,}(?:\.\d+)?)/);
            if (match) {
                const val = parseFloat(match[1]);
                if (val > 300 && val < 1000) return match[1];
            }
            return null;
        };

        /**
         * findPrice (Heuristic Engine)
         */
        const findPrice = (karatLabel, assignedPrices = []) => {
            const index = bodyText.indexOf(karatLabel);
            if (index === -1) return null;
            
            const searchArea = bodyText.substring(index, index + 300);
            const matches = searchArea.match(/(\d{3,}(?:\.\d+)?)/g);
            
            if (matches) {
                const found = matches.find(n => {
                    const cleanN = n.replace(/,/g, '').replace(/\s+\.\s+/g, '.');
                    const val = parseFloat(cleanN);
                    // Standard retail range for Qatar currently
                    return val > 300 && val < 1000 && !assignedPrices.includes(cleanN);
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
                    const p22 = cleanPrice(cells[1].innerText);
                    const p24 = cleanPrice(cells[2].innerText);
                    if (p22) res['22k'] = p22;
                    if (p24) res['24k'] = p24;
                    return res;
                }
            }
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
    console.error(`   [Puppeteer] Critical synchronization failure for ${provider.name}: ${err.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeWithPuppeteer };
