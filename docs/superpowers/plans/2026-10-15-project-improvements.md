# Qatar Gold Prices — Project Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all data-accuracy, mandate-compliance, scraper-reliability, UX, and schema/documentation defects identified in the project review.

**Architecture:** Extract pure, unit-testable utilities for currency/date formatting (`app/lib/format.ts`), latest-price deduplication and historical windowing (`app/lib/priceUtils.ts`), and backend price/fallback validation (`backend/scraper/utils/validation.js`). Wire these into the Expo React Native hooks/screens and the Node.js scraper orchestrator, enforce `GEMINI.md` mandates across all screens and workflows, and synchronize SQL schemas and documentation.

**Tech Stack:** React Native (Expo SDK 54, Expo Router 6, TanStack Query 5, `expo-sqlite`, NativeWind), Node.js (Puppeteer, Cheerio, Nodemailer, `@supabase/supabase-js`, `node:test`), Supabase PostgreSQL + RLS, GitHub Actions.

**Spec:** `GEMINI.md`, `docs/ARCHITECTURE.md`, `docs/SCRAPING.md`, `docs/API.md`, `docs/SECURITY_AUDIT.md`

## Global Constraints

- **Privacy First (Local-Only):** All user portfolio data (purchases, labels, weights) MUST be stored strictly in the local SQLite database. No PII or financial data shall ever be transmitted to external services.
- **Decimal Precision:** Financial values (Total Value, P/L, Price per Gram) must strictly display exactly two decimal places using the `formatCurrency` utility.
- **Data Sovereignty:** The Supabase backend is used EXCLUSIVELY for market prices and system health; user assets never leave the device.
- **Fail-Safe Notifications:** Every fallback event or primary extraction failure MUST trigger an immediate email notification to the administrator via `sendFallbackAlert`.
- **Smart-Sync Entry:** The asset input form must support bi-directional price calculation. Entering "Weight" and either "Price per Gram" OR "Total Price" must automatically calculate and display the missing component.
- **Native Stability:** Use `KeyboardAvoidingView` for all forms and restrict `DateTimePicker` to a `maximumDate` of today.

## Review Focus

1. **Non-finite or zero numeric inputs (`NaN`, `Infinity`, `0`) in `formatCurrency` and percentage calculations:** `formatCurrency(NaN)` must return `'0.00'` rather than `'NaN'`, and `trends.tsx` percentage calculation must return `0` when the baseline price is `0`.
2. **Multi-run historical rows in `useLatestPrices` skewing `useVault` portfolio valuation:** When a provider has multiple historical rows in the query result, `computeMarketAverages` must deduplicate to the single newest row per `(provider, karat)` before averaging across providers.
3. **Negative UTC timezone offset shifting `YYYY-MM-DD` vault purchase dates by 1 day:** `parseLocalDate('2026-10-15')` must construct a local midnight `Date` whose `.getDate()` is `15` in every timezone.
4. **Multiple direct providers failing in the same scraper run:** `goldpriceqatar.com` fallback must be fetched at most once per run, `sendFallbackAlert` must fire for each fallback event and total failure, and fallback rows must not be double-counted when computing market averages for push alerts.
5. **Inverted or out-of-bounds scraped karat prices (e.g., 18K > 24K or price = 9999):** `validateProviderPrices` must reject prices outside `[100, 2000]` QAR/g and reject inverted karat hierarchies where a lower karat has a strictly higher price than a higher karat from the same provider.

---

### Task 1: Shared Financial Formatting & Local Date Utilities (`app/lib/format.ts`)

**Files:**
- Create: `app/lib/format.ts`
- Create: `app/lib/__tests__/format.test.ts`
- Modify: `app/components/PriceCard.tsx`
- Modify: `app/app/(tabs)/index.tsx`
- Modify: `app/app/(tabs)/calculator.tsx`
- Modify: `app/app/(tabs)/trends.tsx`
- Modify: `app/app/(tabs)/vault.tsx`

**Interfaces:**
- Produces:
  - `formatCurrency(val: number): string` in `app/lib/format.ts`
  - `parseLocalDate(dateStr: string): Date` in `app/lib/format.ts`

