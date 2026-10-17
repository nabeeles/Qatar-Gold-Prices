const axios = require('axios');
const cheerio = require('cheerio');
const { isValidGoldPrice, normalizePriceMap } = require('../utils/validation');

/**
 * Parse HTML and extract normalized karat prices for a provider.
 *
 * @param {string} html
 * @param {{ name: string, url: string }} provider
 * @returns {Record<string, string>}
 */
function extractPricesFromHtml(html, provider) {
  const $ = cheerio.load(html);

  // Clean up HTML: Remove scripts, styles, and other non-text elements
  $('script, style, noscript, iframe, .adsbygoogle').remove();

  const results = {};

  /**
   * DOM-Specific Strategy: livepriceofgold.com
   */
  if (provider.url.includes('livepriceofgold.com')) {
    console.log('   [Aggregator] Applying high-fidelity table extraction for livepriceofgold.com...');
    $('tr').each((i, row) => {
      const text = $(row).text().toUpperCase();
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const price = $(cells[1]).text().trim().replace(/,/g, '');
        const val = parseFloat(price);
        if (isValidGoldPrice(val)) {
          if (text.includes('24K')) results['24k'] = price;
          else if (text.includes('22K')) results['22k'] = price;
          else if (text.includes('21K')) results['21k'] = price;
          else if (text.includes('18K')) results['18k'] = price;
        }
      }
    });
    const validated = normalizePriceMap(results);
    if (Object.keys(validated).length > 0) return validated;
  }

  /**
   * DOM-Specific Strategy: goodreturns.in
   */
  if (provider.url.includes('goodreturns.in')) {
    console.log('   [Aggregator] Applying high-fidelity table extraction for goodreturns.in...');
    $('table').each((_, table) => {
      if (results['24k'] && results['22k']) return;

      const colToKarat = {};
      $(table)
        .find('thead th, tr:first-child th')
        .each((colIdx, th) => {
          const headerText = $(th).text().trim().toUpperCase();
          const match = headerText.match(/\b(24|22|21|18)\s*K\b/);
          if (match) {
            colToKarat[colIdx] = `${match[1]}k`;
          }
        });

      if (Object.keys(colToKarat).length === 0) return;

      $(table)
        .find('tbody tr, tr')
        .each((__, row) => {
          const cells = $(row).find('td');
          if (cells.length < 2) return;

          const gramLabel = $(cells[0]).text().trim();
          if (!/^1(?:\s*gram)?$/i.test(gramLabel)) return;

          for (const [colIdxStr, karatKey] of Object.entries(colToKarat)) {
            const colIdx = Number(colIdxStr);
            if (colIdx >= cells.length || results[karatKey]) continue;

            const cellClone = $(cells[colIdx]).clone();
            cellClone.find('[class*="delta"]').remove();
            const cleanedText = cellClone
              .text()
              .replace(/\([^)]*\)/g, '')
              .replace(/,/g, '');
            const priceMatch = cleanedText.match(/(\d+(?:\.\d{1,2})?)/);
            if (priceMatch && isValidGoldPrice(priceMatch[1])) {
              results[karatKey] = priceMatch[1];
            }
          }
        });
    });

    const validated = normalizePriceMap(results);
    if (Object.keys(validated).length > 0) return validated;
  }

  // Strip parenthetical price deltas (e.g. "(+750)") so they are never mistaken for spot rates
  const bodyText = $('body')
    .text()
    .replace(/\([+-]?[\d.,\s%]+\)/g, ' ')
    .replace(/\s+/g, ' ');

  /**
   * findPrice (Heuristic Engine)
   */
  const findPrice = (karatLabel, assignedPrices = []) => {
    let price = null;
    const startIndex = bodyText.toLowerCase().indexOf(karatLabel.toLowerCase());
    if (startIndex === -1) return null;

    const windowSize = 300;
    const searchArea = bodyText.substring(startIndex, startIndex + windowSize);

    const matches = searchArea.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g);

    if (matches) {
      const candidates = matches
        .map((n) => n.replace(/,/g, ''))
        .filter((n) => {
          const val = parseFloat(n);
          return isValidGoldPrice(val) && !assignedPrices.includes(n);
        });

      if (candidates.length > 0) {
        price = candidates[0];
      }
    }
    return price;
  };

  /**
   * Brand-Specific High-Fidelity Mapping
   */
  const brandPattern = new RegExp(`${provider.name.split(' ')[0]} is\\s*(\\d+(?:\\.\\d{1,2})?)`, 'i');
  const match = bodyText.match(brandPattern);
  if (match && isValidGoldPrice(match[1])) {
    results['24k'] = match[1];
  }

  // Apply General Heuristic for all categories (24k, 22k, 21k, 18k)
  const used = Object.values(results).filter((v) => !!v);

  if (!results['24k']) {
    results['24k'] =
      findPrice('24 Karat', used) ||
      findPrice('24KT', used) ||
      findPrice('24K', used) ||
      findPrice('24ct', used);
    if (results['24k']) used.push(results['24k']);
  }

  if (!results['22k']) {
    results['22k'] =
      findPrice('22 Karat', used) ||
      findPrice('22KT', used) ||
      findPrice('22K', used) ||
      findPrice('22ct', used);
    if (results['22k']) used.push(results['22k']);
  }

  if (!results['21k']) {
    results['21k'] =
      findPrice('21 Karat', used) ||
      findPrice('21KT', used) ||
      findPrice('21K', used) ||
      findPrice('21ct', used);
    if (results['21k']) used.push(results['21k']);
  }

  if (!results['18k']) {
    results['18k'] =
      findPrice('18 Karat', used) ||
      findPrice('18KT', used) ||
      findPrice('18K', used) ||
      findPrice('18ct', used);
  }

  return normalizePriceMap(results);
}

/**
 * Cheerio Scraping Strategy
 */
async function scrapeWithCheerio(provider) {
  try {
    console.log(`[Cheerio] Synchronizing market data for ${provider.name}...`);
    const { data: html } = await axios.get(provider.url, {
      timeout: 30000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      },
    });

    return extractPricesFromHtml(html, provider);
  } catch (error) {
    console.error(`[Cheerio] Network or validation error for ${provider.name}:`, error.message);
    return null;
  }
}

module.exports = { scrapeWithCheerio, extractPricesFromHtml };
