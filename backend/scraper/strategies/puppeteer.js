const puppeteer = require('puppeteer');

/**
 * Direct API extraction for Malabar Gold rates (Tier 1 Fast-Path).
 * Queries the official JSON pricing endpoint used by their regional web widget.
 * @returns {Promise<{ '22k': string, '24k': string } | null>}
 */
async function fetchMalabarDirectApi() {
  const endpoint = 'https://www.malabargoldanddiamonds.com/ae/malabarprice/index/getrates/?country=QA&state=Doha';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.malabargoldanddiamonds.com/ae/goldprice'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    if (!data || !data['22kt'] || !data['24kt']) {
      return null;
    }

    const parseRate = (val) => {
      if (!val) return null;
      const clean = val.replace(/,/g, '').replace(/[^\d.]/g, '');
      const parsed = parseFloat(clean);
      return !isNaN(parsed) && parsed > 300 && parsed < 1000 ? parsed.toFixed(2) : null;
    };

    const k22 = parseRate(data['22kt']);
    const k24 = parseRate(data['24kt']);

    if (k22 && k24) {
      return { '22k': k22, '24k': k24 };
    }

    return null;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`   [Warn] Malabar direct API request failed: ${err.message}`);
    return null;
  }
}

/**
 * Puppeteer Scraping Strategy
 */