- [x] **Step 1: Write the failing unit tests for `formatCurrency` and `parseLocalDate`**

Create `app/lib/__tests__/format.test.ts`:
```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrency, parseLocalDate } from '../format.ts';

describe('formatCurrency', () => {
  it('formats integers with strictly two decimal places', () => {
    assert.equal(formatCurrency(580), '580.00');
  });

  it('rounds floating point numbers to two decimal places', () => {
    assert.equal(formatCurrency(584.333333), '584.33');
    assert.equal(formatCurrency(584.339), '584.34');
  });

  it('includes thousands separators for large values', () => {
    assert.equal(formatCurrency(12345.6), '12,345.60');
  });

  it('returns 0.00 for NaN or non-finite values', () => {
    assert.equal(formatCurrency(Number.NaN), '0.00');
    assert.equal(formatCurrency(Number.POSITIVE_INFINITY), '0.00');
  });
});

describe('parseLocalDate', () => {
  it('parses YYYY-MM-DD in local time without UTC day shift', () => {
    const d = parseLocalDate('2026-10-15');
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 9); // 0-indexed October
    assert.equal(d.getDate(), 15);
  });

  it('falls back to standard Date parsing for full ISO timestamps', () => {
    const d = parseLocalDate('2026-10-15T12:30:00.000Z');
    assert.equal(Number.isNaN(d.getTime()), false);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test app/lib/__tests__/format.test.ts`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `../format.ts`.

- [x] **Step 3: Implement `app/lib/format.ts`**

Create `app/lib/format.ts`:
```typescript
/**
 * Formats a numeric financial value to strictly two decimal places
 * per GEMINI.md mandate.
 */
export function formatCurrency(val: number): string {
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    return '0.00';
  }
  return val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parses a YYYY-MM-DD string as local midnight rather than UTC midnight
 * so negative UTC offsets never shift the displayed calendar date.
 */
export function parseLocalDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
}
```

- [x] **Step 4: Run the unit tests to verify they pass**

Run: `node --test app/lib/__tests__/format.test.ts`
Expected: PASS (6/6 tests passing).

- [x] **Step 5: Enforce `formatCurrency` and `parseLocalDate` across all mobile screens and components**

1. In `app/components/PriceCard.tsx`:
   - Import `{ formatCurrency } from '@/lib/format';`
   - Replace `{p.price}` with `{formatCurrency(p.price)}`.
2. In `app/app/(tabs)/index.tsx`:
   - Import `{ formatCurrency } from '@/lib/format';`
   - Replace `{averagePrice.toFixed(2)}` with `{formatCurrency(averagePrice)}`.
3. In `app/app/(tabs)/calculator.tsx`:
   - Import `{ formatCurrency } from '@/lib/format';`
   - Replace `unitPrice.toFixed(2)`, `baseGoldPrice.toFixed(2)`, `makingTotal.toFixed(2)`, and `grandTotal.toFixed(2)` with `formatCurrency(...)`.
4. In `app/app/(tabs)/trends.tsx`:
   - Import `{ formatCurrency } from '@/lib/format';`
   - Guard `percent` calculation against `first === 0`: `const percent = first > 0 ? (change / first) * 100 : 0;`
   - Replace `stats.current.toFixed(2)`, `Math.abs(stats.change).toFixed(2)`, `stats.high.toFixed(2)`, and `stats.low.toFixed(2)` with `formatCurrency(...)`.
5. In `app/app/(tabs)/vault.tsx`:
   - Replace local `const formatCurrency = ...` definition with `import { formatCurrency, parseLocalDate } from '@/lib/format';`
   - In `AssetCard`, replace `new Date(entry.purchase_date).toLocaleDateString(...)` with `parseLocalDate(entry.purchase_date).toLocaleDateString(...)`.

- [x] **Step 6: Verify TypeScript compilation and tests**

Run: `cd app && npx tsc --noEmit && node --test lib/__tests__/format.test.ts`
Expected: 0 TypeScript errors and all tests passing.

---

