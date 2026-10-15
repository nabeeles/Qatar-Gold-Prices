const axios = require('axios');
const cheerio = require('cheerio');

async function testGoodReturns() {
  const { data: html } = await axios.get('https://www.goodreturns.in/gold-rates/qatar.html', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const $ = cheerio.load(html);
  
  // Look at tables
  $('table').each((i, table) => {
    const txt = $(table).text().replace(/\s+/g, ' ');
    if (txt.includes('Gram') || txt.includes('24') || txt.includes('22') || txt.includes('18')) {
      console.log(`\n--- Table ${i} ---`);
      console.log(txt.substring(0, 300));
      $(table).find('tr').each((j, tr) => {
        const rowTxt = $(tr).text().replace(/\s+/g, ' ').trim();
        if (rowTxt.includes('1 Gram') || rowTxt.includes('22') || rowTxt.includes('24') || rowTxt.includes('18')) {
          console.log(`  Row ${j}:`, rowTxt);
        }
      });
    }
  });
}

testGoodReturns();
