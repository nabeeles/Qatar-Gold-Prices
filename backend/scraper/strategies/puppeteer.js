const puppeteer = require('puppeteer');

/**
 * Puppeteer Scraping Strategy
 */
async function scrapeWithPuppeteer(provider) {
  console.log(`[Puppeteer] Initializing market synchronization for ${provider.name}...`);
  
  const launchOptions = {
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    console.log(`   [Info] Using custom browser path: ${launchOptions.executablePath}`);
  }

  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 1200 });

    console.log(`   Navigating to secure endpoint: ${provider.url}...`);
    
    try {
        const response = await page.goto(provider.url, { waitUntil: 'load', timeout: 90000 });
        if (response && response.status() >= 400) {
            console.warn(`   [Warn] Navigation to ${provider.name} returned status ${response.status()}`);
        }
        
        // Stabilization debounce
        const waitTime = provider.name.includes('Malabar') ? 25000 : 10000;
        await new Promise(r => setTimeout(r, waitTime));
    } catch (gotoError) {
        console.warn(`   [Warn] Primary navigation for ${provider.name} timed out, attempting extraction anyway...`);
    }

    // --- STRATEGY: Malabar Gold (Ultra-Precision Extraction) ---
    if (provider.name.includes('Malabar')) {
        try {
            // Dismiss any blocking modals/popups multiple times
            for (let i = 0; i < 2; i++) {
                await page.evaluate(() => {
                    const selectors = ['.modal-close', '.close-btn', '.close-button', 'button[aria-label="Close"]', '.close', 'button.close', '#close-btn'];
                    selectors.forEach(s => {
                        const btn = document.querySelector(s);
                        if (btn && typeof btn.click === 'function') btn.click();
                    });
                });
                await new Promise(r => setTimeout(r, 1000));
            }
            
            // Scroll a bit to trigger lazy loads
            await page.evaluate(() => window.scrollBy(0, 500));
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {}

        const extracted = await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('tr, div.row, div.grid-row, .gold-rate-row, td'));
            
            // 1. Try to find rows that look like gold rates
            const qatarMatches = allElements.filter(el => {
                const t = (el.textContent || '').toLowerCase();
                const hasRegion = t.includes('qatar') || t.includes('doha');
                const hasGold = t.includes('kt') || t.includes('karat') || t.includes('22k') || t.includes('24k');
                const hasCurrency = t.includes('qar') || t.includes(' qr');
                return hasRegion && hasGold && hasCurrency;
            });

            // 2. Process matches and find the first one with 2 distinct prices > 380
            for (const el of qatarMatches) {
                const txt = el.textContent.replace(/\s+/g, ' ');
                const numMatches = txt.match(/(\d{3,}(?:\.\d+)?)/g);
                if (numMatches) {
                    const vals = numMatches
                        .map(m => parseFloat(m.replace(/,/g, '')))
                        .filter(v => v > 380 && v < 1000)
                        .sort((a,b) => a-b);
                    
                    // Ensure we have at least 2 distinct prices
                    const uniqueVals = [...new Set(vals)];
                    if (uniqueVals.length >= 2) {
                        return { 
                            '22k': uniqueVals[0].toFixed(2), 
                            '24k': uniqueVals[1].toFixed(2) 
                        };
                    }
                }
            }
            return null;
        });

        if (extracted) return extracted;
    }

    const prices = await page.evaluate((pName) => {
        const res = {};
        if (!document.body) return { error: 'No document body' };
        
        const bodyText = document.body.innerText.replace(/\s+/g, ' ');
        
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

        const findPrice = (karatLabel, assignedPrices = []) => {
            const index = bodyText.indexOf(karatLabel);
            if (index === -1) return null;
            
            const searchArea = bodyText.substring(index, index + 300);
            const matches = searchArea.match(/(\d{3,}(?:\.\d+)?)/g);
            
            if (matches) {
                const found = matches.find(n => {
                    const cleanN = n.replace(/,/g, '').replace(/\s+\.\s+/g, '.');
                    const val = parseFloat(cleanN);
                    return val > 300 && val < 1000 && !assignedPrices.includes(cleanN);
                });
                return found ? found.replace(/,/g, '').replace(/\s+\.\s+/g, '.') : null;
            }
            return null;
        };

        // --- STRATEGY: Dynamic Heuristic (Joyalukkas, Shine, etc.) ---
        const used = [];
        const k24 = findPrice('24 Karat', used) || findPrice('24KT', used) || findPrice('24K', used) || findPrice('24ct', used);
        if (k24) { res['24k'] = k24; used.push(k24); }

        const k22 = findPrice('22 Karat', used) || findPrice('22KT', used) || findPrice('22K', used) || findPrice('22ct', used);
        if (k22) { res['22k'] = k22; used.push(k22); }

        const k21 = findPrice('21 Karat', used) || findPrice('21KT', used) || findPrice('21K', used) || findPrice('21ct', used);
        if (k21) { res['21k'] = k21; used.push(k21); }

        const k18 = findPrice('18 Karat', used) || findPrice('18KT', used) || findPrice('18K', used) || findPrice('18ct', used);
        if (k18) { res['18k'] = k18; }


        return res;
    }, provider.name);

    if (prices && prices.error) {
        console.error(`   [Puppeteer] Evaluation error for ${provider.name}: ${prices.error}`);
        return null;
    }

    return prices;

  } catch (err) {
    console.error(`   [Puppeteer] Critical synchronization failure for ${provider.name}: ${err.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeWithPuppeteer };
