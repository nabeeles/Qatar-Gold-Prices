# Google Play Store Release & Supabase Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate live Supabase database security/data-integrity drift and execute the end-to-end technical and policy workflow to publish `com.qatargold.tracker` on the Google Play Store.

**Architecture:** We first lock down and clean the live Supabase backend (`aduvipcrjumffudkkfab.supabase.co`) using an automated 18-point production readiness verifier, a SQL RLS/constraint hardening migration, a data-hygiene purge script for legacy corrupted scrape rows, and a fresh scraper run. We then wire Firebase Cloud Messaging (FCM V1) for standalone Android push notifications, generate the Play Console graphic assets, build the signed API-36 / 16KB-aligned `.aab` bundle locally, and complete Play Console submission.

**Tech Stack:** Expo SDK 54 (React Native 0.81.5, Android API 36), Supabase (`@supabase/supabase-js` v2, PostgreSQL RLS), Node.js 24, Puppeteer/Cheerio Scraper, EAS CLI (`--local` builds).

**Spec:** [`docs/PLAY_STORE_RELEASE.md`](file:///Users/nab/Code/qatar-gold-prices/docs/PLAY_STORE_RELEASE.md), [`docs/PRIVACY_POLICY.md`](file:///Users/nab/Code/qatar-gold-prices/docs/PRIVACY_POLICY.md), [`docs/SECURITY_AUDIT.md`](file:///Users/nab/Code/qatar-gold-prices/docs/SECURITY_AUDIT.md)

## Global Constraints

- **Privacy First (Local-Only):** All user portfolio data (`vault.db`) MUST remain strictly on-device in SQLite; `android.allowBackup` must stay `false`.
- **Decimal Precision:** Financial values must display two decimal places via `formatCurrency`.
- **EAS Local Builds:** Production `.apk` and `.aab` artifacts MUST be built using `--local` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` exported in the shell.
- **Google Play 2026 Target:** Must target Android 16 (`targetSdkVersion = 36`, `compileSdkVersion = 36`) with 16 KB ELF page alignment (natively provided by Expo SDK 54 / RN 0.81.5).

## Review Focus

1. **Cross-Tenant `price_alerts` Spoofing (Live DB Drift):** Authenticated User B attempting to `INSERT` a `price_alerts` row with `user_id = UserA.id` must be rejected by PostgreSQL RLS (`WITH CHECK ((select auth.uid()) = user_id)`).
2. **Inactive Provider Exposure (Live DB Drift):** Authenticated mobile sessions querying `providers` must only receive rows where `is_active = true` (hiding deactivated providers like `Shine Jewelers`).
3. **Corrupted Historical `gold_prices` Rows:** The 167 legacy rows with `price = 2026` QAR/g and the `2026-09-29` inverted `GoodReturns Aggregator` batch (`18K = 450 > 22K = 379.2`) must be purged so historical charts and high/low metrics are not skewed.
4. **Stale Market Rates (`>396 hours` old):** A fresh scraper synchronization must succeed so Play Store reviewers do not see stale September 2026 prices.
5. **Missing `google-services.json` in Standalone Android Builds:** Calling `Notifications.getExpoPushTokenAsync()` in a standalone `.aab` without `android.googleServicesFile` throws `Default FirebaseApp is not initialized`; either FCM V1 must be wired or graceful error handling verified.

---

### Task 1: Automated Supabase Production Readiness Verifier & Data Hygiene Purge

**Files:**
- Create: `backend/scripts/verify_supabase_production.js`
- Create: `backend/scripts/purge_corrupted_prices.js`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: `app/.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`), `backend/.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_KEY`)
- Produces:
  - `node backend/scripts/purge_corrupted_prices.js` — deletes out-of-bounds (`price < 100 OR price > 2000`) and non-monotonic (`18K > 22K` or `22K > 24K`) historical rows from `gold_prices`
  - `node backend/scripts/verify_supabase_production.js` — runs 18 live checks (keys, unauthenticated RLS, anonymous sign-in, `providers` RLS, `useLatestPrices`, `useHistoricalPrices`, write blocks, `price_alerts` cross-user RLS isolation, and data integrity) and exits `1` if any check fails

- [ ] **Step 1: Create `backend/scripts/verify_supabase_production.js` and run it to confirm the current live failures**

Run: `node backend/scripts/verify_supabase_production.js`
Expected: FAIL on Check 8 (`inactive exposed=true`), Check 16 (`User B cannot insert alert spoofing User A user_id`), and Check 18 (`anomalous rows count=167`).

- [ ] **Step 2: Create and run `backend/scripts/purge_corrupted_prices.js` to remove corrupted historical rows**

Delete all `gold_prices` rows where `price < 100 OR price > 2000`, as well as any provider timestamp batch where `18K > 22K`, `21K > 22K`, or `22K > 24K` (specifically cleaning the `2026-09-29` `GoodReturns Aggregator` inverted row).

Run: `node backend/scripts/purge_corrupted_prices.js`
Expected: Purges the 167 `price = 2026` rows and inverted karat rows; subsequent Check 18 in `verify_supabase_production.js` reports `anomalous rows count=0`.

- [ ] **Step 3: Add `"verify:db": "node scripts/verify_supabase_production.js"` to `backend/package.json` and commit**

```bash
git add backend/scripts/verify_supabase_production.js backend/scripts/purge_corrupted_prices.js backend/package.json
git commit -m "chore(backend): add Supabase production readiness verifier and corrupted price purge script"
```

---

### Task 2: Live Supabase RLS Policy & Check Constraint Synchronization

**Files:**
- Create: `backend/migrations/20261016_production_rls_hardening.sql`
- Modify: `backend/supabase_schema.sql`

**Interfaces:**
- Consumes: `backend/supabase_schema.sql`, `backend/price_alerts_schema.sql`
- Produces: Idempotent SQL migration `backend/migrations/20261016_production_rls_hardening.sql` to execute in the Supabase SQL Editor (or via `psql`) that reconciles the live database with the repository schema.

- [ ] **Step 1: Create `backend/migrations/20261016_production_rls_hardening.sql`**

```sql
-- 1. Reconcile 'providers' RLS policies so inactive providers are hidden from mobile clients
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'providers'
  loop
    execute format('drop policy if exists %I on public.providers', pol.policyname);
  end loop;
end $$;

alter table public.providers enable row level security;

create policy "Authenticated users can read active providers"
  on public.providers for select
  to authenticated
  using (is_active = true);

create policy "Unauthenticated users cannot read providers"
  on public.providers for select
  to anon
  using (false);

-- 2. Reconcile 'price_alerts' RLS policies to block cross-user user_id spoofing on INSERT/UPDATE
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'price_alerts'
  loop
    execute format('drop policy if exists %I on public.price_alerts', pol.policyname);
  end loop;
end $$;

alter table public.price_alerts enable row level security;

create policy "Users can manage their own alerts"
  on public.price_alerts for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 3. Enforce database-level price sanity bounds on 'gold_prices' (100 to 2000 QAR/g)
alter table public.gold_prices
  drop constraint if exists gold_prices_price_bounds_check;

alter table public.gold_prices
  add constraint gold_prices_price_bounds_check
  check (price >= 100 and price <= 2000);
```

- [ ] **Step 2: Apply the SQL migration in the Supabase Dashboard SQL Editor (`aduvipcrjumffudkkfab`)**

Paste and run `backend/migrations/20261016_production_rls_hardening.sql` in **Supabase Dashboard → SQL Editor**.

- [ ] **Step 3: Re-run the production readiness verifier to confirm all RLS & constraint checks pass**

Run: `npm --prefix backend run verify:db`
Expected: PASS on all 18 checks (including Check 8 `inactive exposed=false` and Check 16 `Cross-user RLS: User B cannot insert alert spoofing User A user_id`).

- [ ] **Step 4: Commit the migration and updated schema**

```bash
git add backend/migrations/20261016_production_rls_hardening.sql backend/supabase_schema.sql
git commit -m "fix(db): add idempotent RLS policy and price bounds migration for live Supabase"
```

---

### Task 3: Live Market Data Synchronization & GitHub Actions Schedule Check

**Files:**
- Consumes: `backend/scraper/index.js`, `.github/workflows/scrape-prices.yml`

- [ ] **Step 1: Trigger a live scraper run to refresh stale (`2026-09-29`) market prices**

Run: `node backend/scraper/index.js`
Expected: Active Qatari providers (`Al Fardan Exchange`, `Joyalukkas`, `Malabar Gold`, `GoodReturns Aggregator`, `LivePriceOfGold`) synchronize fresh October 16, 2026 prices into `gold_prices` with monotonic karat hierarchy (`24K >= 22K >= 21K >= 18K`).

- [ ] **Step 2: Re-run `npm --prefix backend run verify:db` to verify data freshness**

Run: `npm --prefix backend run verify:db`
Expected: `age_hours` is `0.0` across active providers and all 18 readiness checks pass.

---

### Task 4: Firebase Cloud Messaging (FCM V1) Setup for Standalone Android Push Alerts

**Files:**
- Modify: `app/.gitignore`
- Modify: `app/app.json`
- Modify: `app/lib/notifications.ts`
- Test: `app/lib/__tests__/notifications.test.ts`

**Interfaces:**
- Produces: Safe fallback handling in `registerForPushNotificationsAsync()` when FCM is unconfigured on a device, plus `google-services.json` wiring for production Play Store builds.

- [ ] **Step 1: Harden `registerForPushNotificationsAsync()` in `app/lib/notifications.ts` to catch native FCM initialization errors gracefully**

Wrap `Notifications.getExpoPushTokenAsync(...)` in a `try/catch` block so that if a local APK/AAB build is run before `google-services.json` is attached, it returns `null` with a clear log warning rather than throwing an unhandled native rejection.

- [ ] **Step 2: Ignore `google-services.json` in `app/.gitignore`**

Add `google-services.json` to `app/.gitignore` so Firebase project keys are not committed to public git history while still remaining available to `--local` EAS builds.

- [ ] **Step 3: Provision Firebase Android App (`com.qatargold.tracker`) and upload FCM V1 key**

1. In [Firebase Console](https://console.firebase.google.com/), create/open your project and register an Android app with package name `com.qatargold.tracker`.
2. Download `google-services.json` to `app/google-services.json` and add `"googleServicesFile": "./google-services.json"` under `expo.android` in `app/app.json`.
3. In Firebase **Project Settings → Service Accounts**, click **Generate new private key** and upload the JSON via `cd app && eas credentials` (`Android` → `playstore` → `Push Notifications: Manage your FCM API Key`).

- [ ] **Step 4: Run unit tests and commit**

Run: `npm --prefix app test`
Expected: PASS

```bash
git add app/lib/notifications.ts app/.gitignore
git commit -m "fix(app): harden push token registration and gitignore google-services.json"
```

---

### Task 5: Generate Play Store Graphic Assets (`512×512` Icon & `1024×500` Feature Graphic)

**Files:**
- Create: `docs/store-assets/play-store-icon-512.png`
- Create: `docs/store-assets/feature-graphic-1024x500.png`

- [ ] **Step 1: Generate `512×512` 32-bit PNG Play Store Hi-Res Icon from `app/assets/images/icon.png`**

Run: `mkdir -p docs/store-assets && sips -z 512 512 app/assets/images/icon.png --out docs/store-assets/play-store-icon-512.png`
Expected: `file docs/store-assets/play-store-icon-512.png` reports `PNG image data, 512 x 512, 8-bit/color RGB, non-interlaced`.

- [ ] **Step 2: Generate `1024×500` 24-bit PNG Feature Graphic (`docs/store-assets/feature-graphic-1024x500.png`)**

Generate a dark-luxury (`#0A0A0A` background, `#D4AF37` gold accent) `1024×500` PNG feature graphic for the Google Play Console store listing.

- [ ] **Step 3: Capture 5 Phone Screenshots (`1080×1920`, 9:16) into `docs/store-assets/screenshots/`**

Capture screenshots of the 5 primary screens:
1. `01-dashboard.png` (Market Overview & Retailer Comparison)
2. `02-trends.png` (Historical 24K/22K Price Chart)
3. `03-calculator.png` (Smart Gold & Making-Charge Calculator)
4. `04-vault.png` (Private On-Device "My Gold" Portfolio)
5. `05-alerts.png` (Custom QAR/g Push Price Alerts)

---

### Task 6: Build Signed Release Artifact (`.aab` & `.apk`) Locally

**Files:**
- Consumes: `app/eas.json`, `app/app.json`, `app/.env`

- [ ] **Step 1: Run `npx expo-doctor` to verify SDK 54 & native dependency alignment**

Run: `cd app && npx expo-doctor`
Expected: All checks pass with no blocking dependency or config-plugin errors.

- [ ] **Step 2: Build the signed Play Store Android App Bundle (`.aab`) locally**

```bash
cd app
set -a && source .env && set +a
eas build --platform android --profile playstore --local
```
Expected: Produces a signed `.aab` bundle targeting Android 16 (`targetSdkVersion = 36`) with 16 KB native page alignment.

- [ ] **Step 3: Build the standalone production `.apk` locally (per `GEMINI.md` mandate)**

```bash
cd app
set -a && source .env && set +a
eas build --platform android --profile production --local
```
Expected: Produces a signed `.apk` for direct device testing and Closed Testing verification.

---

### Task 7: Host Public Privacy Policy & Submit to Google Play Console

**Files:**
- Consumes: [`docs/PRIVACY_POLICY.md`](file:///Users/nab/Code/qatar-gold-prices/docs/PRIVACY_POLICY.md), [`docs/PLAY_STORE_RELEASE.md`](file:///Users/nab/Code/qatar-gold-prices/docs/PLAY_STORE_RELEASE.md)

- [ ] **Step 1: Publish `docs/PRIVACY_POLICY.md` at a public HTTPS URL**

Enable GitHub Pages on the repository (or host `docs/PRIVACY_POLICY.md` on your domain) and verify the URL loads over HTTPS without login.

- [ ] **Step 2: Complete Google Play Console App Content Declarations**

In Google Play Console (`Policy → App content`), enter the exact responses from [`docs/PLAY_STORE_RELEASE.md`](file:///Users/nab/Code/qatar-gold-prices/docs/PLAY_STORE_RELEASE.md#L52-L85):
- **Privacy Policy:** Paste public HTTPS URL from Step 1.
- **Data Safety:** Declare **Yes** (Optional `Device or other IDs` for push alerts only; **No** for Financial info since `vault.db` is strictly local).
- **Financial Features:** Select **"My app doesn't provide any financial products or services"** and include the reviewer note.
- **App Access:** Select **"All functionality in my app is available without any access restrictions."**
- **Ads:** Select **"No, my app does not contain ads."**
- **Target Audience:** Select **18 and over**.
- **Content Rating (IARC):** Complete questionnaire under **Utility / Productivity / Other** (PEGI 3 / Everyone).

- [ ] **Step 3: Upload Store Listing Assets & Submit `.aab` Release**

1. Upload the `512×512` icon, `1024×500` feature graphic, and 5 phone screenshots, and paste the Title, Short Description, and Full Description from [`docs/PLAY_STORE_RELEASE.md`](file:///Users/nab/Code/qatar-gold-prices/docs/PLAY_STORE_RELEASE.md#L87-L108).
2. Enable **Play App Signing** (`Setup → App signing`).
3. Upload the `.aab` built in Task 6:
   - **If using a Personal Developer Account (created after Nov 2023):** Upload to the **Closed Testing** track, recruit **12+ testers** to opt-in and keep the app installed for **14 consecutive days**, then apply for **Production** access.
   - **If using an Organization Developer Account:** Upload directly to the **Production** track and submit for review.
