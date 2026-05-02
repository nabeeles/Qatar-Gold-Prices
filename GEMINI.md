# Qatar Gold Prices - Project Mandates

## 🛡️ Core Principles
- **Privacy First (Local-Only):** All user portfolio data (purchases, labels, weights) MUST be stored strictly in the local SQLite database. No PII or financial data shall ever be transmitted to external services.
- **Decimal Precision:** Financial values (Total Value, P/L, Price per Gram) must strictly display exactly two decimal places using the `formatCurrency` utility.
- **Data Sovereignty:** The Supabase backend is used EXCLUSIVELY for market prices and system health; user assets never leave the device.

## 🤖 AI Workflow & Architecture
### Scraper Orchestration (Primary-with-Fallback)
- **Engine Dispatch:** The system dynamically routes providers to either `Puppeteer` (Direct retail) or `Cheerio` (Aggregator) based on the database `scraping_type`.
- **Critical Vendor Fallback:** For high-impact providers (e.g., Malabar Gold), the scraper MUST attempt direct extraction first and automatically pivot to the `goldpriceqatar.com` aggregator if the primary source fails or returns partial data.
- **Fail-Safe Notifications:** Every fallback event or primary extraction failure MUST trigger an immediate email notification to the administrator via `sendFallbackAlert`.

### Mobile Frontend
- **Smart-Sync Entry:** The asset input form must support bi-directional price calculation. Entering "Weight" and either "Price per Gram" OR "Total Price" must automatically calculate and display the missing component.
- **Native Stability:** Use `KeyboardAvoidingView` for all forms and restrict `DateTimePicker` to a `maximumDate` of today.

## 🛠️ Build & Deployment
- **EAS Local Builds:** Production APKs MUST be built using `--local`. Environment variables (`EXPO_PUBLIC_SUPABASE_*`) must be manually exported in the shell before starting the build command to ensure they are correctly inlined.
