# Scraping Strategy & Data Sources

This document details the methodologies, heuristics, and fail-safes used to synchronize Qatar's gold market data.

---

## 🤖 Orchestration: Dynamic Dispatch & Browser Pooling

The scraper uses a tiered orchestration logic to balance accuracy and speed:
1.  **Direct Strategy (Puppeteer):** Used for primary retail websites (Al Fardan Exchange, Joyalukkas, Malabar Gold) that utilize heavy JavaScript hydration or require regional interaction. A single shared headless Chromium instance (`launchScraperBrowser`) is pooled across all direct providers in a run, with isolated browser pages per provider.
2.  **Aggregator Strategy (Cheerio):** Used for lightweight market aggregator sites (`goodreturns.in`, `livepriceofgold.com`, and the `goldpriceqatar.com` fallback feed) that provide fast, static HTML snapshots of the broader market.

---

## 🛡️ Robustness: Multi-Tier Fail-Safe

For critical market indicators (Al Fardan Exchange, Joyalukkas, Malabar Gold), we implement an intelligent 3-tier extraction architecture:
-   **Tier 1 (Fast-Path Direct Pricing API):** For Malabar Gold, sub-second extraction queries the official regional pricing endpoint (`POST /ae/malabarprice/index/getrates/?country=QA&state=Doha`). Operates in `< 400ms` with zero browser overhead.
-   **Tier 2 (Interactive UI Automation):** If the direct API fails or is not applicable, Puppeteer navigates to the provider storefront, dismisses overlays, selects regional settings ("Qatar" / "Doha"), and parses live DOM values.
-   **Tier 3 (Cached Aggregator Failover):** If direct extraction fails or returns partial data, the system automatically pivots to the verified market aggregator (`goldpriceqatar.com`), caching the fallback snapshot in memory so multiple fallbacks in a single run only make one HTTP request.
-   **Fail-Safe Notifications:** Every fallback event or primary extraction failure triggers an immediate email notification to the administrator via `sendFallbackAlert`.

---

## 🔍 Extraction Heuristics & Validation

To handle frequent website structural changes without constant code maintenance, the scraper employs the following heuristics and validation gates (`backend/scraper/utils/validation.js`):

### 1. Sequential Label Scanning
Instead of relying on fragile CSS selectors (e.g., `.price-value`), the engine scans for "Anchors" (24K, 22K, 21K, 18K) and then evaluates the immediate textual surroundings for:
-   **Currency Tokens:** Matches strings containing `QAR` or `﷼`.
-   **Decimal Precision:** Prioritizes values with `.` (e.g., `552.50`) to avoid picking up store counts or years.
-   **Market Range Validation (`isValidGoldPrice`):** Discards any value outside the realistic range of `100` to `2000` QAR per gram.

### 2. Monotonic Purity Hierarchy (`validateProviderPrices` & `normalizePriceMap`)
Before any provider's extracted rates are accepted, `validateProviderPrices` and `normalizePriceMap` verify that all present karats obey strict monotonic ordering (`24K >= 22K >= 21K >= 18K`). If a corrupted DOM scrape violates this hierarchy, the extraction is rejected and the orchestrator triggers the fallback/alert workflow.

### 3. Multi-Column Mapping
For tabular data, the scraper maps header indices to data row indices dynamically, ensuring that if a new karat column is added, existing extractions remain aligned.

---

## 📊 Provider Registry

| Provider | `scraping_type` | Engine | Status | URL Type | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Malabar Gold** | `direct` | Puppeteer | Active | Regional Gold Price (`/ae/goldprice`) | Tier 1: Sub-second JSON API. Tier 2: Interactive UI. Tier 3: Aggregator fallback. |
| **Joyalukkas** | `direct` | Puppeteer | Active | Regional Page | Requires browser hydration; aggregator fallback enabled. |
| **Al Fardan Exchange** | `direct` | Puppeteer | Active | Store / Rates Page | Direct product extraction (`24K` & `22K`); aggregator fallback enabled. |
| **GoodReturns Aggregator** | `aggregator` | Cheerio | Active | Market Feed (`goodreturns.in`) | Fast tabular market feed (`24K`, `22K`, `18K`). |
| **LivePriceOfGold** | `aggregator` | Cheerio | Active | Market Feed (`livepriceofgold.com`) | Full-spectrum aggregator (`24K`, `22K`, `21K`, `18K`). |
| **Shine Jewelers** | `direct` | Puppeteer | Inactive | Storefront | Soft-deactivated (`is_active: false`) to preserve historical data. |

---

## 🏥 Health & Monitoring

The system is self-monitoring via a daily **Provider Health Check** (`backend/scraper/health-check.js`):
-   **Trigger:** GitHub Actions (Daily at 8:00 AM UTC).
-   **Logic:** Executes a test extraction for every active provider using a shared Puppeteer browser instance and validates extracted prices.
-   **Alerts:** Sends a consolidated HTML-escaped failure report via **Nodemailer/SMTP** if any data source becomes unreachable or fails validation, and exits with a non-zero status code so CI surfaces the failure.