async function scrapeWithPuppeteer(provider) {
  console.log(`[Puppeteer] Initializing market synchronization for ${provider.name}...`);
  
  // --- STRATEGY: Malabar Gold (Tier 1 Fast-Path Direct Pricing API) ---
  if (provider.name.includes('Malabar') && !provider.forceBrowserFallback) {
    try {
      console.log('   [Malabar] Attempting sub-second direct API extraction...');
      const fastResult = await fetchMalabarDirectApi();
      if (fastResult && fastResult['24k'] && fastResult['22k']) {
        console.log('   ✅ [Malabar] Extracted directly via official pricing API:', fastResult);
        return fastResult;
      }
      console.log('   [Malabar] Direct API unfulfilled, proceeding with browser automation fallback...');
    } catch (apiErr) {
      console.warn(`   [Warn] Malabar direct API failed: ${apiErr.message}`);
    }
  }

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
        const waitTime = provider.name.includes('Malabar') ? 5000 : 10000;
        await new Promise(r => setTimeout(r, waitTime));
    } catch (gotoError) {
        console.warn(`   [Warn] Primary navigation for ${provider.name} timed out, attempting extraction anyway...`);
    }

    // --- STRATEGY: Malabar Gold (Tier 2 Interactive Browser Automation Fallback) ---
    if (provider.name.includes('Malabar')) {
        try {
            console.log('   [Malabar] Executing interactive browser automation fallback...');
            
            // Dismiss any initial blocking elements / modals
            await page.evaluate(() => {
                const selectors = ['.modal-close', '.close-btn', 'button[aria-label="Close"]', '.close', '#onesignal-slidedown-cancel-button'];
                selectors.forEach(s => document.querySelector(s)?.click());
            });

            // Check if interactive gold-rate widget exists
            const countrySelect = await page.$('#gold-country-list');
            if (countrySelect) {
                console.log('   [Malabar] Found interactive gold rate selector. Selecting Qatar (QA)...');
                await page.select('#gold-country-list', 'QA');

                // Wait for state list to be populated with Doha
                await page.waitForFunction(() => {
                    const stateSel = document.querySelector('#gold-state-list');
                    return stateSel && Array.from(stateSel.options).some(o => o.value === 'Doha');
                }, { timeout: 15000 });

                console.log('   [Malabar] State list populated. Selecting Doha...');
                await page.select('#gold-state-list', 'Doha');

                // Click submit button
                const submitBtn = await page.$('.gold-rate-btn') || await page.$('button.submit');
                if (submitBtn) {
                    await submitBtn.click();
                }

                // Wait for rates to render in the DOM
                await page.waitForFunction(() => {
                    const txt = document.body ? document.body.innerText : '';
                    return txt.includes('QAR') && (txt.includes('22 Carat') || txt.includes('24 Carat') || txt.includes('Todays Gold Rate'));
                }, { timeout: 15000 });
            }

            const extracted = await page.evaluate(() => {
                const bodyTxt = document.body.innerText.replace(/\s+/g, ' ');
                const res = {};

                // Primary parsing matching widget labels
                const k22Match = bodyTxt.match(/\(?22\s*(?:Carat|KT|K)?\s*Gold\)?\s*(\d+\.\d+)\s*QAR/i) ||
                                 bodyTxt.match(/(\d+\.\d+)\s*QAR[^\d]+22/i);
                const k24Match = bodyTxt.match(/\(?24\s*(?:Carat|KT|K)?\s*Gold\)?\s*(\d+\.\d+)\s*QAR/i) ||
                                 bodyTxt.match(/(\d+\.\d+)\s*QAR[^\d]+24/i);

                if (k22Match) res['22k'] = parseFloat(k22Match[1]).toFixed(2);
                if (k24Match) res['24k'] = parseFloat(k24Match[1]).toFixed(2);

                // Secondary regex searching for pairs of QAR prices
                if (!res['22k'] || !res['24k']) {
                    const matches = bodyTxt.match(/(\d{3}\.\d{2})\s*QAR/gi);
                    if (matches && matches.length >= 2) {
                        const vals = Array.from(new Set(matches.map(m => parseFloat(m.replace(/[^\d.]/g, '')))))
                            .filter(v => v > 300 && v < 1000)
                            .sort((a, b) => a - b);
                        if (vals.length >= 2) {
                            res['22k'] = vals[0].toFixed(2);
                            res['24k'] = vals[1].toFixed(2);
                        }
                    }
                }

                // Tertiary fallback for static store table
                if (!res['22k'] || !res['24k']) {
                    const qMatch = bodyTxt.match(/Qatar\s+(\d+\.\d+)\s+QAR\s+(\d+\.\d+)\s+QAR/i) || 
                                   bodyTxt.match(/Qatar\s+(\d+\.\d+)\s+(\d+\.\d+)/i);
                    if (qMatch) {
                        const v1 = parseFloat(qMatch[1]);
                        const v2 = parseFloat(qMatch[2]);
                        if (v1 > 300 && v2 > 300) {
                            const vals = [v1, v2].sort((a,b) => a-b);
                            res['22k'] = vals[0].toFixed(2);
                            res['24k'] = vals[1].toFixed(2);
                        }
                    }
                }

                return (res['22k'] && res['24k']) ? res : null;
            });

            if (extracted) {
                console.log('   ✅ [Malabar] Extracted live rates via browser automation:', extracted);
                return extracted;
            }
        } catch (domErr) {
            console.warn(`   [Warn] Malabar browser extraction failed: ${domErr.message}`);
        }
    }

    // --- STRATEGY: Al Fardan Exchange (Direct Product Extraction) ---
    // Al Fardan Exchange lists individual gold products (minted bars and coins) rather than a simple price chart.
    // We target the 1 Gram 24 Karat bar price as the base price for 24k gold, and calculate the 22k price per gram
    // by dividing the total price of the 7.98 Gram Sovereign 22 Karat Gold Coin by its weight.
    if (provider.name.includes('Al Fardan')) {
        console.log('   [Al Fardan] Applying high-fidelity direct product extraction strategy...');
        const alFardanPrices = await page.evaluate(() => {
            const res = {};
            const text = document.body.innerText.replace(/\s+/g, ' ');
            
            // Extract the 24 Karat 1 Gram bar price (e.g., "1 GRAM GOLD FORTUNA BAR- 24 KARAT 607")
            const k24Match = text.match(/1\s+GRAM\s+GOLD\s+FORTUNA\s+BAR-\s+24\s+KARAT\s+(\d+)/i);
            if (k24Match) {
                res['24k'] = k24Match[1];
            }
            
            // Extract the 22 Karat Sovereign Coin price and calculate price per gram (e.g., "7.98 GRAM GOLD THE SOVEREIGN COIN - 22 KARAT 4175")
            const k22Match = text.match(/7\.98\s+GRAM\s+GOLD\s+THE\s+SOVEREIGN\s+COIN\s+-\s+22\s+KARAT\s+(\d+)/i);
            if (k22Match) {
                const totalPrice = parseFloat(k22Match[1]);
                const pricePerGram = totalPrice / 7.98;
                res['22k'] = pricePerGram.toFixed(2);
            }
            return res;
        });
        if (alFardanPrices && (alFardanPrices['24k'] || alFardanPrices['22k'])) {
            return alFardanPrices;
        }
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
            const index = bodyText.toLowerCase().indexOf(karatLabel.toLowerCase());
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

        // --- STRATEGY: Dynamic Heuristic (Joyalukkas, etc.) ---
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

module.exports = { scrapeWithPuppeteer, fetchMalabarDirectApi };
