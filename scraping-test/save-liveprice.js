const { getActiveProviders, savePrices } = require('../backend/scraper/utils/db');
const { scrapeWithPuppeteer } = require('../backend/scraper/strategies/puppeteer');

async function saveLivePrice() {
  console.log('--- Manual Scrape and Save (LivePriceOfGold) ---\n');
  
  try {
    const providers = await getActiveProviders();
    const target = providers.find(p => p.name.includes('LivePrice'));
    
    if (!target) {
      console.error('❌ Provider not found in database.');
      return;
    }

    console.log(`Scraping ${target.name}...`);
    const prices = await scrapeWithPuppeteer(target);

    if (prices && Object.keys(prices).length > 0) {
      console.log('✅ Scraped Prices:', prices);
      
      await savePrices(target.id, prices);
      console.log('💾 Successfully saved prices to database.');
    } else {
      console.error('❌ Failed to extract prices.');
    }

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

saveLivePrice();
