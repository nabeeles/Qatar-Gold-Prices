const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isValidGoldPrice,
  validateProviderPrices,
  normalizePriceMap,
  isFallbackEligible,
  formatAlertPrice,
} = require('../utils/validation');
const { buildFallbackEmailContent } = require('../utils/mailer');

test('isValidGoldPrice accepts plausible QAR/g rates and rejects outliers or NaN', () => {
  assert.equal(isValidGoldPrice(320.5), true);
  assert.equal(isValidGoldPrice(100), true);
  assert.equal(isValidGoldPrice(2000), true);
  assert.equal(isValidGoldPrice(50), false);
  assert.equal(isValidGoldPrice(2500), false);
  assert.equal(isValidGoldPrice(NaN), false);
});

test('validateProviderPrices filters out invalid karats and out-of-range prices', () => {
  const raw = [
    { karat: 24, price_per_gram: 325.5, currency: 'QAR' },
    { karat: 22, price_per_gram: 12.0, currency: 'QAR' }, // invalid low
    { karat: 99, price_per_gram: 300.0, currency: 'QAR' }, // invalid karat
    { karat: 18, price_per_gram: 245.0, currency: 'QAR' },
  ];
  const valid = validateProviderPrices(raw);
  assert.equal(valid.length, 2);
  assert.deepEqual(valid.map((p) => p.karat), [24, 18]);
});

test('validateProviderPrices and normalizePriceMap reject inverted karat hierarchies (e.g. 22K > 24K)', () => {
  const invertedArray = [
    { karat: 24, price_per_gram: 300.0, currency: 'QAR' },
    { karat: 22, price_per_gram: 350.0, currency: 'QAR' },
  ];
  assert.deepEqual(validateProviderPrices(invertedArray), []);

  const invertedMap = { '24k': '300.00', '22k': '350.00' };
  assert.deepEqual(normalizePriceMap(invertedMap), {});
  assert.equal(isFallbackEligible(invertedMap), true);
});

test('normalizePriceMap normalizes strategy price maps and filters invalid entries', () => {
  const rawMap = { '24k': '325.5', '22k': '302', '99k': '310', '18k': '15.0' };
  const normalized = normalizePriceMap(rawMap);
  assert.deepEqual(normalized, { '24k': '325.50', '22k': '302.00' });
});

test('isFallbackEligible returns true when extracted prices are empty or missing critical karats (24K/22K)', () => {
  assert.equal(isFallbackEligible([]), true);
  assert.equal(isFallbackEligible([{ karat: 18, price_per_gram: 245 }]), true);
  assert.equal(
    isFallbackEligible([
      { karat: 24, price_per_gram: 325 },
      { karat: 22, price_per_gram: 302 },
    ]),
    false
  );
  assert.equal(isFallbackEligible({ '24k': '325.00' }), true);
  assert.equal(isFallbackEligible({ '24k': '325.00', '22k': '302.00' }), false);
});

test('formatAlertPrice formats notification prices to strictly 2 decimal places', () => {
  assert.equal(formatAlertPrice(320), '320.00');
  assert.equal(formatAlertPrice(320.456), '320.46');
});

test('buildFallbackEmailContent differentiates fallback success vs critical total failure', () => {
  const okMail = buildFallbackEmailContent('Malabar Gold', 'Primary returned 0 valid prices', true);
  assert.match(okMail.subject, /Fallback Activated/i);
  assert.match(okMail.text, /Fallback to 'goldpriceqatar\.com' succeeded/i);

  const failMail = buildFallbackEmailContent('Malabar Gold', 'Both primary and fallback failed', false);
  assert.match(failMail.subject, /CRITICAL.*Extraction Failed/i);
  assert.match(failMail.text, /Both primary and fallback extraction failed/i);
});

test('extractPricesFromHtml extracts 1-gram QAR rates from GoodReturns multi-table HTML and ignores deltas/INR tables', () => {
  const { extractPricesFromHtml } = require('../strategies/cheerio');
  const html = `
    <html><body>
      <table class="gr-table table-conatiner">
        <thead class="tabelhead">
          <tr><th>Gram</th><th>24K</th><th>22K</th><th>18K</th></tr>
        </thead>
        <tbody class="tablebody">
          <tr>
            <td>1</td>
            <td><span class="currency-symbol-left">﷼</span>501.50 <span class="gr-delta-up">(+7.50)</span></td>
            <td><span class="currency-symbol-left">﷼</span>462 <span class="gr-delta-up">(+6.50)</span></td>
            <td><span class="currency-symbol-left">﷼</span>378 <span class="gr-delta-up">(+5.30)</span></td>
          </tr>
          <tr>
            <td>100</td>
            <td>﷼50,150 (+750)</td>
            <td>﷼46,200 (+650)</td>
            <td>﷼37,800 (+530)</td>
          </tr>
        </tbody>
      </table>
      <table class="gr-table table-conatiner">
        <thead><tr><th>Gram</th><th>24K</th><th>22K</th><th>18K</th></tr></thead>
        <tbody><tr><td>1</td><td>₹13,039</td><td>₹12,012</td><td>₹9,828</td></tr></tbody>
      </table>
    </body></html>
  `;

  const extracted = extractPricesFromHtml(html, {
    name: 'GoodReturns Aggregator',
    url: 'https://www.goodreturns.in/gold-rates/qatar.html',
  });

  assert.deepEqual(extracted, {
    '24k': '501.50',
    '22k': '462.00',
    '18k': '378.00',
  });
});
