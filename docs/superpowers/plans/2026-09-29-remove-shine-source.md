# Remove Shine Jewelers Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Shine Jewelers (`shine.qa`) from active scraping sources, fail-safe lists, database registry, and documentation since the vendor has transitioned to a Shopify storefront without public gold price tables.

**Architecture:** Deactivate the provider in the Supabase `providers` table (`is_active: false`) to preserve historical price records while cleanly excluding it from active mobile feeds and scraping crons; purge Shine from scraper fallback rules in `backend/scraper/index.js`; and update documentation across `docs/SCRAPING.md`.

**Tech Stack:** Node.js, Supabase JS Client (`@supabase/supabase-js`), Puppeteer, Cheerio, Markdown documentation.

## Global Constraints

- **Data Integrity:** Historical price records in Supabase `gold_prices` table must remain intact; use soft-deactivation (`is_active: false`) in `providers` rather than cascading hard deletion.
- **Data Sovereignty & RLS:** Mobile app queries use `provider:providers!inner(name, is_active)` with `.eq('provider.is_active', true)`. Deactivating `is_active` guarantees the mobile app stops querying and rendering Shine immediately.
- **Fail-Safe Robustness:** Critical retail fallback in `backend/scraper/index.js` must remain intact for active retail vendors (Malabar Gold, Al Fardan Exchange, Joyalukkas).

---

### Task 1: Deactivate Shine Jewelers in Supabase Provider Registry

**Files:**
- Create: `backend/scripts/deactivate_shine.js`
- Test: `backend/scripts/verify_provider_status.js`

**Interfaces:**
- Consumes: `backend/scraper/utils/db.js` (`supabase` client with `SUPABASE_SERVICE_ROLE_KEY`)
- Produces: `is_active: false` on the row where `name = 'Shine Jewelers'` in the `providers` table

- [ ] **Step 1: Write verification script to inspect current Shine status**

Create `backend/scripts/verify_provider_status.js`:
```javascript
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { supabase } = require('../scraper/utils/db');

async function checkStatus() {
  const { data, error } = await supabase
    .from('providers')
    .select('id, name, is_active, url')
    .eq('name', 'Shine Jewelers')
    .single();

  if (error) {
    console.error('Error fetching Shine:', error.message);
    process.exit(1);
  }

  console.log('Shine Jewelers status:', data);
  if (!data.is_active) {
    console.log('✅ Shine Jewelers is deactivated.');
    process.exit(0);
  } else {
    console.log('❌ Shine Jewelers is still active.');
    process.exit(2);
  }
}

checkStatus();
```

- [ ] **Step 2: Run verification script to confirm current active state**

Run: `node backend/scripts/verify_provider_status.js`
Expected: Output showing `is_active: true` and exiting with code 2 (`❌ Shine Jewelers is still active.`).

- [ ] **Step 3: Write deactivation migration script**

Create `backend/scripts/deactivate_shine.js`:
```javascript
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { supabase } = require('../scraper/utils/db');

async function deactivateShine() {
  console.log('--- Deactivating Shine Jewelers from Provider Registry ---');

  const { data, error } = await supabase
    .from('providers')
    .update({ is_active: false })
    .eq('name', 'Shine Jewelers')
    .select('id, name, is_active');

  if (error) {
    console.error('❌ Failed to deactivate Shine Jewelers:', error.message);
    process.exit(1);
  }

  console.log('✅ Successfully deactivated provider:', data);
}

deactivateShine();
```

- [ ] **Step 4: Execute deactivation and verify status**

Run: `node backend/scripts/deactivate_shine.js && node backend/scripts/verify_provider_status.js`
Expected: Output displaying `✅ Successfully deactivated provider` followed by `✅ Shine Jewelers is deactivated.` (exit code 0).

- [ ] **Step 5: Clean up one-off migration scripts and commit**

Remove temporary migration scripts if desired, or retain in `scripts/admin/deactivate_shine.js`.
```bash
git add backend/scripts/deactivate_shine.js
git commit -m "chore(database): deactivate Shine Jewelers provider in Supabase registry"
```

---

### Task 2: Remove Shine from Scraper Fallback & Orchestration Logic

**Files:**
- Modify: `backend/scraper/index.js:50-54`
- Modify: `backend/scraper/strategies/puppeteer.js:143`
- Modify / Delete: `scripts/admin/add_shine.js`

**Interfaces:**
- Consumes: `backend/scraper/utils/db.js` (`getActiveProviders`)
- Produces: Fallback evaluation targeting only `Malabar`, `Al Fardan`, and `Joyalukkas`

- [ ] **Step 1: Write unit test to verify fallback eligibility logic**