### Task 2: Price Deduplication, Market Averages & Historical Windowing (`app/lib/priceUtils.ts`, `app/hooks/useGoldPrices.ts`, `app/hooks/useVault.ts`)

**Files:**
- Create: `app/lib/priceUtils.ts`
- Create: `app/lib/__tests__/priceUtils.test.ts`
- Modify: `app/hooks/useGoldPrices.ts`
- Modify: `app/hooks/useVault.ts`

**Interfaces:**
- Produces:
  - `deduplicateLatestPrices<T extends PriceRowLike>(rows: T[]): T[]` in `app/lib/priceUtils.ts`
  - `computeMarketAverages(rows: PriceRowLike[]): Record<number, number>` in `app/lib/priceUtils.ts`
  - `getHistoricalCutoffIso(days?: number, now?: Date): string` in `app/lib/priceUtils.ts`

- [x] **Step 1: Write failing unit tests for `priceUtils.ts`**

Create `app/lib/__tests__/priceUtils.test.ts`:
```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deduplicateLatestPrices,
  computeMarketAverages,
  getHistoricalCutoffIso,
} from '../priceUtils.ts';

describe('deduplicateLatestPrices', () => {
  it('keeps only the newest row per provider and karat', () => {
    const rows = [
      {
        id: '1',
        provider_id: 'p1',
        karat: 24,
        price_per_gram: 600,
        scraped_at: '2026-10-15T12:00:00Z',
        provider: { name: 'Malabar Gold', is_active: true },
      },
      {
        id: '2',
        provider_id: 'p1',
        karat: 24,
        price_per_gram: 550,
        scraped_at: '2026-10-14T12:00:00Z',
        provider: { name: 'Malabar Gold', is_active: true },
      },
      {
        id: '3',
        provider_id: 'p2',
        karat: 24,
        price_per_gram: 610,
        scraped_at: '2026-10-15T12:00:00Z',
        provider: { name: 'Joyalukkas', is_active: true },
      },
    ];

    const deduped = deduplicateLatestPrices(rows);
    assert.equal(deduped.length, 2);
    assert.equal(deduped[0].id, '1');
    assert.equal(deduped[1].id, '3');
  });

  it('sorts unsorted rows by scraped_at DESC before deduplicating', () => {
    const rows = [
      {
        id: 'old',
        provider_id: 'p1',
        karat: 22,
        price_per_gram: 500,
        scraped_at: '2026-10-01T12:00:00Z',
        provider: { name: 'Malabar Gold' },
      },
      {
        id: 'new',
        provider_id: 'p1',
        karat: 22,
        price_per_gram: 560,
        scraped_at: '2026-10-15T12:00:00Z',
        provider: { name: 'Malabar Gold' },
      },
    ];

    const deduped = deduplicateLatestPrices(rows);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0].id, 'new');
    assert.equal(deduped[0].price_per_gram, 560);
  });
});

describe('computeMarketAverages', () => {
  it('computes average across providers using only the latest price per provider', () => {
    const rows = [
      // Malabar latest: 600, plus 3 old historical rows at 500
      { provider_id: 'p1', karat: 24, price_per_gram: 600, scraped_at: '2026-10-15T12:00:00Z', provider: { name: 'Malabar Gold' } },
      { provider_id: 'p1', karat: 24, price_per_gram: 500, scraped_at: '2026-10-14T12:00:00Z', provider: { name: 'Malabar Gold' } },
      { provider_id: 'p1', karat: 24, price_per_gram: 500, scraped_at: '2026-10-13T12:00:00Z', provider: { name: 'Malabar Gold' } },
      // Joyalukkas latest: 620
      { provider_id: 'p2', karat: 24, price_per_gram: 620, scraped_at: '2026-10-15T12:00:00Z', provider: { name: 'Joyalukkas' } },
    ];

    const averages = computeMarketAverages(rows);
    // Average of 600 and 620 is 610 (NOT skewed down by the 500s)
    assert.equal(averages[24], 610);
  });
});

describe('getHistoricalCutoffIso', () => {
  it('returns an ISO timestamp N days prior to the reference date', () => {
    const ref = new Date('2026-10-15T00:00:00.000Z');
    const cutoff = getHistoricalCutoffIso(30, ref);
    assert.equal(cutoff, '2026-09-15T00:00:00.000Z');
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test app/lib/__tests__/priceUtils.test.ts`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `../priceUtils.ts`.

