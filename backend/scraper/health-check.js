const { getActiveProviders } = require('./utils/db');
const { scrapeWithPuppeteer, launchScraperBrowser } = require('./strategies/puppeteer');
const { scrapeWithCheerio } = require('./strategies/cheerio');
const { sendHealthAlert } = require('./utils/mailer');
const { isFallbackEligible } = require('./utils/validation');
const escapeHTML = require('escape-html');

/**
 * Daily Provider Health Check
 */

async function runHealthCheck() {
  console.log('--- Starting Daily Provider Health Check ---');
  console.log('Time:', new Date().toISOString());

  let sharedBrowser = null;

  try {
    const providers = await getActiveProviders();
    console.log(`Testing ${providers.length} active providers...`);

    const hasDirectProviders = providers.some(p => p.scraping_type === 'direct');
    if (hasDirectProviders) {
      sharedBrowser = await launchScraperBrowser();
    }

    const failureItems = [];

    for (const provider of providers) {
      console.log(`   [Test] ${provider.name}...`);
      let result = null;

      try {
        if (provider.scraping_type === 'direct') {
          result = await scrapeWithPuppeteer(provider, sharedBrowser);
        } else {
          result = await scrapeWithCheerio(provider);
        }

        if (isFallbackEligible(result)) {
          const safeName = escapeHTML(provider.name);
          const safeError = 'No valid or complete (24K + 22K) price data returned';
          failureItems.push(`<li><b>${safeName}</b>: ${safeError}</li>`);
          console.warn(`   ❌ ${provider.name}: FAILED (Empty or Partial Result)`);
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
      process.exitCode = 1;
    } else {
      console.log('\n🌟 All systems healthy. No action required.');
    }

    console.log('--- Health Check Finished ---');
  } catch (error) {
    console.error('CRITICAL SYSTEM ERROR during health check:', error.message);
    process.exit(1);
  } finally {
    if (sharedBrowser) {
      await sharedBrowser.close().catch(() => {});
    }
  }
}

runHealthCheck();
