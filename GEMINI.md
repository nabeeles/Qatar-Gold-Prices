# Qatar Gold Prices - Project Mandates

## 🛡️ Core Principles
- **Privacy First (Local-Only):** All user portfolio data (purchases, labels, weights) MUST be stored strictly in the local SQLite database. No PII or financial data shall ever be transmitted to external services.
- **Decimal Precision:** Financial values (Total Value, P/L, Price per Gram) must strictly display exactly two decimal places using the `formatCurrency` utility.
- **Data Sovereignty:** The Supabase backend is used EXCLUSIVELY for market prices and system health; user assets never leave the device.

## 🤖 AI Workflow & Architecture
### Scraper Orchestration (Direct Extraction)
- **Engine Dispatch:** The system dynamically routes providers to either `Puppeteer` (Direct retail) or `Cheerio` (Aggregator) based on the database `scraping_type`.
- **Multi-Tier Direct Extraction:** For Malabar Gold (GeoIP-aware regional store views `/ae/`, `/us/`, `/uk/`) and Al Fardan Exchange (`GET /api/gold-rates` and upstream `alfaremit.com:7095` with parallel SOCKS5 regional egress for Geo-fenced CI runners), the scraper attempts Tier 1 fast-path JSON API extraction first, cascading to Tier 2 interactive browser UI automation if needed. No third-party aggregator fallback is substituted for direct retail providers.
- **Fail-Safe Notifications:** Every primary extraction failure MUST trigger an immediate email notification to the administrator via `sendFallbackAlert`.

### Mobile Frontend
- **Smart-Sync Entry:** The asset input form must support bi-directional price calculation. Entering "Weight" and either "Price per Gram" OR "Total Price" must automatically calculate and display the missing component.
- **Native Stability:** Use `KeyboardAvoidingView` for all forms and restrict `DateTimePicker` to a `maximumDate` of today.

## 🛠️ Build & Deployment
- **EAS Local Builds:** Production APKs MUST be built using `--local`. Environment variables (`EXPO_PUBLIC_SUPABASE_*`) must be manually exported in the shell before starting the build command to ensure they are correctly inlined.