- [x] **Step 3: Implement `app/lib/priceUtils.ts`**

Create `app/lib/priceUtils.ts`:
```typescript
export interface PriceRowLike {
  provider_id?: string;
  karat: number;
  price_per_gram: number;
  scraped_at: string;
  provider?: {
    name: string;
    is_active?: boolean;
  };
}

/**
 * Deduplicates price rows so only the newest row per (provider, karat) is retained.
 */
export function deduplicateLatestPrices<T extends PriceRowLike>(rows: T[]): T[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const sorted = [...rows].sort(
    (a, b) => new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime()
  );

  const seen = new Set<string>();
  const result: T[] = [];

  for (const row of sorted) {
    const providerKey = row.provider?.name || row.provider_id || 'unknown';
    const key = `${providerKey}::${row.karat}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(row);
    }
  }

  return result;
}

/**
 * Computes current market average per karat across active providers
 * after deduplicating to the latest row per provider and karat.
 */
export function computeMarketAverages(rows: PriceRowLike[]): Record<number, number> {
  const latestRows = deduplicateLatestPrices(rows);
  const totals: Record<number, { sum: number; count: number }> = {};

  for (const row of latestRows) {
    if (!totals[row.karat]) {
      totals[row.karat] = { sum: 0, count: 0 };
    }
    totals[row.karat].sum += Number(row.price_per_gram);
    totals[row.karat].count += 1;
  }

  const averages: Record<number, number> = {};
  for (const [karatStr, { sum, count }] of Object.entries(totals)) {
    averages[Number(karatStr)] = count > 0 ? sum / count : 0;
  }
  return averages;
}

/**
 * Returns an ISO string representing `days` before `now` (default 35 days).
 */
