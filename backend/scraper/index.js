const { getActiveProviders, savePrices } = require('./utils/db');
const { scrapeWithPuppeteer } = require('./strategies/puppeteer');
const { scrapeWithCheerio } = require('./strategies/cheerio');
const { checkAndSendAlerts } = require('./utils/alerts');

/**
 * Main scraper entry point.
 * 
 * Capability Overview:
 * 1. Orchestrates the full market synchronization cycle.
 * 2. Dynamically dispatches scraping tasks to either Puppeteer (Direct) or Cheerio (Aggregator) engines.
 * 3. Aggregates results into a global spot average for QAR.
 * 4. Triggers threshold alerts for registered mobile clients.
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
        // Dynamic Dispatch: Route based on provider metadata
        const strategy = provider.scraping_type === 'aggregator' ? scrapeWithCheerio : scrapeWithPuppeteer;
        const prices = await strategy(provider);

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

        const averages = {};
        Object.keys(dailyMap).forEach(karat => {
            averages[karat] = dailyMap[karat].total / dailyMap[karat].count;
        });
        
        await checkAndSendAlerts(averages);
    }

    console.log('--- Scraper Run Finished ---');
  } catch (error) {
    console.error('CRITICAL ERROR:', error.message);
    process.exit(1);
  }
}

runScraper();
