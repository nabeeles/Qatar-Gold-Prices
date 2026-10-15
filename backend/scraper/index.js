const { getActiveProviders, savePrices } = require('./utils/db');
const { scrapeWithPuppeteer, launchScraperBrowser } = require('./strategies/puppeteer');
const { scrapeWithCheerio } = require('./strategies/cheerio');
const { checkAndSendAlerts } = require('./utils/alerts');
const { sendFallbackAlert } = require('./utils/mailer');
const { isFallbackEligible, normalizePriceMap } = require('./utils/validation');

/**
 * Scraper Orchestrator (index.js)
 * 
 * Capability Overview:
 * Executes the global market synchronization lifecycle. Manages dynamic engine 
 * dispatching, data persistence, and intelligent fail-over for critical providers.
 * 
 * Orchestration Flow:
 * 1. SYNC: Retrieves the active provider registry from Supabase.
 * 2. DISPATCH: Routes tasks to Puppeteer (Direct) or Cheerio (Aggregator) based on metadata.
 * 3. FAIL-SAFE: Executes a "Primary-with-Fallback" pivot for high-impact sources.
 * 4. LEDGER: Persists validated market rates into the historical ledger.
 * 5. ALERT: Aggregates spot averages and triggers user threshold notifications.
 */
async function runScraper() {
  console.log('--- Starting Qatar Gold Price Scraper ---');
  console.log('Time:', new Date().toISOString());

  let sharedBrowser = null;

  try {
    const providers = await getActiveProviders();
    console.log(`Found ${providers.length} active providers.`);

    const hasDirectProviders = providers.some(p => p.scraping_type !== 'aggregator');
    if (hasDirectProviders) {
      sharedBrowser = await launchScraperBrowser();
    }

    const allScrapedPrices = [];
    let cachedFallbackPrices = undefined;
    let fallbackPushedToAlerts = false;

    for (const provider of providers) {
      try {
        let prices = null;
        let usedFallback = false;
        let primaryError = null;

        // --- PHASE 1: Primary Extraction ---
        // Attempts the optimized strategy defined in the provider's scraping_type field.
        try {
          prices = provider.scraping_type === 'aggregator'
            ? await scrapeWithCheerio(provider)
            : await scrapeWithPuppeteer(provider, sharedBrowser);
        } catch (err) {
          primaryError = err.message;
          console.error(`   ❌ Primary strategy failed for ${provider.name}: ${primaryError}`);
        }

        // --- PHASE 2: Intelligent Fallback (Critical Vendors) ---
        // If direct extraction fails or returns partial rates, we pivot to the high-fidelity aggregator (goldpriceqatar.com).
        // This guarantees continuous price availability even if corporate firewalls block cloud IP ranges.
        const needsFallback = isFallbackEligible(prices);
        const isCriticalVendor =
          provider.name.includes('Malabar') ||
          provider.name.includes('Al Fardan') ||
          provider.name.includes('Joyalukkas');
        const primaryReason = primaryError || 'Primary extraction returned empty or partial rates (missing 24K or 22K).';

        if (needsFallback && isCriticalVendor) {
          console.log(`   [Info] ${provider.name} direct extraction is restricted or failed in this environment. Pivoting to high-fidelity aggregator...`);

          if (cachedFallbackPrices === undefined) {
            const fallbackProvider = {
              ...provider,
              url: 'https://goldpriceqatar.com/',
              selectors: { '24k': '24K', '22k': '22K' }
            };
            try {
              cachedFallbackPrices = await scrapeWithCheerio(fallbackProvider);
            } catch (fallbackErr) {
              console.error(`   ❌ Fallback strategy failed: ${fallbackErr.message}`);
              cachedFallbackPrices = null;
            }
          }

          let mergedPrices = cachedFallbackPrices
            ? normalizePriceMap({ ...cachedFallbackPrices, ...(prices || {}) })
            : null;
          if (isFallbackEligible(mergedPrices) && cachedFallbackPrices) {
            mergedPrices = normalizePriceMap(cachedFallbackPrices);
          }

          if (mergedPrices && !isFallbackEligible(mergedPrices)) {
            prices = mergedPrices;
            usedFallback = true;
            console.log(`   ✅ ${provider.name} prices synchronized via verified aggregator.`);
            await sendFallbackAlert(provider.name, primaryReason, true);
          } else {
            await sendFallbackAlert(
              provider.name,
              `${primaryReason} | All extraction paths (Direct + Aggregator) failed.`,
              false
            );
          }
        } else if (needsFallback) {
          await sendFallbackAlert(provider.name, primaryReason, false);
        }

        // --- PHASE 3: Ledger Persistence ---
        if (prices && Object.keys(prices).some(k => k.match(/\d+k/i) && prices[k])) {
          console.log(`✅ Extracted prices for ${provider.name}:`, prices);
          await savePrices(provider.id, prices);

          if (!usedFallback || !fallbackPushedToAlerts) {
            Object.keys(prices).forEach(key => {
              const m = key.match(/^(\d+)k$/i);
              if (m && prices[key]) {
                allScrapedPrices.push({ karat: parseInt(m[1], 10), price: parseFloat(prices[key]) });
              }
            });
            if (usedFallback) {
              fallbackPushedToAlerts = true;
            }
          }

          console.log(`💾 Saved to database.`);
        } else {
          console.warn(`⚠️  No prices found for ${provider.name}.`);
        }
      } catch (err) {
        console.error(`❌ Failed to process ${provider.name}:`, err.message);
      }
    }

    // --- PHASE 4: Alert Evaluation ---
    // Aggregates market movements and dispatches mobile push notifications.
    if (allScrapedPrices.length > 0) {
      console.log('--- Commencing Market Threshold Validation ---');

      const dailyMap = {};
      allScrapedPrices.forEach(item => {
        if (!dailyMap[item.karat]) dailyMap[item.karat] = { total: 0, count: 0 };
        dailyMap[item.karat].total += item.price;
        dailyMap[item.karat].count += 1;
      });

      // Convert map to Array format expected by the Notification Engine.
      const latestAverages = Object.keys(dailyMap).map(karat => ({
        karat: parseInt(karat, 10),
        price: dailyMap[karat].total / dailyMap[karat].count
      }));

      await checkAndSendAlerts(latestAverages);
    }

    console.log('--- Scraper Run Finished ---');
  } catch (error) {
    console.error('CRITICAL SYSTEM ERROR:', error.message);
    process.exit(1);
  } finally {
    if (sharedBrowser) {
      await sharedBrowser.close().catch(() => {});
    }
  }
}

runScraper();
