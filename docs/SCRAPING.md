# Scraping Strategy & Data Sources

This document details the methodologies, heuristics, and fail-safes used to synchronize Qatar's gold market data.

---

## 🤖 Orchestration: Dynamic Dispatch

The scraper uses a tiered orchestration logic to balance accuracy and speed:
1.  **Direct Strategy (Puppeteer):** Used for primary retail websites (Shine, Joyalukkas) that utilize heavy JavaScript hydration or require regional interaction.
2.  **Aggregator Strategy (Cheerio):** Used for lightweight market aggregator sites (GoodReturns, LivePriceOfGold) that provide fast, static HTML snapshots of the broader market.

---

## 🛡️ Robustness: Primary-with-Fallback

For critical market indicators (e.g., Malabar Gold), we implement a multi-stage fail-safe:
-   **Step 1 (Direct):** Attempt to scrape the official store locator page.
-   **Step 2 (Pivot):** If Step 1 times out or returns incomplete data, the system automatically pivots to a verified market aggregator (`goldpriceqatar.com`).
-   **Step 3 (Alert):** Upon successful fallback, an automated email is dispatched to the administrator to investigate the primary source health.

---

## 🔍 Extraction Heuristics

To handle frequent website structural changes without constant code maintenance, the scraper employs the following heuristics:

### 1. Sequential Label Scanning
Instead of relying on fragile CSS selectors (e.g., `.price-value`), the engine scans for "Anchors" (24K, 22K, 18K) and then evaluates the immediate textual surroundings for:
-   **Currency Tokens:** Matches strings containing `QAR` or `﷼`.
-   **Decimal Precision:** Prioritizes values with `.` (e.g., `552.50`) to avoid picking up store counts or years.
-   **Market Range Validation:** Discards any value outside the realistic range of `100` to `2000` QAR per gram.

### 2. Multi-Column Mapping
For tabular data (e.g., Shine Jewelers), the scraper maps header indices to data row indices dynamically, ensuring that if a new karat column is added, existing extractions remain aligned.

---

## 📊 Provider Registry

| Provider | Method | URL Type | Notes |
| :--- | :--- | :--- | :--- |
| **Malabar Gold** | Direct | Store Locator | Primary: Official Store. Fallback: Aggregator. |
| **Joyalukkas** | Direct | Regional Page | Requires browser hydration. |
| **Shine Jewelers** | Direct | Rates Page | Stable <table> based extraction. |
| **GoodReturns** | Aggregator | Market Feed | Very fast, high-reliability fallback. |
| **LivePriceOfGold**| Aggregator | Market Feed | Global market sync. |

---

## 🏥 Health & Monitoring

The system is self-monitoring via a daily **Provider Health Check**:
-   **Trigger:** GitHub Actions (Daily at 8:00 AM UTC).
-   **Logic:** Executes a test extraction for every active provider.
-   **Alerts:** Sends a consolidated failure report via **Nodemailer/SMTP** if any data source becomes unreachable.
