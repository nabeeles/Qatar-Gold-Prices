const { getActiveProviders, savePrices } = require('./utils/db');
const { scrapeWithPuppeteer } = require('./strategies/puppeteer');
const { scrapeWithCheerio } = require('./strategies/cheerio');
const { checkAndSendAlerts } = require('./utils/alerts');
const { sendFallbackAlert } = require('./utils/mailer');

/**
 * Main scraper entry point.
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

        // --- STRATEGY: Primary Extraction ---
        try {
            const primaryStrategy = provider.scraping_type === 'aggregator' ? scrapeWithCheerio : scrapeWithPuppeteer;
            prices = await primaryStrategy(provider);
        } catch (err) {
            primaryError = err.message;
            console.error(`   ❌ Primary strategy failed for ${provider.name}: ${primaryError}`);
        }

        // --- STRATEGY: Intelligent Fallback (Critical Vendors Only) ---
        // Trigger fallback if primary failed, returned nothing, or only returned partial data
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
                // Merge/Overwrite with fallback data
                prices = { ...prices, ...fallbackPrices };
                await sendFallbackAlert(provider.name, primaryError || 'Navigation timeout / Incomplete data');
            }
        }

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

    // After all providers are scraped, check alerts using the averages
    if (allScrapedPrices.length > 0) {
        console.log('--- Commencing Market Threshold Validation ---');
        
        // Calculate spot averages across all successful extractions
        const dailyMap = {};
        allScrapedPrices.forEach(item => {
            if (!dailyMap[item.karat]) dailyMap[item.karat] = { total: 0, count: 0 };
            dailyMap[item.karat].total += item.price;
            dailyMap[item.karat].count += 1;
        });

        // Convert map to Array format expected by alerts.js: [{ karat: 24, price: 550.50 }]
        const latestAverages = Object.keys(dailyMap).map(karat => ({
            karat: parseInt(karat),
            price: dailyMap[karat].total / dailyMap[karat].count
        }));
        
        await checkAndSendAlerts(latestAverages);
    }

    console.log('--- Scraper Run Finished ---');
  } catch (error) {
    console.error('CRITICAL ERROR:', error.message);
    process.exit(1);
  }
}

runScraper();
