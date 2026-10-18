const https = require('https');
const axios = require('axios');
const puppeteer = require('puppeteer');
const { MIN_VALID_PRICE, MAX_VALID_PRICE, isValidGoldPrice, normalizePriceMap } = require('../utils/validation');

/**
 * Resolves the regional `/goldprice` URL when Malabar Gold's Magento GeoIP router
 * redirects `/ae/goldprice` to a regional store homepage (e.g., `/us/` or `/uk/`).
 *
 * @param {string} requestedUrl - Original URL requested
 * @param {string} landedUrl - Final URL after redirects (`page.url()`)
 * @returns {string | null} Regional `/goldprice` URL if redirected away from `/goldprice`, or `null`
 */
function resolveMalabarGoldPriceUrl(requestedUrl, landedUrl) {
  if (!landedUrl || landedUrl.includes('/goldprice')) {
    return null;
  }
  try {
    const parsed = new URL(landedUrl);
    if (!parsed.hostname.includes('malabargoldanddiamonds.com')) {
      return null;
    }
    const basePath = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
    return `${parsed.origin}${basePath}goldprice`;
  } catch {
    return null;
  }
}

/**
 * Direct API extraction for Malabar Gold rates (Tier 1 Fast-Path).
 * Queries the official JSON pricing endpoint used by their regional web widget.
 * Iterates across regional store views ('ae', 'us', 'uk') so GeoIP redirects on
 * cloud/GitHub Actions runners (e.g. US IPs redirected from /ae/ to /us/) are
 * seamlessly handled.
 *
 * @param {typeof fetch} [fetchImpl=fetch] - Fetch implementation (injectable for unit testing)
 * @returns {Promise<{ '22k': string, '24k': string } | null>}
 */
async function fetchMalabarDirectApi(fetchImpl = fetch) {
  const parseRate = (val) => {
    if (!val) return null;
    const clean = String(val).replace(/,/g, '').replace(/[^\d.]/g, '');
    const parsed = parseFloat(clean);
    return isValidGoldPrice(parsed) ? parsed.toFixed(2) : null;
  };

  const stores = ['ae', 'us', 'uk'];
  const visited = new Set();

  for (let i = 0; i < stores.length; i++) {
    const store = stores[i];
    if (visited.has(store)) continue;
    visited.add(store);

    const endpoint = `https://www.malabargoldanddiamonds.com/${store}/malabarprice/index/getrates/?country=QA&state=Doha`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `https://www.malabargoldanddiamonds.com/${store}/goldprice`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      // If Magento GeoIP redirected /ae/malabarprice/... to a store homepage like /us/,
      // prioritize that redirected store code on the very next iteration.
      if (response.url && !response.url.includes('malabarprice')) {
        const match = response.url.match(/malabargoldanddiamonds\.com\/([a-z]{2})(?:\/|$)/i);
        if (match && match[1]) {
          const redirectedStore = match[1].toLowerCase();
          if (!visited.has(redirectedStore)) {
            stores.splice(i + 1, 0, redirectedStore);
          }
        }
      }

      const data = await response.json();
      if (!data || !data['22kt'] || !data['24kt']) {
        continue;
      }

      const k22 = parseRate(data['22kt']);
      const k24 = parseRate(data['24kt']);

      if (k22 && k24) {
        return { '22k': k22, '24k': k24 };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`   [Warn] Malabar direct API attempt (/${store}/) failed: ${err.message}`);
    }
  }

  return null;
}

const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const ALFARDAN_WEB_API_URL = 'https://alfardanexchange.com.qa/api/gold-rates';
const ALFARDAN_MASTER_API_URL =
  'https://alfaremit.com:7095/api/MetalProductApp/MetalProductAppList?productType=ALL&pagination.PageSize=1000&pagination.PageNumber=1&pagination.SortBy=Id&pagination.SortDirection=asc';

/**
 * Parses Al Fardan Exchange gold rate payloads from either:
 * 1. `alfardanexchange.com.qa/api/gold-rates` (`{ data: [{ product_code, product_description, price, rate }] }`)
 * 2. `alfaremit.com:7095/api/MetalProductApp/MetalProductAppList` (`{ returnObject: { data: [{ productCode, productdescription, price, rate }] } }`)
 *
 * Extracts the 1 Gram 24K PAMP Fortuna Bar rate and 7.98 Gram 22K Sovereign Coin per-gram rate.
 *
 * @param {any} rawPayload - Parsed JSON object or raw JSON string
 * @returns {{ '24k': string, '22k': string } | null}
 */