Create `backend/test_fallback_filter.js`:
```javascript
const assert = require('assert');

function isFallbackEligible(providerName) {
  return providerName.includes('Malabar') || 
         providerName.includes('Al Fardan') || 
         providerName.includes('Joyalukkas');
}

assert.strictEqual(isFallbackEligible('Malabar Gold'), true);
assert.strictEqual(isFallbackEligible('Al Fardan Exchange'), true);
assert.strictEqual(isFallbackEligible('Joyalukkas'), true);
assert.strictEqual(isFallbackEligible('Shine Jewelers'), false);
assert.strictEqual(isFallbackEligible('GoodReturns Aggregator'), false);

console.log('✅ Fallback eligibility logic test passed.');
```

- [ ] **Step 2: Update `backend/scraper/index.js`**

In `backend/scraper/index.js`, lines 50-53:
Replace:
```javascript
const isFallbackEligible = provider.name.includes('Malabar') || 
                           provider.name.includes('Al Fardan') || 
                           provider.name.includes('Joyalukkas') || 
                           provider.name.includes('Shine');
```
With:
```javascript
const isFallbackEligible = provider.name.includes('Malabar') || 
                           provider.name.includes('Al Fardan') || 
                           provider.name.includes('Joyalukkas');
```

- [ ] **Step 3: Update `backend/scraper/strategies/puppeteer.js`**

In `backend/scraper/strategies/puppeteer.js`, line 143:
Update the comment:
```javascript
// --- STRATEGY: Dynamic Heuristic (Joyalukkas, etc.) ---
```

- [ ] **Step 4: Remove obsolete `scripts/admin/add_shine.js`**

Remove `scripts/admin/add_shine.js` which contained obsolete code referencing missing `./db`.

- [ ] **Step 5: Run tests and syntax verification**

Run:
```bash
node backend/test_fallback_filter.js
node -c backend/scraper/index.js backend/scraper/strategies/puppeteer.js
rm backend/test_fallback_filter.js
```
Expected: All tests pass and syntax validation exits with code 0.

- [ ] **Step 6: Commit**

```bash
git add backend/scraper/index.js backend/scraper/strategies/puppeteer.js
git rm scripts/admin/add_shine.js
git commit -m "feat(scraper): remove Shine Jewelers from fallback list and scraper logic"
```

---

### Task 3: Update Documentation & Project Specs

**Files:**
- Modify: `docs/SCRAPING.md`
- Modify: `conductor/feature-ideas.md`

**Interfaces:**
- Consumes: Revised provider list
- Produces: Accurate documentation reflecting 5 active providers (Al Fardan, Joyalukkas, Malabar Gold, LivePriceOfGold, GoodReturns)

- [ ] **Step 1: Update `docs/SCRAPING.md`**

In `docs/SCRAPING.md`:
1. Under "1. Dynamic Engine Dispatching":
   Change:
   `Used for primary retail websites (Shine, Joyalukkas) that utilize heavy JavaScript hydration`
   To:
   `Used for primary retail websites (Joyalukkas, Malabar) that utilize heavy JavaScript hydration`
2. Under "Provider Matrix":
   Remove the row:
   `| **Shine Jewelers** | Direct | Rates Page | Stable <table> based extraction. |`
3. Under "Heuristic Fallbacks":
   Remove `Shine` references in table mapping explanations.

- [ ] **Step 2: Commit documentation changes**

```bash
git add docs/SCRAPING.md
git commit -m "docs: remove Shine Jewelers from scraping matrix and documentation"
```

---

### Task 4: End-to-End System Verification

**Files:**
- Test: `backend/scraper/health-check.js`
- Test: `backend/scraper/index.js`
- Test: Mobile app compilation (`app/hooks/useGoldPrices.ts`)

**Interfaces:**
- Consumes: Live Supabase database, live external websites
- Produces: 5 active providers synchronized, 0 health check failures

- [ ] **Step 1: Run the provider health check**

Run:
```bash
cd backend && node scraper/health-check.js
```
Expected output:
- `Testing 5 active providers...` (Shine Jewelers must NOT be present in the active list)
- Health check runs through the 5 remaining providers.

- [ ] **Step 2: Run full scraper orchestrator**

Run:
```bash
cd backend && node scraper/index.js
```
Expected output:
- `Found 5 active providers.`
- Al Fardan, Joyalukkas, LivePriceOfGold, Malabar Gold, and GoodReturns synchronize and save to database.
- Process exits with code 0.

- [ ] **Step 3: Verify mobile frontend TypeScript check**

Run:
```bash
cd app && npx tsc --noEmit
```
Expected output: 0 errors.

- [ ] **Step 4: Final commit and summary**

```bash
git status
```
Confirm clean working tree.
