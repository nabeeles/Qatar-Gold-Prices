const { getActiveProviders } = require('./utils/db');
const { scrapeWithPuppeteer } = require('./strategies/puppeteer');
const { scrapeWithCheerio } = require('./strategies/cheerio');
const { sendHealthAlert } = require('./utils/mailer');
const escapeHTML = require('escape-html');

/**
 * Daily Provider Health Check
 */

async function runHealthCheck() {
  console.log('--- Starting Daily Provider Health Check ---');
  console.log('Time:', new Date().toISOString());

  try {
    const providers = await getActiveProviders();
    console.log(`Testing ${providers.length} active providers...`);

    const failureItems = [];

    for (const provider of providers) {
      console.log(`   [Test] ${provider.name}...`);
      let result = null;

      try {
        if (provider.scraping_type === 'direct') {
          result = await scrapeWithPuppeteer(provider);
        } else {
          result = await scrapeWithCheerio(provider);
        }

        if (!result || Object.keys(result).length === 0 || (!result['24k'] && !result['22k'])) {
          const safeName = escapeHTML(provider.name);
          const safeError = 'No valid price data returned';
          failureItems.push(`<li><b>${safeName}</b>: ${safeError}</li>`);
          console.warn(`   ❌ ${provider.name}: FAILED (Empty Result)`);
        } else {
          console.log(`   ✅ ${provider.name}: OK`);
        }
      } catch (err) {
        const safeName = escapeHTML(provider.name);
        const safeError = escapeHTML(err.message);
        failureItems.push(`<li><b>${safeName}</b>: ${safeError}</li>`);
        console.error(`   ❌ ${provider.name}: FAILED (${err.message})`);
      }
    }

    if (failureItems.length > 0) {
      console.log(`\n🚨 Detected ${failureItems.length} failures. Sending alert...`);
      await sendHealthAlert(failureItems.join(''));
    } else {
      console.log('\n🌟 All systems healthy. No action required.');
    }

    console.log('--- Health Check Finished ---');
  } catch (error) {
    console.error('CRITICAL SYSTEM ERROR during health check:', error.message);
    process.exit(1);
  }
}

runHealthCheck();
