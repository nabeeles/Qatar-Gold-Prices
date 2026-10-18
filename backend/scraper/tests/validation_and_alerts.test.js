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

test('buildFallbackEmailContent formats direct extraction failure alert without aggregator fallback', () => {
  const failMail = buildFallbackEmailContent('Malabar Gold', 'Primary returned 0 valid prices', false);
  assert.match(failMail.subject, /CRITICAL.*Extraction Failed/i);
  assert.match(failMail.text, /Primary extraction failed for 'Malabar Gold'/i);
  assert.doesNotMatch(failMail.text, /goldpriceqatar\.com/i);
});

test('fetchMalabarDirectApi recovers from GeoIP redirect (/ae/ -> /us/) when running on US/GitHub Actions IPs', async () => {
  const { fetchMalabarDirectApi } = require('../strategies/puppeteer');
  const calls = [];

  const mockFetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/ae/malabarprice/')) {
      // Simulate Magento GeoIP 302 redirect from /ae/... to /us/ homepage returning HTML
      return {
        ok: true,
        status: 200,
        url: 'https://www.malabargoldanddiamonds.com/us/',
        headers: { get: () => 'text/html; charset=UTF-8' },
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
      };
    }
    if (url.includes('/us/malabarprice/')) {
      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => 'application/json' },
        json: async () => ({
          '22kt': '465.50 QAR',
          '24kt': '505.00 QAR',
          updated_time: '16/10/2026 05:58 PM',
        }),
      };
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await fetchMalabarDirectApi(mockFetch);
  assert.deepEqual(result, { '22k': '465.50', '24k': '505.00' });
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/ae\/malabarprice\/index\/getrates\/\?country=QA&state=Doha/);
  assert.match(calls[1].url, /\/us\/malabarprice\/index\/getrates\/\?country=QA&state=Doha/);
  assert.equal(calls[1].options.headers.Referer, 'https://www.malabargoldanddiamonds.com/us/goldprice');
});

test('resolveMalabarGoldPriceUrl detects GeoIP homepage redirect and resolves regional /goldprice URL', () => {
  const { resolveMalabarGoldPriceUrl } = require('../strategies/puppeteer');

  // Redirected from /ae/goldprice to /us/ homepage on US IP
  assert.equal(
    resolveMalabarGoldPriceUrl(
      'https://www.malabargoldanddiamonds.com/ae/goldprice',
      'https://www.malabargoldanddiamonds.com/us/'
    ),
    'https://www.malabargoldanddiamonds.com/us/goldprice'
  );

  // Redirected without trailing slash
  assert.equal(
    resolveMalabarGoldPriceUrl(
      'https://www.malabargoldanddiamonds.com/ae/goldprice',
      'https://www.malabargoldanddiamonds.com/uk'
    ),
    'https://www.malabargoldanddiamonds.com/uk/goldprice'
  );

  // Not redirected (already on /goldprice)
  assert.equal(
    resolveMalabarGoldPriceUrl(
      'https://www.malabargoldanddiamonds.com/ae/goldprice',
      'https://www.malabargoldanddiamonds.com/ae/goldprice'
    ),
    null
  );
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

test('fetchAlFardanDirectApi extracts 24K 1g Fortuna bar and 22K per-gram Sovereign coin rate from /api/gold-rates JSON', async () => {
  const { fetchAlFardanDirectApi } = require('../strategies/puppeteer');

  const mockFetchJson = async (url) => {
    assert.equal(url, 'https://alfardanexchange.com.qa/api/gold-rates');
    return {
      data: [
        {
          product_code: '1.G-401',
          display_label: '1 Gm',
          rate: 568,
          price: 568,
          product_description: ' PAMP-MINTED 1 GRAM GOLD FORTUNA BAR- 24 KARAT',
        },
        {
          product_code: '7.99G22UK-505',
          display_label: '7.98 Gm',
          rate: 3930,
          price: 3930,
          product_description: 'TRM-COIN 7.98 GRAM GOLD THE SOVEREIGN COIN - 22 KARAT',
        },
      ],
    };
  };

  const result = await fetchAlFardanDirectApi(mockFetchJson);
  assert.deepEqual(result, {
    '24k': '568.00',
    '22k': (3930 / 7.98).toFixed(2),
  });
});

test('fetchAlFardanDirectApi fails over to upstream alfaremit.com:7095 master API and parses returnObject.data schema', async () => {
  const { fetchAlFardanDirectApi, parseAlFardanApiPayload } = require('../strategies/puppeteer');
  const calls = [];

  const mockFetchJson = async (url) => {
    calls.push(url);
    if (url.includes('alfardanexchange.com.qa')) {
      throw new Error('connect ETIMEDOUT 89.211.60.244:443');
    }
    if (url.includes('alfaremit.com:7095')) {
      return {
        returnCode: 200,
        returnMsg: 'Data retrieved successfully.',
        returnObject: {
          data: [
            {
              productCode: '1.G-401',
              productdescription: ' PAMP-MINTED 1 GRAM GOLD FORTUNA BAR- 24 KARAT',
              price: 568,
              rate: 568,
              grossWeight: 1,
            },
            {
              productCode: '7.99G22UK-505',
              productdescription: 'TRM-COIN 7.98 GRAM GOLD THE SOVEREIGN COIN - 22 KARAT',
              price: 3930,
              rate: 3930,
              grossWeight: 7.98,
            },
          ],
        },
      };
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await fetchAlFardanDirectApi(mockFetchJson);
  assert.deepEqual(result, {
    '24k': '568.00',
    '22k': (3930 / 7.98).toFixed(2),
  });
  assert.equal(calls.length, 2);
  assert.match(calls[0], /alfardanexchange\.com\.qa\/api\/gold-rates/);
  assert.match(calls[1], /alfaremit\.com:7095\/api\/MetalProductApp\/MetalProductAppList/);

  // Also verify raw JSON string parsing support
  const parsedFromString = parseAlFardanApiPayload(
    JSON.stringify({
      returnObject: {
        data: [
          { productCode: '1.G-401', price: 568 },
          { productCode: '7.99G22UK-505', price: 3930 },
        ],
      },
    })
  );
  assert.deepEqual(parsedFromString, {
    '24k': '568.00',
    '22k': (3930 / 7.98).toFixed(2),
  });
});



