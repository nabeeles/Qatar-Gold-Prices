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
- **Engine Dispatch:** Dynamically routes tasks to **Puppeteer** (for heavy retail sites) or **Cheerio** (for lightweight aggregators) based on database metadata.
- **Primary-with-Fallback:** For critical vendors (e.g., Malabar Gold), the scraper attempts a direct URL extraction first and automatically pivots to a verified aggregator if the primary source fails.
- **Health Monitoring:** A daily automated check verifies all data sources. Failures trigger immediate **SMTP Alerts** to the administrator.

### 2. The Cloud Layer (Supabase)
- **Market Truth:** Acts as the global source of truth for gold rates across Qatar.
- **Anonymized Alerts:** Stores push tokens and price thresholds. No personal identifiers are linked to market movements.
- **Hardened Security:** All sensitive keys are managed via environment variables. Insecure administrative scripts have been permanently removed.

### 3. The Private Vault (Mobile Frontend)
- **Local-Only Privacy:** All user portfolio data (purchases, labels, weights) is stored strictly in the **Local SQLite** database. This data never leaves the device.
- **Real-time Valuation:** Combines live Supabase market averages with local vault entries to provide instant ROI and performance analytics.
- **Smart-Sync Input:** Intelligent form logic that bi-directionally calculates "Total Price" and "Price per Gram" based on user-provided weight.

---

## 🛡️ Guiding Principles

1.  **Privacy by Design:** Portfolio data is a sovereign asset of the user. We never transmit PII or financial holdings to the cloud.
2.  **Precision Engineering:** Every financial value is strictly formatted to two decimal places using standard utility hooks.
3.  **Resilient Scraping:** We prioritize direct retail data but always maintain a functional fail-safe aggregator to ensure 100% up-time.
4.  **Local-First Stability:** Production builds are performed locally with manual environment injection to ensure maximum stability and crash resistance.

---

## 🛠️ Data Lifecycle

1.  **Sync:** GitHub Actions triggers `backend/scraper/index.js` (every hour).
2.  **Extract:** Orchestrator attempts Direct extraction -> Fallback to Aggregator if needed.
3.  **Persist:** Validated prices are saved to Supabase.
4.  **Notify:** Success or Fallback events trigger relevant Push or Email notifications.
5.  **View:** Mobile App retrieves averages from Supabase and applies them to the local Vault for valuation.