function parseAlFardanApiPayload(rawPayload) {
  let payload = rawPayload;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (!payload || typeof payload !== 'object') return null;

  const items = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.returnObject?.data)
      ? payload.returnObject.data
      : [];
  if (items.length === 0) return null;

  const res = {};
  for (const item of items) {
    const code = String(item.product_code || item.productCode || '').trim();
    const desc = String(item.product_description || item.productdescription || '')
      .replace(/\s+/g, ' ')
      .trim();
    const rawPrice = item.price !== null && item.price !== undefined ? item.price : item.rate;
    const numericPrice = parseFloat(String(rawPrice).replace(/,/g, ''));
    if (!Number.isFinite(numericPrice)) continue;

    if (
      !res['24k'] &&
      (code === '1.G-401' || /1\s+GRAM\s+GOLD\s+FORTUNA\s+BAR\s*-\s*24\s*KARAT/i.test(desc))
    ) {
      if (isValidGoldPrice(numericPrice)) {
        res['24k'] = numericPrice.toFixed(2);
      }
    }

    if (
      !res['22k'] &&
      (code === '7.99G22UK-505' || /7\.98\s+GRAM\s+GOLD.*SOVEREIGN\s+COIN\s*-\s*22\s*KARAT/i.test(desc))
    ) {
      const perGram = numericPrice / 7.98;
      if (isValidGoldPrice(perGram)) {
        res['22k'] = perGram.toFixed(2);
      }
    }
  }

  return res['24k'] && res['22k'] ? res : null;
}

/**
 * Fetches JSON from a URL via a SOCKS5 proxy (such as Tor on GitHub Actions) using curl.
 * Uses unique SOCKS5 credentials per attempt to trigger Tor's IsolateSocksAuth circuit rotation.
 *
 * @param {string} url - Target URL
 * @param {string} socksProxy - SOCKS5 host:port (e.g. '127.0.0.1:9050')
 * @param {number} attempt - Attempt number used for stream isolation
 * @returns {Promise<any>}
 */
async function fetchJsonViaSocksProxy(url, socksProxy, attempt = 1) {
  const { stdout } = await execFileAsync(
    'curl',
    [
      '--silent',
      '--show-error',
      '--fail',
      '--location',
      '--insecure',
      '--max-time',
      '20',
      '--socks5-hostname',
      socksProxy,
      '--proxy-user',
      `qgp-${Date.now()}-${attempt}:pass`,
      '-H',
      'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      '-H',
      'Accept: application/json',
      '-H',
      'Referer: https://alfardanexchange.com.qa/gold-rates',
      url,
    ],
    { maxBuffer: 5 * 1024 * 1024 }
  );
  return JSON.parse(stdout);
}

/**
 * Direct API extraction for Al Fardan Exchange gold rates (Tier 1 Fast-Path).
 * Queries Al Fardan's official `/api/gold-rates` and upstream `alfaremit.com:7095`
 * JSON endpoints and extracts the 1 Gram 24K PAMP Fortuna Bar rate and 7.98 Gram
 * 22K Sovereign Coin per-gram rate.
 *
 * Because Al Fardan's Qatari firewall drops TCP SYN packets from US datacenter IPs
 * (including GitHub Actions US runners), this function enforces strict connection
 * abort timeouts and cascades through configured SOCKS5/Tor regional egress or
 * edge relay routes when direct TCP connection times out.
 *
 * @param {(url: string) => Promise<any>} [fetchJsonImpl] - Optional JSON fetcher for unit testing
 * @returns {Promise<{ '24k': string, '22k': string } | null>}
 */
