# Architecture Overview

The **Qatar Gold Prices** project is a robust, privacy-first system designed to synchronize real-time gold market data with a premium mobile experience.

---

## 🏗️ High-Level System Design

```
+-------------------+      +-------------------+      +-------------------+
|  GitHub Actions   |      |     Supabase      |      | React Native App  |
| (Scraper & Health)| ---> |  (Cloud Market)   | <--- | (Expo / Mobile)   |
+---------+---------+      +---------+---------+      +---------+---------+
          |                          |                          |
          | Scrape Prices            | Market Feed Only         | Local Portfolio
          v                          |                          v
+---------+---------+                |                +---------+---------+
| Provider Websites |                +--------------> |  Local SQLite DB  |
| (Direct & Aggr)   |                                 | (Private Vault)   |
+-------------------+                                 +-------------------+
```

---

## 🔍 Core Components

### 1. The Scraper (Backend)
- **Engine Dispatch & Browser Pooling:** Dynamically routes tasks to **Puppeteer** (sharing a single browser instance across direct retail sites) or **Cheerio** (for lightweight aggregators) based on database metadata (`scraping_type`).
- **Multi-Tier Direct Robustness:** For Malabar Gold (GeoIP-aware regional store views `/ae/`, `/us/`, `/uk/`) and Al Fardan Exchange (`GET /api/gold-rates` and upstream `alfaremit.com:7095` with parallel SOCKS5 regional egress for Geo-fenced CI runners), the scraper executes a sub-second direct pricing API fast-path and cascades to interactive UI browser automation if needed, without substituting third-party aggregator fallback data.
- **Price & Hierarchy Validation:** Every extracted rate is validated against realistic bounds (`100`–`2000` QAR/g) and monotonic purity ordering (`24K >= 22K >= 21K >= 18K`) via `backend/scraper/utils/validation.js` before persistence.
- **Health Monitoring & Failure Alerts:** Every primary extraction failure triggers an immediate `sendFallbackAlert` email, complemented by a daily automated health check across all active sources.

### 2. The Cloud Layer (Supabase)
- **Market Truth:** Acts as the global source of truth for gold rates across Qatar, indexed by `(provider_id, karat, scraped_at DESC)` and `(karat, scraped_at DESC)` for fast time-series and latest-snapshot queries.
- **User-Scoped Alerts:** Stores push tokens and price thresholds in `price_alerts`, isolated per anonymous user session via `auth.uid() = user_id` Row-Level Security (RLS) policies.
- **Hardened Security:** All sensitive keys are managed via environment variables, and email notification templates escape dynamic error strings via `escapeHTML`.

### 3. The Private Vault (Mobile Frontend)
- **Local-Only Privacy:** All user portfolio data (purchases, labels, weights) is stored strictly in the **Local SQLite** database. This data never leaves the device.
- **Deduplicated Real-time Valuation:** Deduplicates provider feeds to the latest snapshot per `(provider_id, karat)` (`app/lib/priceUtils.ts`) and combines live market averages with local vault entries for instant ROI and P/L analytics.
- **Smart-Sync Input:** Intelligent form logic that bi-directionally calculates "Total Price" and "Price per Gram" based on user-provided weight, formatted strictly to two decimal places via `formatCurrency` (`app/lib/format.ts`).

---

## 🛡️ Guiding Principles

1.  **Privacy by Design:** Portfolio data is a sovereign asset of the user. We never transmit PII or financial holdings to the cloud.
2.  **Precision Engineering:** Every financial value is strictly formatted to two decimal places using `formatCurrency` (`app/lib/format.ts`).
3.  **Authentic Source Integrity:** We prioritize authentic direct retail data and enforce strict karat hierarchy validation without substituting aggregator fallback rates for retail providers.
4.  **Local-First Stability:** Production builds are performed locally with manual environment injection (`--local`) to ensure maximum stability and crash resistance.

---

## 🛠️ Data Lifecycle

1.  **Sync:** GitHub Actions triggers `backend/scraper/index.js` (every hour).
2.  **Extract & Validate:** Orchestrator executes direct/aggregator extraction and validates complete `24K` & `22K` rates and monotonic karat hierarchy.
3.  **Persist:** Validated prices are batch-inserted into Supabase.
4.  **Notify:** Extraction failures trigger `sendFallbackAlert` emails; newly scraped prices are evaluated against active user alerts to dispatch Expo Push notifications.
5.  **View:** Mobile App retrieves deduplicated latest rates and date-windowed historical series from Supabase and applies them to the local SQLite Vault for valuation.
