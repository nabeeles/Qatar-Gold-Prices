# Scraping Strategy & Data Sources

This document details the methodologies, heuristics, and fail-safes used to synchronize Qatar's gold market data.

---

## 🤖 Orchestration: Dynamic Dispatch & Browser Pooling

The scraper uses a tiered orchestration logic to balance accuracy and speed:
1.  **Direct Strategy (Puppeteer):** Used for primary retail websites (Al Fardan Exchange, Joyalukkas, Malabar Gold) that utilize heavy JavaScript hydration or require regional interaction. A single shared headless Chromium instance (`launchScraperBrowser`) is pooled across all direct providers in a run, with isolated browser pages per provider.
2.  **Aggregator Strategy (Cheerio):** Used for lightweight market aggregator sites (`goodreturns.in`, `livepriceofgold.com`) that provide fast, static HTML snapshots of the broader market.

---

## 🛡️ Robustness: Multi-Tier Direct Extraction

For critical direct vendors (Malabar Gold and Al Fardan Exchange), we implement a 2-tier direct extraction architecture without substituting third-party aggregator data:
-   **Tier 1 (Fast-Path Direct Pricing API):**
    -   **Malabar Gold:** Sub-second extraction queries the official regional pricing endpoint (`POST /<store>/malabarprice/index/getrates/?country=QA&state=Doha`) across store views (`ae`, `us`, `uk`) so GeoIP redirects on cloud runners (such as GitHub Actions US IPs) are seamlessly resolved in `< 400ms` with zero browser overhead.
    -   **Al Fardan Exchange:** Queries the official JSON endpoint (`GET /api/gold-rates`) directly, extracting the 1g 24K PAMP Fortuna Bar (`1.G-401`) and 7.98g 22K Sovereign Coin (`7.99G22UK-505` divided by `7.98`) in `< 400ms`.
-   **Tier 2 (Interactive UI Automation):** If the direct API fails or is not applicable, Puppeteer navigates to the provider storefront:
    -   For **Malabar Gold**, detects any GeoIP store homepage redirect (`resolveMalabarGoldPriceUrl`), dismisses overlays, selects regional settings ("Qatar" / "Doha"), and parses live DOM values.
    -   For **Al Fardan Exchange**, pre-initializes `window.forex_refresh` and `window.refresh` via `evaluateOnNewDocument` to prevent the storefront's `setInterval(..., NaN)` bug from flooding XHR requests and freezing Chromium, then extracts the rendered table rows.
-   **Failure Notifications:** Every primary extraction failure or incomplete rate set (missing `24K` or `22K`) triggers an immediate email notification to the administrator via `sendFallbackAlert`, and no partial/fallback rates are persisted for that provider.

---

## 🔍 Extraction Heuristics & Validation

To handle frequent website structural changes without constant code maintenance, the scraper employs the following heuristics and validation gates (`backend/scraper/utils/validation.js`):

### 1. Sequential Label Scanning
Instead of relying on fragile CSS selectors (e.g., `.price-value`), the engine scans for "Anchors" (24K, 22K, 21K, 18K) and then evaluates the immediate textual surroundings for:
-   **Currency Tokens:** Matches strings containing `QAR` or `﷼`.
-   **Decimal Precision:** Prioritizes values with `.` (e.g., `552.50`) to avoid picking up store counts or years.
-   **Market Range Validation (`isValidGoldPrice`):** Discards any value outside the realistic range of `100` to `2000` QAR per gram.

### 2. Monotonic Purity Hierarchy (`validateProviderPrices` & `normalizePriceMap`)
Before any provider's extracted rates are accepted, `validateProviderPrices` and `normalizePriceMap` verify that all present karats obey strict monotonic ordering (`24K >= 22K >= 21K >= 18K`). If a corrupted DOM scrape violates this hierarchy, the extraction is rejected and the orchestrator triggers a failure alert.

### 3. Multi-Column & Multi-Table Mapping
For tabular data, the scraper maps header indices to data row indices dynamically, ensuring that if a new karat column is added, existing extractions remain aligned. For multi-table aggregator pages such as `goodreturns.in`, `extractPricesFromHtml` scans all `.gold-each-container` tables, verifies explicit `QAR` currency headers (ignoring secondary INR tables and 10-day historical comparison tables), and targets the `1 Gram` / `Today` column while rejecting signed price-change deltas.

---

## 📊 Provider Registry

| Provider | `scraping_type` | Engine | Status | URL Type | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Malabar Gold** | `direct` | Puppeteer | Active | Regional Gold Price (`/ae/goldprice`) | Tier 1: GeoIP-aware JSON API (`/ae/`, `/us/`, `/uk/`). Tier 2: Interactive UI. |
| **Joyalukkas** | `direct` | Puppeteer | Active | Regional Page | Direct browser hydration extraction. |
| **Al Fardan Exchange** | `direct` | Puppeteer | Active | Bullion Rates (`/gold-rates`) | Tier 1: Direct JSON API (`/api/gold-rates`). Tier 2: Browser extraction (`24K` & `22K`). |
| **GoodReturns Aggregator** | `aggregator` | Cheerio | Active | Market Feed (`goodreturns.in`) | Fast tabular market feed (`24K`, `22K`, `18K`). |
| **LivePriceOfGold** | `aggregator` | Cheerio | Active | Market Feed (`livepriceofgold.com`) | Full-spectrum aggregator (`24K`, `22K`, `21K`, `18K`). |
| **Shine Jewelers** | `direct` | Puppeteer | Inactive | Storefront | Soft-deactivated (`is_active: false`) to preserve historical data. |

---

## 🏥 Health & Monitoring

The system is self-monitoring via a daily **Provider Health Check** (`backend/scraper/health-check.js`):
-   **Trigger:** GitHub Actions (Daily at 8:00 AM UTC).
-   **Logic:** Executes a test extraction for every active provider using a shared Puppeteer browser instance and validates extracted prices.
-   **Alerts:** Sends a consolidated HTML-escaped failure report via **Nodemailer/SMTP** if any data source becomes unreachable or fails validation, and exits with a non-zero status code so CI surfaces the failure.