async function fetchAlFardanDirectApi(fetchJsonImpl) {
  const directTimeoutMs = process.env.ALFARDAN_SOCKS_PROXY ? 4500 : 7000;
  const defaultFetchJson = async (url, timeoutMs = directTimeoutMs) => {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await axios.get(url, {
      timeout: timeoutMs,
      signal: AbortSignal.timeout(timeoutMs),
      httpsAgent,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'application/json',
         Origin: 'https://alfardanexchange.com.qa',
        Referer: 'https://alfardanexchange.com.qa/gold-rates',
      },
    });
    return response.data;
  };

  const fetcher = fetchJsonImpl || defaultFetchJson;
  const directEndpoints = [ALFARDAN_WEB_API_URL, ALFARDAN_MASTER_API_URL];

  // 1. Direct fast-path (completes in <400ms from Qatar/EU/Asia)
  for (const endpoint of directEndpoints) {
    try {
      const payload = await fetcher(endpoint);
      const parsed = parseAlFardanApiPayload(payload);
      if (parsed) {
        return parsed;
      }
    } catch (err) {
      console.warn(`   [Warn] Al Fardan direct API attempt (${endpoint}) failed: ${err.message}`);
    }
  }

  // If a custom unit-test fetcher was supplied, do not invoke external SOCKS/relay fallbacks
  if (fetchJsonImpl) {
    return null;
  }

  // 2. SOCKS5 / Tor regional egress tunnel (bypasses US GeoIP firewall block in GitHub Actions)
  const socksProxy = process.env.ALFARDAN_SOCKS_PROXY;
  if (socksProxy) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      for (const endpoint of directEndpoints) {
        try {
          console.log(`   [Al Fardan] Attempting SOCKS5 egress (${socksProxy}, attempt ${attempt}) -> ${endpoint}...`);
          const payload = await fetchJsonViaSocksProxy(endpoint, socksProxy, attempt);
          const parsed = parseAlFardanApiPayload(payload);
          if (parsed) {
            return parsed;
          }
        } catch (err) {
          console.warn(`   [Warn] Al Fardan SOCKS5 attempt ${attempt} (${endpoint}) failed: ${err.message}`);
        }
      }
    }
  }

  // 3. Zero-daemon edge relay fallback against Al Fardan's official endpoints
  for (const endpoint of [ALFARDAN_MASTER_API_URL, ALFARDAN_WEB_API_URL]) {
    const relayUrl = `https://api.cors.lol/?url=${encodeURIComponent(endpoint)}`;
    try {
      console.log(`   [Al Fardan] Attempting edge relay -> ${endpoint}...`);
      const payload = await defaultFetchJson(relayUrl, 12000);
      const parsed = parseAlFardanApiPayload(payload);
      if (parsed) {
        return parsed;
      }
    } catch (err) {
      console.warn(`   [Warn] Al Fardan edge relay attempt (${endpoint}) failed: ${err.message}`);
    }
  }

  return null;
}

/**
 * Launches a shared or standalone Puppeteer browser instance.
 * Only disables Chromium sandboxing when running in CI or explicitly requested.
 */
async function launchScraperBrowser() {
  const args = ['--disable-dev-shm-usage', '--disable-gpu'];
  if (process.env.CI === 'true' || process.env.PUPPETEER_NO_SANDBOX === 'true') {
    args.push('--no-sandbox', '--disable-setuid-sandbox');
  }

  const launchOptions = {
    headless: 'new',
    args,
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    console.log(`   [Info] Using custom browser path: ${launchOptions.executablePath}`);
  }

  try {
    return await puppeteer.launch(launchOptions);
  } catch (err) {
    const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (
      !launchOptions.executablePath &&
      process.platform === 'darwin' &&
      require('fs').existsSync(macChrome)
    ) {
      console.log(`   [Info] Falling back to system Chrome: ${macChrome}`);
      return puppeteer.launch({ ...launchOptions, executablePath: macChrome });
    }
    throw err;
  }
}

/**
 * Puppeteer Scraping Strategy
 * @param {Object} provider - Provider configuration object
 * @param {import('puppeteer').Browser | null} [sharedBrowser=null] - Optional shared browser instance
 */
