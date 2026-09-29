# Malabar Gold Resilient Multi-Tier Scraping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a high-performance, resilient multi-tier scraping solution for Malabar Gold that extracts live 22k and 24k prices directly from official sources without triggering aggregator fallback.

**Architecture:** 
1. **Tier 1 (Sub-second Fast-Path API):** Directly queries Malabar's internal pricing AJAX endpoint (`/ae/malabarprice/index/getrates/?country=QA&state=Doha`) using Node.js `fetch`. Bypasses headless browser launch, saving ~30 seconds and eliminating RAM overhead.
2. **Tier 2 (Browser Automation UI Fallback):** If the direct API is blocked or modified, Puppeteer navigates to `https://www.malabargoldanddiamonds.com/ae/goldprice`, interacts with the country and state select dropdowns (`QA` -> `Doha`), triggers `.gold-rate-btn`, and parses the updated rates from the DOM.
3. **Tier 3 (Aggregator Fail-safe):** Preserves existing fallback in `backend/scraper/index.js` to `goldpriceqatar.com` if both direct tiers fail.

**Tech Stack:** Node.js (v20+ native fetch), Puppeteer, Supabase JS Client.

## Global Constraints

- **Privacy First (Local-Only):** No user financial or personal data touched; only market rates persisted to Supabase.
- **Decimal Precision:** Rates must be formatted with two decimal places (e.g., `"463.50"`, `"502.50"`).
- **Direct-with-Fallback Mandate:** Must attempt direct extraction first and preserve the aggregator fail-safe.
- **Fail-Safe Notifications:** Primary failures that fall back must trigger `sendFallbackAlert`.

---

### Task 1: Direct Pricing Endpoint Extraction (Tier 1 Fast-Path)

**Files:**
- Modify: `backend/scraper/strategies/puppeteer.js`
- Test: `backend/scraper/tests/test_malabar_direct.js`

**Interfaces:**
- Consumes: None (HTTP endpoint `https://www.malabargoldanddiamonds.com/ae/malabarprice/index/getrates/?country=QA&state=Doha`)
- Produces: `fetchMalabarDirectApi(): Promise<{ '22k': string, '24k': string } | null>`

- [x] **Step 1: Write test for direct pricing endpoint extraction**

Create `backend/scraper/tests/test_malabar_direct.js`:
```javascript
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
```

- [x] **Step 2: Run test to verify it fails before implementation**

Run:
```bash
node backend/scraper/tests/test_malabar_direct.js
```
Expected: FAIL with `fetchMalabarDirectApi is not a function` or `undefined`.

- [x] **Step 3: Implement `fetchMalabarDirectApi` in `backend/scraper/strategies/puppeteer.js`**

Add the helper and export it:
```javascript
/**
 * Direct API extraction for Malabar Gold rates (Tier 1 Fast-Path).
 * Queries the official JSON pricing endpoint used by their regional web widget.
 * @returns {Promise<{ '22k': string, '24k': string } | null>}
 */
async function fetchMalabarDirectApi() {
  const endpoint = 'https://www.malabargoldanddiamonds.com/ae/malabarprice/index/getrates/?country=QA&state=Doha';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.malabargoldanddiamonds.com/ae/goldprice'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    if (!data || !data['22kt'] || !data['24kt']) {
      return null;
    }

    const parseRate = (val) => {
      if (!val) return null;
      const clean = val.replace(/,/g, '').replace(/[^\d.]/g, '');
      const parsed = parseFloat(clean);
      return !isNaN(parsed) && parsed > 300 && parsed < 1000 ? parsed.toFixed(2) : null;
    };

    const k22 = parseRate(data['22kt']);
    const k24 = parseRate(data['24kt']);

    if (k22 && k24) {
      return { '22k': k22, '24k': k24 };
    }

    return null;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`   [Warn] Malabar direct API request failed: ${err.message}`);
    return null;
  }
}
```

And in `scrapeWithPuppeteer(provider)`:
```javascript
if (provider.name.includes('Malabar')) {
  console.log('   [Malabar] Attempting sub-second direct API extraction...');
  const fastResult = await fetchMalabarDirectApi();
  if (fastResult && fastResult['24k'] && fastResult['22k']) {
    console.log('   ✅ [Malabar] Extracted directly via official pricing API:', fastResult);
    return fastResult;
  }
  console.log('   [Malabar] Fast-path unfulfilled, proceeding with browser automation fallback...');
}
```

- [x] **Step 4: Run test to verify it passes**

Run:
```bash
node backend/scraper/tests/test_malabar_direct.js
```
Expected: PASS with status 200, output showing valid 22k and 24k prices.

- [x] **Step 5: Commit changes**

```bash
git add backend/scraper/strategies/puppeteer.js backend/scraper/tests/test_malabar_direct.js
git commit -m "feat(scraper): implement direct API fast-path for Malabar Gold"
```

---

### Task 2: Implement Interactive Browser Fallback (Tier 2 UI Automation)

**Files:**
- Modify: `backend/scraper/strategies/puppeteer.js`
- Test: `backend/scraper/tests/test_malabar_puppeteer.js`

**Interfaces:**
- Consumes: `page.goto('https://www.malabargoldanddiamonds.com/ae/goldprice')`
- Produces: Puppeteer interaction with `#gold-country-list` and `.gold-rate-btn` returning `{ '22k': string, '24k': string }`

- [x] **Step 1: Write interactive Puppeteer test for Malabar Gold widget**

Create `backend/scraper/tests/test_malabar_puppeteer.js`:
```javascript
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
  assert(p22 > 300 && p24 > 300 && p24 > p22, 'Prices should be valid and positive');

  console.log('✅ Malabar Gold browser fallback test passed!');
}

testPuppeteerFallback().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
```

- [x] **Step 2: Implement interactive widget automation inside `backend/scraper/strategies/puppeteer.js`**

In the Malabar block inside `scrapeWithPuppeteer`:
```javascript
if (provider.name.includes('Malabar')) {
  // Tier 1 Fast-Path unless forced for testing
  if (!provider.forceBrowserFallback) {
    const fastResult = await fetchMalabarDirectApi();
    if (fastResult && fastResult['24k'] && fastResult['22k']) {
      return fastResult;
    }
  }

  // Tier 2: Browser Automation
  console.log('   [Malabar] Interacting with regional gold rate selector...');
  try {
    // Dismiss any modal
    await page.evaluate(() => {
      const selectors = ['.modal-close', '.close-btn', 'button[aria-label="Close"]', '.close'];
      selectors.forEach(s => document.querySelector(s)?.click());
    });

    // Wait for country list
    await page.waitForSelector('#gold-country-list', { timeout: 15000 });
    await page.select('#gold-country-list', 'QA');

    // Wait for state list to be populated with Doha
    await page.waitForFunction(() => {
      const stateSel = document.querySelector('#gold-state-list');
      return stateSel && Array.from(stateSel.options).some(o => o.value === 'Doha');
    }, { timeout: 15000 });

    await page.select('#gold-state-list', 'Doha');

    // Click submit button
    const submitBtn = await page.$('.gold-rate-btn');
    if (submitBtn) {
      await submitBtn.click();
    }

    // Wait for gold rates text to appear
    await page.waitForFunction(() => {
      const body = document.body ? document.body.innerText : '';
      return body.includes('QAR') && (body.includes('22 Carat') || body.includes('22kt') || body.includes('22'));
    }, { timeout: 15000 });

    const rates = await page.evaluate(() => {
      const body = document.body.innerText.replace(/\s+/g, ' ');
      const res = {};
      const k22Match = body.match(/\(?22\s*(?:Carat|KT|K)\s*Gold\)?\s*(\d+\.\d+)\s*QAR/i) ||
                       body.match(/(\d+\.\d+)\s*QAR[^\d]+22/i);
      const k24Match = body.match(/\(?24\s*(?:Carat|KT|K)\s*Gold\)?\s*(\d+\.\d+)\s*QAR/i) ||
                       body.match(/(\d+\.\d+)\s*QAR[^\d]+24/i);

      if (k22Match) res['22k'] = parseFloat(k22Match[1]).toFixed(2);
      if (k24Match) res['24k'] = parseFloat(k24Match[1]).toFixed(2);

      // Fallback regex looking for two prices near QAR
      if (!res['22k'] || !res['24k']) {
        const matches = body.match(/(\d{3}\.\d{2})\s*QAR/gi);
        if (matches && matches.length >= 2) {
          const vals = matches.map(m => parseFloat(m.replace(/[^\d.]/g, ''))).sort((a,b) => a-b);
          res['22k'] = vals[0].toFixed(2);
          res['24k'] = vals[1].toFixed(2);
        }
      }
      return res;
    });

    if (rates && rates['22k'] && rates['24k']) {
      return rates;
    }
  } catch (err) {
    console.warn(`   [Warn] Malabar browser interaction failed: ${err.message}`);
  }
}
```

- [x] **Step 3: Run test to verify it passes**

Run:
```bash
node backend/scraper/tests/test_malabar_puppeteer.js
```
Expected: PASS with valid 22k and 24k rates extracted from the DOM.

- [x] **Step 4: Commit changes**

```bash
git add backend/scraper/strategies/puppeteer.js backend/scraper/tests/test_malabar_puppeteer.js
git commit -m "feat(scraper): implement interactive DOM automation fallback for Malabar Gold"
```

---

### Task 3: Update Provider Registry and Database Schemas

**Files:**
- Modify: `backend/supabase_schema.sql`
- Modify: `scripts/admin/migrate_providers.js`
- Execute: Update Malabar provider URL in Supabase database

**Interfaces:**
- Consumes: Supabase database connection via `backend/scraper/utils/db.js`
- Produces: Provider `Malabar Gold` updated with `url = 'https://www.malabargoldanddiamonds.com/ae/goldprice'`

- [x] **Step 1: Update `backend/supabase_schema.sql`**

Update Malabar Gold initial seed line:
```sql
('Malabar Gold', 'https://www.malabargoldanddiamonds.com/ae/goldprice', 'direct', '{"24k": "24K", "22k": "22K"}'),
```

- [x] **Step 2: Update `scripts/admin/migrate_providers.js`**

Add an update step for existing Malabar Gold records:
```javascript
  const { error: errMalabar } = await supabase
    .from('providers')
    .update({ 
      url: 'https://www.malabargoldanddiamonds.com/ae/goldprice',
      scraping_type: 'direct'
    })
    .eq('name', 'Malabar Gold');

  if (errMalabar) console.error('[Migration] Failed to update Malabar URL:', errMalabar.message);
  else console.log('✅ Malabar Gold URL updated to official goldprice endpoint.');
```

- [x] **Step 3: Execute migration on live Supabase instance**

Run:
```bash
node -e "
const { supabase } = require('./backend/scraper/utils/db');
supabase.from('providers')
  .update({ url: 'https://www.malabargoldanddiamonds.com/ae/goldprice' })
  .eq('name', 'Malabar Gold')
  .then(({ data, error }) => {
    if (error) console.error(error);
    else console.log('Successfully updated Malabar Gold provider URL in Supabase.');
  });
"
```
Expected: `Successfully updated Malabar Gold provider URL in Supabase.`

- [x] **Step 4: Commit changes**

```bash
git add backend/supabase_schema.sql scripts/admin/migrate_providers.js
git commit -m "chore(db): update Malabar Gold target URL to /ae/goldprice"
```

---

### Task 4: Full Orchestrator Integration Verification

**Files:**
- Test: `backend/scraper/index.js`
- Verify: Full pipeline execution (retrieval, direct extraction, ledger persistence, alert evaluation)

**Interfaces:**
- Consumes: `getActiveProviders()`, `scrapeWithPuppeteer()`
- Produces: Log showing `✅ Extracted prices for Malabar Gold: { '22k': '...', '24k': '...' }` without entering fallback block.

- [x] **Step 1: Run full scraper cycle**

Run:
```bash
cd backend && node scraper/index.js
```
Expected:
- Malabar Gold outputs `✅ Extracted prices for Malabar Gold`
- No fallback message `Pivoting to high-fidelity aggregator...` for Malabar Gold
- Data successfully saved to Supabase `gold_prices` table

- [x] **Step 2: Verify `gold_prices` records in Supabase**

Run verification query:
```bash
node -e "
const { supabase } = require('./backend/scraper/utils/db');
supabase.from('gold_prices')
  .select('*, providers(name)')
  .order('created_at', { ascending: false })
  .limit(6)
  .then(({ data }) => console.log(data));
"
```
Expected: Latest records for provider `Malabar Gold` with 22k and 24k rates.

- [x] **Step 3: Commit and clean up test scratch files**

```bash
git add backend/scraper/
git commit -m "feat(scraper): complete resilient Malabar Gold scraper synchronization"
```
