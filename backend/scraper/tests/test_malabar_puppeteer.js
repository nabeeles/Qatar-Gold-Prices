const assert = require('assert');
const { scrapeWithPuppeteer } = require('../strategies/puppeteer');

async function testPuppeteerFallback() {
  console.log('Testing Malabar Gold browser UI automation...');
  const provider = {
    name: 'Malabar Gold (Browser Fallback)',
    url: 'https://www.malabargoldanddiamonds.com/ae/goldprice',
    scraping_type: 'direct',
    // Force skip Tier 1 to test Tier 2 directly
    forceBrowserFallback: true
  };

  const rates = await scrapeWithPuppeteer(provider);
  console.log('Scraped rates:', rates);

  assert(rates !== null, 'Scraped rates should not be null');
  assert(rates['22k'] && rates['24k'], 'Should contain 22k and 24k');
  const p22 = parseFloat(rates['22k']);
  const p24 = parseFloat(rates['24k']);
  assert(!isNaN(p22) && p22 > 300, `22k price ${p22} should be greater than 300`);
  assert(!isNaN(p24) && p24 > 300, `24k price ${p24} should be greater than 300`);
  assert(p24 > p22, `24k price ${p24} must be greater than 22k price ${p22}`);

  console.log('✅ Malabar Gold browser fallback test passed!');
}

testPuppeteerFallback().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
