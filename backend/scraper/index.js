const { getActiveProviders, savePrices } = require('./utils/db');
const { scrapeWithPuppeteer } = require('./strategies/puppeteer');
const { scrapeWithCheerio } = require('./strategies/cheerio');
const { checkAndSendAlerts } = require('./utils/alerts');
const { sendFallbackAlert } = require('./utils/mailer');

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

  try {
    const providers = await getActiveProviders();
    console.log(`Found ${providers.length} active providers.`);

    const allScrapedPrices = [];

    for (const provider of providers) {
      try {
        let prices = null;
        let usedFallback = false;
        let primaryError = null;

        // --- PHASE 1: Primary Extraction ---
        // Attempts the optimized strategy defined in the provider's scraping_type field.
        try {
            const primaryStrategy = provider.scraping_type === 'aggregator' ? scrapeWithCheerio : scrapeWithPuppeteer;
            prices = await primaryStrategy(provider);
        } catch (err) {
            primaryError = err.message;
            console.error(`   ❌ Primary strategy failed for ${provider.name}: ${primaryError}`);
        }

        // --- PHASE 2: Intelligent Fallback (Critical Vendors) ---
        // If the primary source is unreachable or returns partial data, pivot to the aggregator fail-safe.
        const isPartial = prices && (!prices['24k'] || !prices['22k']);
        if ((!prices || Object.keys(prices).length === 0 || isPartial) && provider.name.includes('Malabar')) {
            console.warn(`   ⚠️  Primary extraction for ${provider.name} was ${prices ? 'partial' : 'failed'}. Attempting aggregator fallback...`);
            usedFallback = true;
            const fallbackProvider = {
                ...provider,
                url: 'https://goldpriceqatar.com/',
                selectors: { '24k': '24K', '22k': '22K' }
            };
            const fallbackPrices = await scrapeWithCheerio(fallbackProvider);
            
            if (fallbackPrices && Object.keys(fallbackPrices).length > 0) {
                // Merge/Overwrite with stable fallback data to ensure system continuity.
                prices = { ...prices, ...fallbackPrices };
                await sendFallbackAlert(provider.name, primaryError || 'Navigation timeout / Incomplete data');
            }
        }

        // --- PHASE 3: Ledger Persistence ---
        if (prices && Object.keys(prices).some(k => k.match(/\d+k/i) && prices[k])) {
          console.log(`✅ Extracted prices for ${provider.name}:`, prices);
          await savePrices(provider.id, prices);
          
          Object.keys(prices).forEach(key => {
            const m = key.match(/^(\d+)k$/i);
            if (m && prices[key]) {
              allScrapedPrices.push({ karat: parseInt(m[1]), price: parseFloat(prices[key]) });
            }
          });
          
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
            karat: parseInt(karat),
            price: dailyMap[karat].total / dailyMap[karat].count
        }));
        
        await checkAndSendAlerts(latestAverages);
    }

    console.log('--- Scraper Run Finished ---');
  } catch (error) {
    console.error('CRITICAL SYSTEM ERROR:', error.message);
    process.exit(1);
  }
}

runScraper();