export function getHistoricalCutoffIso(days = 35, now: Date = new Date()): string {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - ms).toISOString();
}
```

- [x] **Step 4: Run the unit tests to verify they pass**

Run: `node --test app/lib/__tests__/priceUtils.test.ts`
Expected: PASS (4/4 tests passing).

- [x] **Step 5: Wire `priceUtils` into `app/hooks/useGoldPrices.ts` and `app/hooks/useVault.ts`**

1. In `app/hooks/useGoldPrices.ts`:
   - Import `{ deduplicateLatestPrices, getHistoricalCutoffIso } from '../lib/priceUtils';`
   - In `useLatestPrices`:
     - Add `.limit(100)` to the Supabase query so it fetches at most the latest 100 rows instead of scanning the entire table.
     - Return `deduplicateLatestPrices(data as any) as GoldPrice[]`.
   - In `useHistoricalPrices(karat)`:
     - Use `provider:providers!inner(name, is_active)` with `.eq('provider.is_active', true)` so deactivated providers are excluded from historical trends too.
     - Add `.gte('scraped_at', getHistoricalCutoffIso(35))` and `.limit(5000)` so PostgREST's 1,000-row default never truncates recent days.
2. In `app/hooks/useVault.ts`:
   - Import `{ computeMarketAverages } from '../lib/priceUtils';`
   - Replace the manual `latestPrices.reduce(...)` in `marketAverages` with `return computeMarketAverages(latestPrices);`.

- [x] **Step 6: Verify TypeScript compilation and unit tests**

Run: `cd app && npx tsc --noEmit && node --test lib/__tests__/*.test.ts`
Expected: 0 TypeScript errors and all 10 unit tests passing.

---

### Task 3: Mobile Cold-Start Auth Gate, `KeyboardAvoidingView` Mandates & Alerts/Vault UX

**Files:**
- Modify: `app/app/_layout.tsx`
- Modify: `app/app/(tabs)/calculator.tsx`
- Modify: `app/app/(tabs)/alerts.tsx`
- Modify: `app/app/(tabs)/vault.tsx`

**Interfaces:**
- Consumes: `formatCurrency` from `app/lib/format.ts`, `supabase` from `app/lib/supabase.ts`
- Produces:
  - Cold-start auth readiness gate in `RootLayout` (`app/app/_layout.tsx`)
  - `KeyboardAvoidingView` wrappers in `calculator.tsx` and `alerts.tsx`
  - Karat pill selector `[24, 22, 21, 18]` and active alerts list with deletion in `alerts.tsx`
  - Delete confirmation dialog in `vault.tsx`

- [x] **Step 1: Gate `RootLayout` rendering on `isReady` in `app/app/_layout.tsx`**

In `app/app/_layout.tsx`:
- Update the `useEffect` that hides the splash screen to wait until `(loaded || fontError) && isReady`.
- Update the render guard from `if (!loaded && !fontError) { return null; }` to `if ((!loaded && !fontError) || !isReady) { return null; }`.
- This guarantees `signInAnonymously()` and `initDatabase()` have finished before `Dashboard` mounts and executes authenticated RLS queries.

- [x] **Step 2: Add `KeyboardAvoidingView` to `app/app/(tabs)/calculator.tsx`**

In `app/app/(tabs)/calculator.tsx`:
- Import `KeyboardAvoidingView, Platform` from `'react-native'`.
- Wrap the `ScrollView` inside `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">` and add `keyboardShouldPersistTaps="handled"` to `ScrollView`.

- [x] **Step 3: Upgrade `app/app/(tabs)/alerts.tsx` with `KeyboardAvoidingView`, Karat pill selector, and active alerts list**

In `app/app/(tabs)/alerts.tsx`:
- Wrap the screen in `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">`.
- Replace the raw `TextInput` for Karat with a 4-pill selector `[24, 22, 21, 18]` (matching `calculator.tsx` and `vault.tsx`).
- Add state and query logic to load existing active alerts from `price_alerts` for the current device token (plus any created in the current session), display each alert's karat, target price (`formatCurrency(alert.target_price)`), and provide a delete button to deactivate/remove the alert.

- [x] **Step 4: Add delete confirmation dialog to `AssetCard` in `app/app/(tabs)/vault.tsx`**

In `app/app/(tabs)/vault.tsx`:
- Import `Alert` from `'react-native'`.
- In `AssetCard`, wrap `onDelete()` in a `confirmDelete` handler that invokes `Alert.alert('Remove Gold Asset', 'Are you sure you want to delete this entry from your vault?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: onDelete }])`.

- [x] **Step 5: Verify TypeScript compilation across the mobile app**

Run: `cd app && npx tsc --noEmit && node --test lib/__tests__/*.test.ts`
Expected: 0 TypeScript errors and all unit tests passing.

---

### Task 4: Backend Scraper Orchestration, Fail-Safe Notifications, Validation & CI Env Vars

**Files:**
- Create: `backend/scraper/utils/validation.js`
- Create: `backend/scraper/tests/validation_and_alerts.test.js`
- Modify: `backend/scraper/utils/mailer.js`
- Modify: `backend/scraper/utils/alerts.js`
- Modify: `backend/scraper/index.js`
- Modify: `backend/scraper/health-check.js`
- Modify: `backend/scraper/strategies/puppeteer.js`
- Modify: `backend/scraper/strategies/cheerio.js`
- Modify: `.github/workflows/scrape-prices.yml`

**Interfaces:**
- Produces:
  - `MIN_VALID_PRICE = 100`, `MAX_VALID_PRICE = 2000`, `VALID_KARATS = [24, 22, 21, 18]` in `backend/scraper/utils/validation.js`
  - `isValidGoldPrice(val): boolean` in `backend/scraper/utils/validation.js`
  - `validateProviderPrices(prices): Array<{ karat: number, price_per_gram: number }>` in `backend/scraper/utils/validation.js`
  - `isFallbackEligible(providerName): boolean` in `backend/scraper/utils/validation.js`
  - `sendFallbackAlert(providerName, errorReason, fallbackSucceeded = true)` in `backend/scraper/utils/mailer.js`

- [x] **Step 1: Write failing unit tests for backend price validation, fallback eligibility, alert formatting, and mailer modes**

Create `backend/scraper/tests/validation_and_alerts.test.js`:
```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  MIN_VALID_PRICE,
  MAX_VALID_PRICE,
  isValidGoldPrice,
  validateProviderPrices,
  isFallbackEligible,
  formatAlertPrice,
} = require('../utils/validation');
const { buildFallbackEmailContent } = require('../utils/mailer');

describe('isValidGoldPrice', () => {
  it('accepts prices within [100, 2000] QAR/g', () => {
    assert.equal(MIN_VALID_PRICE, 100);
    assert.equal(MAX_VALID_PRICE, 2000);
    assert.equal(isValidGoldPrice(100), true);
    assert.equal(isValidGoldPrice(585.5), true);
    assert.equal(isValidGoldPrice(2000), true);
  });

  it('rejects out-of-range or non-numeric values', () => {
    assert.equal(isValidGoldPrice(99.99), false);
    assert.equal(isValidGoldPrice(2000.01), false);
    assert.equal(isValidGoldPrice(NaN), false);
    assert.equal(isValidGoldPrice(null), false);
  });
});

describe('validateProviderPrices', () => {
  it('keeps valid karats in descending karat order and deduplicates', () => {
    const raw = [
      { karat: 22, price_per_gram: 545.0 },
      { karat: 24, price_per_gram: 585.0 },
      { karat: 22, price_per_gram: 540.0 }, // duplicate karat ignored
      { karat: 18, price_per_gram: 440.0 },
      { karat: 14, price_per_gram: 340.0 }, // unsupported karat ignored
    ];
    const valid = validateProviderPrices(raw);
    assert.deepEqual(valid, [
      { karat: 24, price_per_gram: 585.0 },
      { karat: 22, price_per_gram: 545.0 },
      { karat: 18, price_per_gram: 440.0 },
    ]);
  });

  it('rejects inverted karat hierarchy where lower karat exceeds higher karat price', () => {
    const inverted = [
      { karat: 24, price_per_gram: 500.0 },
      { karat: 22, price_per_gram: 550.0 }, // 22K > 24K is corrupt
    ];
    const valid = validateProviderPrices(inverted);
    assert.deepEqual(valid, []);
  });
});

describe('isFallbackEligible', () => {
  it('identifies primary retail vendors eligible for aggregator fallback', () => {
    assert.equal(isFallbackEligible('Malabar Gold'), true);
    assert.equal(isFallbackEligible('Al Fardan Exchange'), true);
    assert.equal(isFallbackEligible('Joyalukkas'), true);
    assert.equal(isFallbackEligible('GoodReturns'), false);
    assert.equal(isFallbackEligible('Shine Jewelers'), false);
  });
});

describe('formatAlertPrice', () => {
  it('formats floating-point averages to strictly two decimal places', () => {
    assert.equal(formatAlertPrice(584.3333333333), '584.33');
    assert.equal(formatAlertPrice(580), '580.00');
  });
});

describe('buildFallbackEmailContent', () => {
  it('builds fallback-succeeded email content when fallbackSucceeded is true', () => {
    const mail = buildFallbackEmailContent('Malabar Gold', 'Tier 1 & 2 failed', true);
    assert.match(mail.subject, /Fallback Triggered/);
    assert.match(mail.html, /successfully retrieved market data using the aggregator fail-safe/);
  });

  it('builds critical failure email content when fallbackSucceeded is false', () => {
    const mail = buildFallbackEmailContent('Malabar Gold', 'All sources failed', false);
    assert.match(mail.subject, /CRITICAL/);
    assert.match(mail.html, /Action Required/);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test backend/scraper/tests/validation_and_alerts.test.js`
Expected: FAIL with `Cannot find module '../utils/validation'`.

- [x] **Step 3: Implement `backend/scraper/utils/validation.js` and update `mailer.js` and `alerts.js`**

1. Create `backend/scraper/utils/validation.js`:
   - Export `MIN_VALID_PRICE = 100`, `MAX_VALID_PRICE = 2000`, `VALID_KARATS = [24, 22, 21, 18]`.
   - Export `isValidGoldPrice(val)`, `validateProviderPrices(prices)`, `isFallbackEligible(providerName)`, and `formatAlertPrice(val)`.
2. Update `backend/scraper/utils/mailer.js`:
   - Export `buildFallbackEmailContent(providerName, errorReason, fallbackSucceeded = true)` and update `sendFallbackAlert(providerName, errorReason, fallbackSucceeded = true)` to use it so both fallback activation (`fallbackSucceeded = true`) and total extraction failure (`fallbackSucceeded = false`) send accurate, distinct emails.
3. Update `backend/scraper/utils/alerts.js`:
   - Import `{ formatAlertPrice } = require('./validation')` and format `currentPrice` and `alert.target_price` in the Expo push notification body using `formatAlertPrice(...)`.

- [x] **Step 4: Run the backend unit tests to verify they pass**

Run: `node --test backend/scraper/tests/validation_and_alerts.test.js`
Expected: PASS (8/8 tests passing).

- [x] **Step 5: Update `puppeteer.js`, `cheerio.js`, `index.js`, and `.github/workflows/scrape-prices.yml`**

1. In `backend/scraper/strategies/puppeteer.js`:
   - Import `{ isValidGoldPrice, validateProviderPrices } = require('../utils/validation')`.
   - Accept optional `sharedBrowser` in `scrapeWithPuppeteer(provider, sharedBrowser = null)`:
     - Export a helper `launchScraperBrowser()` that uses sandbox flags only when `process.env.CI === 'true' || process.env.PUPPETEER_NO_SANDBOX === 'true'`.
     - If `sharedBrowser` is passed, open a new `page = await browser.newPage()` and close `page` in `finally` without closing `sharedBrowser`. If not passed, launch and close the browser locally.
   - Replace hardcoded `val > 300 && val < 1000` checks with `isValidGoldPrice(val)` and run `validateProviderPrices(prices)` before returning.
   - Replace unconditional `5000ms` sleeps with `await page.waitForFunction(() => document.body && document.body.innerText.length > 200, { timeout: 5000 }).catch(() => {})` plus a brief stabilization pause (`1500ms`).
2. In `backend/scraper/strategies/cheerio.js`:
   - Import `{ isValidGoldPrice, validateProviderPrices } = require('../utils/validation')`.
   - Replace hardcoded `val > 300 && val < 1000` checks with `isValidGoldPrice(val)` and run `validateProviderPrices(prices)` before returning.
3. In `backend/scraper/index.js`:
   - Import `{ launchScraperBrowser } = require('./strategies/puppeteer')` and `{ isFallbackEligible } = require('./utils/validation')`.
   - Reuse a single `sharedBrowser` across all Puppeteer providers in `runScraper()`, closing it cleanly in `try / finally`.
   - Cache `fallbackPrices` (`let cachedFallbackPrices = null;`) so `goldpriceqatar.com` is scraped at most once per run if multiple retail providers need fallback.
   - When primary extraction fails for a fallback-eligible provider and fallback succeeds:
     - Call `await sendFallbackAlert(provider.name, primaryError, true)` (fulfilling `GEMINI.md` mandate).
   - When primary extraction fails and fallback fails (or provider is not fallback-eligible):
     - Call `await sendFallbackAlert(provider.name, failureError, false)`.
   - Only push direct provider prices (plus at most one copy of fallback prices if fallback was used) into `allScrapedPrices` so `evaluatePriceAlerts` does not double-count fallback prices in market averages.
4. In `.github/workflows/scrape-prices.yml`:
   - Add `EMAIL_USER: ${{ secrets.EMAIL_USER }}`, `EMAIL_PASS: ${{ secrets.EMAIL_PASS }}`, `NOTIFICATION_EMAIL: ${{ secrets.NOTIFICATION_EMAIL }}`, and `CI: 'true'` to the `Run Scraper` step's `env:`.

- [x] **Step 6: Verify syntax and run backend tests**

Run: `node -c backend/scraper/index.js backend/scraper/strategies/puppeteer.js backend/scraper/strategies/cheerio.js && node --test backend/scraper/tests/*.test.js`
Expected: Syntax check exits 0 and all tests pass.

---

### Task 5: SQL Schema Alignment, Documentation Sync, `npm test` & Repository Hygiene

**Files:**
- Modify: `backend/supabase_schema.sql`
- Modify: `backend/price_alerts_schema.sql`
- Modify: `backend/package.json`
- Modify: `docs/API.md`
- Modify: `docs/SECURITY_AUDIT.md`
- Modify: `.gitignore`
- Modify: `app/.gitignore`
- Delete: `app/build-1774636895252.apk`, `app/build-1774641697660.apk`, `app/build-1774642127677.apk`, `app/build-1774645368356.apk`, `app/build-1774679886274.apk`

**Interfaces:**
- Consumes: Updated scraper and frontend interfaces from Tasks 1–4
- Produces:
  - Working `npm test` in `backend/package.json` and `app/package.json`
  - Synchronized `supabase_schema.sql`, `price_alerts_schema.sql`, `docs/API.md`, `docs/SECURITY_AUDIT.md`
  - Clean repository without untracked APK build artifacts

- [x] **Step 1: Update `backend/supabase_schema.sql` and `backend/price_alerts_schema.sql`**

1. In `backend/supabase_schema.sql`:
   - Update the `providers` RLS policy from `using (false)` to allow `authenticated` users to read active providers:
     ```sql
     create policy "Allow authenticated read access on active providers"
       on providers for select
       to authenticated
       using (is_active = true);
     ```
   - Add composite indexes for the mobile app's exact query patterns:
     ```sql
     create index if not exists idx_gold_prices_karat_scraped_at
       on gold_prices (karat, scraped_at desc);
     create index if not exists idx_gold_prices_provider_karat_scraped_at
       on gold_prices (provider_id, karat, scraped_at desc);
     ```
2. In `backend/price_alerts_schema.sql`:
   - Restrict `price_alerts` policies to `authenticated` role (matching anonymous auth in `_layout.tsx`) and add a `DELETE` policy so users can remove their own alerts from the mobile app.

- [x] **Step 2: Update `docs/API.md` and `docs/SECURITY_AUDIT.md`**

1. In `docs/API.md`:
   - Fix `providers.id` and `price_alerts.id` data types from `int8` to `uuid`.
   - Document the `.limit(100)` + client-side per-provider deduplication in `useLatestPrices` and the 35-day `.gte('scraped_at', cutoff)` window in `useHistoricalPrices`.
   - Document that all Supabase requests require an `authenticated` session (via `supabase.auth.signInAnonymously()`).
2. In `docs/SECURITY_AUDIT.md`:
   - Update `VULN-001` to note that Chromium runs with its native sandbox enabled locally and only enables `--no-sandbox` when `CI=true` or `PUPPETEER_NO_SANDBOX=true`.
   - Update `VULN-002` to reflect that `providers` allows `SELECT` on active rows (`is_active = true`) for `authenticated` sessions so `providers!inner(name, is_active)` works without exposing inactive/internal rows to unauthenticated (`anon`) callers.

- [x] **Step 3: Configure `npm test` scripts in `backend/package.json` and `app/package.json`**

1. In `backend/package.json`:
   - Set `"test": "node --test scraper/tests/*.test.js"`.
2. In `app/package.json`:
   - Add `"test": "node --test lib/__tests__/*.test.ts"`.

- [x] **Step 4: Remove leftover APK files and ignore `*.apk` in `.gitignore` and `app/.gitignore`**

1. Add `*.apk` and `*.aab` to `.gitignore` and `app/.gitignore`.
2. Delete the 5 untracked `app/build-*.apk` files in `app/`.

- [x] **Step 5: Run full test suites and static analysis across `backend/` and `app/`**

Run:
```bash
cd /Users/nab/Code/qatar-gold-prices/backend && npm test
cd /Users/nab/Code/qatar-gold-prices/app && npm test && npx tsc --noEmit
```
Expected: All backend tests pass, all frontend tests pass, and `tsc --noEmit` exits with 0 errors.