async function scrapeWithPuppeteer(provider, sharedBrowser = null) {
  console.log(`[Puppeteer] Initializing market synchronization for ${provider.name}...`);
  
  // --- STRATEGY: Malabar Gold (Tier 1 Fast-Path Direct Pricing API) ---
  if (provider.name.includes('Malabar') && !provider.forceBrowserFallback) {
    try {
      console.log('   [Malabar] Attempting sub-second direct API extraction...');
      const fastResult = await fetchMalabarDirectApi();
      const validatedFast = normalizePriceMap(fastResult);
      if (validatedFast['24k'] && validatedFast['22k']) {
        console.log('   ✅ [Malabar] Extracted directly via official pricing API:', validatedFast);
        return validatedFast;
      }
      console.log('   [Malabar] Direct API unfulfilled, proceeding with browser automation fallback...');
    } catch (apiErr) {
      console.warn(`   [Warn] Malabar direct API failed: ${apiErr.message}`);
    }
  }

  // --- STRATEGY: Al Fardan Exchange (Tier 1 Fast-Path Direct Pricing API) ---
  if (provider.name.includes('Al Fardan') && !provider.forceBrowserFallback) {
    try {
      console.log('   [Al Fardan] Attempting sub-second direct API extraction...');
      const fastAlFardan = await fetchAlFardanDirectApi();
      const validatedAlFardan = normalizePriceMap(fastAlFardan);
      if (validatedAlFardan['24k'] && validatedAlFardan['22k']) {
        console.log('   ✅ [Al Fardan] Extracted directly via official pricing API:', validatedAlFardan);
        return validatedAlFardan;
      }
      console.log('   [Al Fardan] Direct API unfulfilled, proceeding with browser automation fallback...');
    } catch (apiErr) {
      console.warn(`   [Warn] Al Fardan direct API failed: ${apiErr.message}`);
    }
  }

  const ownsBrowser = !sharedBrowser;
  const browser = sharedBrowser || (await launchScraperBrowser());
  let page = null;

  try {
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 1200 });

    if (provider.name.includes('Al Fardan')) {
      // Prevent alfardan.js from calling setInterval(..., NaN) when window.refresh is undefined on /gold-rates
      await page.evaluateOnNewDocument(() => {
        window.forex_refresh = 3600;
        window.refresh = 3600;
      });
    }

    console.log(`   Navigating to secure endpoint: ${provider.url}...`);
    
    try {
        const waitMode = provider.name.includes('Al Fardan') ? 'domcontentloaded' : 'networkidle2';
        const response = await page.goto(provider.url, { waitUntil: waitMode, timeout: 45000 });
        if (response && response.status() >= 400) {
            console.warn(`   [Warn] Navigation to ${provider.name} returned status ${response.status()}`);
        }
        
        // Wait for body text to populate instead of blind 10s sleep
        await page.waitForFunction(
          () => document.body && document.body.innerText && document.body.innerText.trim().length > 200,
          { timeout: 8000 }
        ).catch(() => {});
    } catch (gotoError) {
        console.warn(`   [Warn] Primary navigation for ${provider.name} timed out, attempting extraction anyway...`);
    }

    // --- STRATEGY: Malabar Gold (Tier 2 Interactive Browser Automation Fallback) ---
    if (provider.name.includes('Malabar')) {
        try {
            console.log('   [Malabar] Executing interactive browser automation fallback...');

            const redirectedGoldPriceUrl = resolveMalabarGoldPriceUrl(provider.url, page.url());
            if (redirectedGoldPriceUrl) {
                console.log(`   [Malabar] GeoIP redirect detected (${page.url()}). Navigating to regional goldprice page: ${redirectedGoldPriceUrl}...`);
                await page.goto(redirectedGoldPriceUrl, { waitUntil: 'networkidle2', timeout: 45000 });
            }
            
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

            const extracted = await page.evaluate((minPrice, maxPrice) => {
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
                    const matches = bodyTxt.match(/(\d{3,4}\.\d{2})\s*QAR/gi);
                    if (matches && matches.length >= 2) {
                        const vals = Array.from(new Set(matches.map(m => parseFloat(m.replace(/[^\d.]/g, '')))))
                            .filter(v => v >= minPrice && v <= maxPrice)
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
                        if (v1 >= minPrice && v1 <= maxPrice && v2 >= minPrice && v2 <= maxPrice) {
                            const vals = [v1, v2].sort((a,b) => a-b);
                            res['22k'] = vals[0].toFixed(2);
                            res['24k'] = vals[1].toFixed(2);
                        }
                    }
                }

                return (res['22k'] && res['24k']) ? res : null;
            }, MIN_VALID_PRICE, MAX_VALID_PRICE);

            const validatedExtracted = normalizePriceMap(extracted);
            if (validatedExtracted['22k'] && validatedExtracted['24k']) {
                console.log('   ✅ [Malabar] Extracted live rates via browser automation:', validatedExtracted);
                return validatedExtracted;
            }
        } catch (domErr) {
            console.warn(`   [Warn] Malabar browser extraction failed: ${domErr.message}`);
        }
    }

    // --- STRATEGY: Al Fardan Exchange (Tier 2 Browser Product Extraction Fallback) ---
    // Al Fardan Exchange lists individual gold products (minted bars and coins) rather than a simple price chart.
    // We target the 1 Gram 24 Karat bar price as the base price for 24k gold, and calculate the 22k price per gram
    // by dividing the total price of the 7.98 Gram Sovereign 22 Karat Gold Coin by its weight.
    if (provider.name.includes('Al Fardan')) {
        console.log('   [Al Fardan] Applying high-fidelity direct product extraction strategy...');
        try {
            await page.waitForFunction(() => {
                const text = document.body ? document.body.innerText : '';
                return text.includes('1 GRAM GOLD') || text.includes('SOVEREIGN COIN') || text.includes('FORTUNA BAR');
            }, { timeout: 20000 });
        } catch (waitErr) {
            console.warn('   [Warn] Al Fardan product table wait timed out, attempting extraction anyway...');
        }
        const alFardanPrices = await page.evaluate(() => {
            const res = {};
            const text = document.body.innerText.replace(/\s+/g, ' ');
            
            // Extract the 24 Karat 1 Gram bar price (e.g., "1 GRAM GOLD FORTUNA BAR- 24 KARAT 568")
            const k24Match = text.match(/1\s+GRAM\s+GOLD\s+FORTUNA\s+BAR\s*-\s*24\s+KARAT\s+(\d+(?:\.\d+)?)/i);
            if (k24Match) {
                res['24k'] = parseFloat(k24Match[1]).toFixed(2);
            }
            
            // Extract the 22 Karat Sovereign Coin price and calculate price per gram (e.g., "7.98 GRAM GOLD THE SOVEREIGN COIN - 22 KARAT 3930")
            const k22Match = text.match(/7\.98\s+GRAM\s+GOLD\s+THE\s+SOVEREIGN\s+COIN\s*-\s*22\s+KARAT\s+(\d+(?:\.\d+)?)/i);
            if (k22Match) {
                const totalPrice = parseFloat(k22Match[1]);
                const pricePerGram = totalPrice / 7.98;
                res['22k'] = pricePerGram.toFixed(2);
            }
            return res;
        });
        const validatedAlFardan = normalizePriceMap(alFardanPrices);
        if (validatedAlFardan['24k'] || validatedAlFardan['22k']) {
            return validatedAlFardan;
        }
    }

    await page.waitForFunction(() => {
        const text = document.body ? document.body.innerText : '';
        return /24\s*(?:Karat|KT|K|ct)|22\s*(?:Karat|KT|K|ct)/i.test(text);
    }, { timeout: 15000 }).catch(() => {});

    const prices = await page.evaluate((pName, minPrice, maxPrice) => {
        const res = {};
        if (!document.body) return { error: 'No document body' };
        
        const bodyText = document.body.innerText.replace(/\s+/g, ' ');

        const findPrice = (karatLabel, assignedPrices = []) => {
            const index = bodyText.toLowerCase().indexOf(karatLabel.toLowerCase());
            if (index === -1) return null;
            
            const searchArea = bodyText.substring(index, index + 300);
            const matches = searchArea.match(/(\d{3,}(?:\.\d+)?)/g);
            
            if (matches) {
                const found = matches.find(n => {
                    const cleanN = n.replace(/,/g, '').replace(/\s+\.\s+/g, '.');
                    const val = parseFloat(cleanN);
                    return val >= minPrice && val <= maxPrice && !assignedPrices.includes(cleanN);
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
    }, provider.name, MIN_VALID_PRICE, MAX_VALID_PRICE);

    if (prices && prices.error) {
        console.error(`   [Puppeteer] Evaluation error for ${provider.name}: ${prices.error}`);
        return null;
    }

    return normalizePriceMap(prices);

  } catch (err) {
    console.error(`   [Puppeteer] Critical synchronization failure for ${provider.name}: ${err.message}`);
    return null;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (ownsBrowser && browser) {
      await browser.close().catch(() => {});
    }
  }
}

module.exports = {
  scrapeWithPuppeteer,
  fetchMalabarDirectApi,
  fetchAlFardanDirectApi,
  parseAlFardanApiPayload,
  resolveMalabarGoldPriceUrl,
  launchScraperBrowser,
};

