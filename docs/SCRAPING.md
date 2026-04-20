# Scraping Strategy Guide

This document describes how the scraping system works and how to maintain or expand it.

---

## 🛠️ Scraper Core

The scraper is located in `backend/scraper/`. It uses **Puppeteer** to handle modern, JavaScript-heavy websites.

### Primary Files
- `index.js`: The entry point that orchestrates the entire process.
- `strategies/puppeteer.js`: Contains the browser-based extraction logic.
- `utils/db.js`: Handles communication with Supabase.
- `utils/alerts.js`: Manages the push notification logic.

---

## 🔍 How Scraping Works

For each active provider in the `providers` table:
1.  **Browser Launch:** A headless Chromium instance is launched via Puppeteer.
2.  **Navigation:** The scraper visits the provider's `url`.
3.  **Interaction:** Specific providers (like Malabar) require clicking buttons or selecting options from dropdowns.
4.  **Extraction:** An `in-page script` runs within the browser context to find price data.
5.  **Sanitization:** Extracted text (e.g., "572.50 QAR") is cleaned and converted into a decimal number.
6.  **Persistence:** Prices for 24K, 22K, 21K, and 18K are saved to Supabase.

---

## 🧩 Provider-Specific Strategies

The extraction logic in `strategies/puppeteer.js` uses conditional blocks for different providers:

### 📉 LivePriceOfGold
Uses a **robust text-segmentation strategy**. It parses table rows and segments the text string (e.g., "24K Gold/gram -0.04 556.790 545.7 584.6") to extract the precise bid price from the data columns.

### 🏛️ Al Fardan Exchange
Uses a **label-based search**. It looks for specific text content like `24 KARAT` and extracts the value from its parent or neighboring elements.

### 📈 GoodReturns (Aggregator)
Parses a **summary table**. It identifies the rows by their gram labels (e.g., `1 ﷼`) and pulls the price from the second column.

### ✨ Malabar Gold
Handles **dynamic elements**. It selects the country (QA) from a dropdown, clicks the "Show Gold Rates" button, and then uses specific class name selectors to find the prices.

---

### 🚀 How to Add a New Provider

To add a new gold price source:

#### 1. Register the Provider in Supabase
Insert a new record into the `providers` table:
```sql
INSERT INTO providers (name, url, is_active)
VALUES ('New Provider Name', 'https://www.provider-url.com', true);
```

#### 2. Update `strategies/puppeteer.js`
Add a new block for your provider inside the `page.evaluate()` function:
```javascript
if (pName.includes('New Provider')) {
    // Add custom extraction logic here
    res['24k'] = cleanPrice(document.querySelector('.price-selector')?.innerText);
    return res;
}
```

#### 3. Execution & Testing
To test the scraper manually after making changes, run the production orchestration script:
```bash
cd backend/scraper
node index.js
```

---

### 📂 Administrative Archive

One-off provisioning and migration tools are maintained in the root `scripts/admin/` directory for reference or environment re-initialization:
- `migrate_providers.js`: Standardizes provider strategies and karat selectors.
- `add_shine.js`: Provisions the Shine Jewelers retail institution.
- `fix_policy.sql`: (Archived) Reference for historical RLS remediations.

---

### ℹ️ Supported Karats


The system currently scrapes and supports:
*   **24K** (999 Gold)
*   **22K** (916 Gold)
*   **21K** (Used locally in Qatar)
*   **18K** (750 Gold)

> **Note:** Ensure your Supabase `gold_prices_karat_check` constraint allows for all karats you intend to scrape.

---

## ⚠️ Troubleshooting

- **Timeout Errors:** Some providers (like Malabar or Shine) are slow to load. Use `await new Promise(r => setTimeout(r, time))` to wait for content.
- **Bot Detection:** Many sites use Cloudflare or other anti-bot measures. The scraper uses a common User-Agent string to reduce detection risk.
- **Selector Changes:** Vendor websites often change their layout. If a provider stops returning data, check the class names or table structures and update the strategy accordingly.
