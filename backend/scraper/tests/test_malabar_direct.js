const assert = require('assert');
const { fetchMalabarDirectApi } = require('../strategies/puppeteer');

async function runTest() {
  console.log('Testing fetchMalabarDirectApi...');
  const rates = await fetchMalabarDirectApi();
  console.log('Returned rates:', rates);

  assert(rates !== null, 'Rates should not be null');
  assert(typeof rates['22k'] === 'string', '22k rate should be a string');
  assert(typeof rates['24k'] === 'string', '24k rate should be a string');

  const p22 = parseFloat(rates['22k']);
  const p24 = parseFloat(rates['24k']);

  assert(!isNaN(p22) && p22 > 300 && p22 < 1000, `22k price ${p22} should be reasonable`);
  assert(!isNaN(p24) && p24 > 300 && p24 < 1000, `24k price ${p24} should be reasonable`);
  assert(p24 > p22, `24k price ${p24} must be greater than 22k price ${p22}`);

  console.log('✅ fetchMalabarDirectApi test passed successfully!');
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
