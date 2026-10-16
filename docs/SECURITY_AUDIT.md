# Security & Privacy Audit Report

**Audit Date:** October 16, 2026  
**Status:** ✅ HARDENED & GOOGLE PLAY STORE READY  
**Target Environment:** Android / iOS (Expo SDK 54) & Node.js 24 Automation Backend

---

## 1. Executive Summary

The **Qatar Gold Price Tracker** repository underwent a comprehensive security, data-privacy, and supply-chain audit prior to Google Play Store submission. The system enforces a strict **Zero-Knowledge / Privacy-First** boundary for user financial assets while isolating privileged cloud operations inside ephemeral GitHub Actions runners.

---

## 2. Architecture & Data Sovereignty Audit

### 2.1 Local-Only Portfolio Storage ("My Gold" Vault)
- **Implementation:** [`app/lib/db.ts`](file:///Users/nab/Code/qatar-gold-prices/app/lib/db.ts) (`expo-sqlite`, `vault.db` in WAL mode).
- **SQL Injection Prevention:** All `INSERT` and `DELETE` statements in `dbService` use strictly parameterized prepared bindings (`?`).
- **Cloud Backup Prevention (OWASP MASVS-STORAGE):** [`app/app.json`](file:///Users/nab/Code/qatar-gold-prices/app/app.json) explicitly sets `"allowBackup": false` on Android (`android:allowBackup="false"`), preventing Android Auto Backup from silently uploading the user's private `vault.db` SQLite file to Google Drive.
- **Input Sanitization:** [`app/app/(tabs)/vault.tsx`](file:///Users/nab/Code/qatar-gold-prices/app/app/(tabs)/vault.tsx) enforces finite positive bounds (`0.01`–`100,000` grams and `1`–`100,000` QAR/g) and truncates optional labels to 80 characters.

### 2.2 Supabase Authentication & Row-Level Security (RLS)
- **Mobile Client Key Isolation:** [`app/lib/supabase.ts`](file:///Users/nab/Code/qatar-gold-prices/app/lib/supabase.ts) uses only `EXPO_PUBLIC_SUPABASE_URL` and the public `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The privileged `SUPABASE_SERVICE_ROLE_KEY` is never present in `app/` or client bundles.
- **Anonymous Session Gate:** [`app/app/_layout.tsx`](file:///Users/nab/Code/qatar-gold-prices/app/app/_layout.tsx) establishes an anonymous session via `supabase.auth.signInAnonymously()` before mounting data screens, gracefully degrading to offline mode (allowing full local "My Gold" vault access) if network connectivity is unavailable.
- **Database RLS Policies ([`backend/supabase_schema.sql`](file:///Users/nab/Code/qatar-gold-prices/backend/supabase_schema.sql) & [`backend/price_alerts_schema.sql`](file:///Users/nab/Code/qatar-gold-prices/backend/price_alerts_schema.sql)):**
  - `providers` and `gold_prices`: `SELECT` restricted to `TO authenticated` (anonymous sessions); all `INSERT`/`UPDATE`/`DELETE` operations require the backend `service_role`.
  - `price_alerts`: Strict per-device isolation via `USING (auth.uid() = user_id)` and `WITH CHECK (auth.uid() = user_id)` across `SELECT`, `INSERT`, `UPDATE`, and `DELETE`, plus database `CHECK` constraints (`karat IN (18, 21, 22, 24)` and `condition IN ('above', 'below')`).

---

## 3. Application & Backend Security Hardening (October 2026)

| Finding | Severity | Status | Remediation Applied |
| :--- | :---: | :---: | :--- |
| **Transitive npm Vulnerabilities in `backend/` (15 High)** | High | ✅ Fixed | Upgraded `axios` (`^1.19.1`), `nodemailer` (`^10.1.1`), `puppeteer` (`^25.14.0`), and pinned patched transitive overrides (`basic-ftp`, `undici`, `ws`, `js-yaml`, `ip-address`, `form-data`). `npm --prefix backend audit` now reports **0 vulnerabilities**. |
| **Transitive npm Vulnerabilities in `app/`** | High | ✅ Fixed | Added patched security overrides in [`app/package.json`](file:///Users/nab/Code/qatar-gold-prices/app/package.json) (`tar`, `shell-quote`, `postcss`, `undici`, `ws`, `@xmldom/xmldom`, `js-yaml`, `nanoid`, `image-size`, `source-map-js`, `sprintf-js`, `browserslist`, `compression`, `@babel/core`). |
| **HTML Injection in Admin Alert Emails** | Medium | ✅ Fixed | Escaped all interpolated provider names, URLs, and error strings in [`backend/scraper/utils/mailer.js`](file:///Users/nab/Code/qatar-gold-prices/backend/scraper/utils/mailer.js) using `escape-html`. |
| **Unbounded Scraper Price Insertion** | Medium | ✅ Fixed | Added [`backend/scraper/utils/validation.js`](file:///Users/nab/Code/qatar-gold-prices/backend/scraper/utils/validation.js) to reject non-finite or out-of-range QAR/g prices (`100`–`2000` QAR/g) and enforce hierarchy monotonicity (`24K >= 22K >= 21K >= 18K`) before database insertion. |
| **Unvalidated URL Scheme in `ExternalLink`** | Low | ✅ Fixed | Hardened [`app/components/ExternalLink.tsx`](file:///Users/nab/Code/qatar-gold-prices/app/components/ExternalLink.tsx) to strictly allow `https://` URLs before invoking `WebBrowser.openBrowserAsync`. |
| **Alert Input & Session Bounds (`alerts.tsx`)** | Low | ✅ Fixed | Hardened [`app/app/(tabs)/alerts.tsx`](file:///Users/nab/Code/qatar-gold-prices/app/app/(tabs)/alerts.tsx) to verify a non-null `user.id` and bound `target_price` between `1` and `100,000` QAR/g before inserting into `price_alerts`. |
| **GitHub Actions `GITHUB_TOKEN` Permissions** | Low | ✅ Fixed | Added explicit top-level `permissions: contents: read` to [`.github/workflows/scrape-prices.yml`](file:///Users/nab/Code/qatar-gold-prices/.github/workflows/scrape-prices.yml) and [`.github/workflows/provider-health-check.yml`](file:///Users/nab/Code/qatar-gold-prices/.github/workflows/provider-health-check.yml). |
| **Tracked Legacy Diagnostic Script & Debug Screenshots** | Low | ✅ Fixed | Removed tracked `backend/test_security.js`, `.idea/`, and `backend/scraper/debug/*.png` artifacts from git index. |

---

## 4. Google Play Store Security & Policy Compliance

1. **Android Permission Minimization ([`app/app.json`](file:///Users/nab/Code/qatar-gold-prices/app/app.json)):**
   - Declared only `INTERNET`, `VIBRATE`, and `POST_NOTIFICATIONS`.
   - Explicitly blocked `RECORD_AUDIO`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`, and `SYSTEM_ALERT_WINDOW` via `android.blockedPermissions`.
2. **True 32-bit PNG Asset Compliance:**
   - Converted `icon.png`, `adaptive-icon.png`, `splash-icon.png`, and `favicon.png` from JPEG data to compliant `1024×1024` RGB PNG images.
3. **In-App & Hosted Privacy Disclosures:**
   - Replaced template modal with an in-app **Privacy, Data Sovereignty & Market Disclaimer** screen ([`app/app/modal.tsx`](file:///Users/nab/Code/qatar-gold-prices/app/app/modal.tsx)), accessible from the Dashboard header.
   - Authored [`docs/PRIVACY_POLICY.md`](file:///Users/nab/Code/qatar-gold-prices/docs/PRIVACY_POLICY.md) and [`docs/PLAY_STORE_RELEASE.md`](file:///Users/nab/Code/qatar-gold-prices/docs/PLAY_STORE_RELEASE.md).
