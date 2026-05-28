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

    // --- STRATEGY: Malabar Gold (Precision Table Extraction) ---
    if (provider.name.includes('Malabar')) {
        // 1. Dismiss any blocking modals/popups
        try {
            await page.evaluate(() => {
                const selectors = ['.modal-close', '.close-btn', '.close-button', 'button[aria-label="Close"]', '.close', 'button.close'];
                selectors.forEach(s => {
                    const btn = document.querySelector(s);
                    if (btn && typeof btn.click === 'function') btn.click();
                });
            });
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {}

        // 2. Extract specific table data
        const extracted = await page.evaluate(() => {
            const tables = Array.from(document.querySelectorAll('table'));
            const rateTable = tables.find(t => t.textContent.includes('kt/gm'));
            
            if (rateTable) {
                const rows = Array.from(rateTable.querySelectorAll('tr'));
                const qRow = rows.find(r => r.textContent.includes('Qatar'));
                if (qRow) {
                    const matches = qRow.textContent.match(/(\d{3,}(?:\.\d+)?)/g);
                    if (matches && matches.length >= 2) {
                        const vals = matches.map(m => parseFloat(m)).filter(v => v > 350).sort((a,b) => a-b);
                        if (vals.length >= 2) {
                            return { '22k': vals[0].toFixed(2), '24k': vals[1].toFixed(2) };
                        }
                    }
                }
            }

            const allElements = Array.from(document.querySelectorAll('tr, div.row, .gold-rate-row'));
            const bestMatch = allElements.find(el => {
                const t = el.textContent;
                return t.includes('Qatar') && t.includes('QAR') && t.includes('kt/gm');
            });
            
            if (bestMatch) {
                const matches = bestMatch.textContent.match(/(\d{3,}(?:\.\d+)?)/g);
                const vals = matches ? matches.map(m => parseFloat(m)).filter(v => v > 350).sort((a,b) => a-b) : [];
                if (vals.length >= 2) {
                    return { '22k': vals[0].toFixed(2), '24k': vals[1].toFixed(2) };
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
