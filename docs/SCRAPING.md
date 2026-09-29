# Scraping Strategy & Data Sources

This document details the methodologies, heuristics, and fail-safes used to synchronize Qatar's gold market data.

---

## 🤖 Orchestration: Dynamic Dispatch

The scraper uses a tiered orchestration logic to balance accuracy and speed:
1.  **Direct Strategy (Puppeteer):** Used for primary retail websites (Al Fardan, Joyalukkas, Malabar) that utilize heavy JavaScript hydration or require regional interaction.
2.  **Aggregator Strategy (Cheerio):** Used for lightweight market aggregator sites (GoodReturns, LivePriceOfGold) that provide fast, static HTML snapshots of the broader market.

---

## 🛡️ Robustness: Multi-Tier Fail-Safe

For critical market indicators (e.g., Malabar Gold), we implement an intelligent 3-tier extraction architecture:
-   **Tier 1 (Fast-Path Direct Pricing API):** Sub-second extraction querying the official regional pricing endpoint (`POST /ae/malabarprice/index/getrates/?country=QA&state=Doha`). Operates in `< 400ms` with zero browser/RAM overhead.
-   **Tier 2 (Interactive UI Automation):** If the direct API fails or is restricted, Puppeteer navigates to `https://www.malabargoldanddiamonds.com/ae/goldprice`, dismisses overlays, selects "Qatar" (`QA`) and "Doha", triggers the rate submission, and parses live DOM values.
-   **Tier 3 (Aggregator Failover):** If direct extraction fails or returns partial data, the system automatically pivots to a verified market aggregator (`goldpriceqatar.com`).
-   **Alerts:** Primary extraction failures or fallback events trigger an automated email to the administrator to investigate provider health.

---

## 🔍 Extraction Heuristics

To handle frequent website structural changes without constant code maintenance, the scraper employs the following heuristics:

### 1. Sequential Label Scanning
Instead of relying on fragile CSS selectors (e.g., `.price-value`), the engine scans for "Anchors" (24K, 22K, 18K) and then evaluates the immediate textual surroundings for:
-   **Currency Tokens:** Matches strings containing `QAR` or `﷼`.
-   **Decimal Precision:** Prioritizes values with `.` (e.g., `552.50`) to avoid picking up store counts or years.
-   **Market Range Validation:** Discards any value outside the realistic range of `100` to `2000` QAR per gram.

### 2. Multi-Column Mapping
For tabular data, the scraper maps header indices to data row indices dynamically, ensuring that if a new karat column is added, existing extractions remain aligned.

---

## 📊 Provider Registry

| Provider | Method | URL Type | Notes |
| :--- | :--- | :--- | :--- |
| **Malabar Gold** | Direct (API + Interactive DOM) | Regional Gold Price (`/ae/goldprice`) | Tier 1: Sub-second JSON API. Tier 2: Interactive UI. Tier 3: Aggregator fallback. |
| **Joyalukkas** | Direct | Regional Page | Requires browser hydration. |
| **Al Fardan Exchange** | Direct | Store / Rates Page | Direct product extraction. |
| **GoodReturns** | Aggregator | Market Feed | Very fast, high-reliability fallback. |
| **LivePriceOfGold**| Aggregator | Market Feed | Global market sync. |

---

## 🏥 Health & Monitoring

The system is self-monitoring via a daily **Provider Health Check**:
-   **Trigger:** GitHub Actions (Daily at 8:00 AM UTC).
-   **Logic:** Executes a test extraction for every active provider.
-   **Alerts:** Sends a consolidated failure report via **Nodemailer/SMTP** if any data source becomes unreachable.
