const { getActiveProviders } = require('./utils/db');
const { scrapeWithPuppeteer } = require('./strategies/puppeteer');
const { scrapeWithCheerio } = require('./strategies/cheerio');
const { sendHealthAlert } = require('./utils/mailer');

/**
 * Daily Provider Health Check
 * 
 * Objective: 
 * Systematically test all active gold price data sources.
 * If any provider fails to return data, notify the administrator via email.
 */

/**
 * Sanitizes strings for safe inclusion in HTML templates.
 * Prevents XSS (Cross-Site Scripting) from malicious or unexpected error messages.
 */
function sanitizeForHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function runHealthCheck() {
  console.log('--- Starting Daily Provider Health Check ---');
  console.log('Time:', new Date().toISOString());

  try {
    const providers = await getActiveProviders();
    console.log(`Testing ${providers.length} active providers...`);

    const failures = [];

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
          // Explicitly sanitize before pushing to the shared array
          const safeName = sanitizeForHTML(provider.name);
          const safeError = 'No valid price data returned';
          
          failures.push({ 
            name: safeName, 
            error: safeError 
          });
          console.warn(`   ❌ ${provider.name}: FAILED (Empty Result)`);
        } else {
          console.log(`   ✅ ${provider.name}: OK`);
        }
      } catch (err) {
        // Explicitly sanitize raw exception messages
        const safeName = sanitizeForHTML(provider.name);
        const safeError = sanitizeForHTML(err.message);

        failures.push({ 
          name: safeName, 
          error: safeError 
        });
        console.error(`   ❌ ${provider.name}: FAILED (${err.message})`);
      }
    }

    if (failures.length > 0) {
      console.log(`\n🚨 Detected ${failures.length} failures. Sending alert...`);
      await sendHealthAlert(failures);
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
