# Changelog

All notable changes to this project will be documented in this file.

## [1.4.0] - 2026-10-16

### Added
- **Supabase Production Readiness Suite (`backend/scripts/verify_supabase_production.js`)**: Added an 18-point automated verification script (`npm --prefix backend run verify:db`) auditing anonymous authentication, per-table RLS enforcement (`providers`, `gold_prices`, `price_alerts`), database constraints, active provider freshness, and historical price sanity.
- **Database RLS & Price-Bounds Migration (`backend/migrations/20261016_production_rls_hardening.sql`)**: Added an idempotent SQL migration enforcing `CHECK (price >= 100 AND price <= 2000)` on `gold_prices.price` and restricting `providers` and `gold_prices` read policies strictly to `TO authenticated`.
- **Google Play Store Graphic Assets (`docs/store-assets/`)**: Generated compliant 24-bit RGB PNG store assets including `play-store-icon-512.png` (`512×512`), `feature-graphic-1024x500.png` (`1024×500`), and 5 high-resolution phone screenshots (`1080×1920`).
- **Local EAS Release Helper (`app/scripts/build-release-local.sh`)**: Added `npm --prefix app run build:playstore:local` (`.aab`) and `npm --prefix app run build:apk:local` (`.apk`) with automatic `.env` loading and `EXPO_PUBLIC_SUPABASE_*` validation.
- **Standalone HTML Privacy Policy (`docs/privacy-policy.html`)**: Created a self-contained HTML privacy policy page ready for GitHub Pages HTTPS hosting.

### Fixed
- **Historical Data Hygiene (`backend/scripts/purge_corrupted_prices.js`)**: Purged 826 corrupted historical `gold_prices` rows (`167` rows with `price = 2026` and `659` rows from inverted-karat historical batches) from live Supabase and synchronized fresh prices across all 5 active Qatari providers.
- **Stale Cross-Session Karat Filtering (`app/lib/priceUtils.ts`)**: Updated `deduplicateLatestPrices` to exclude karat rows older than 1 hour relative to a provider's newest `scraped_at` timestamp, preventing discontinued karats from older sessions from mixing with current rates.
- **Resilient Android Push Token Registration (`app/lib/notifications.ts`)**: Hardened `registerForPushNotificationsAsync` to catch native FCM initialization errors when `google-services.json` is absent and return `null` gracefully.
- **macOS Scraper Browser Detection (`backend/scraper/strategies/puppeteer.js`)**: Added automatic fallback to system Google Chrome on macOS when bundled Chromium is unavailable.

## [1.3.0] - 2026-10-15

### Added
- **Shared Financial & Date Utilities (`app/lib/format.ts`)**: Added `formatCurrency` (strictly formatting values to two decimal places) and `parseLocalDate` (preventing UTC midnight timezone shift on `YYYY-MM-DD` strings).
- **Market Deduplication & Averaging (`app/lib/priceUtils.ts`)**: Added `deduplicateLatestPrices`, `computeMarketAverages`, and `getHistoricalCutoffIso` so Dashboard, Calculator, and Vault always evaluate the latest snapshot per `(provider_id, karat)`.
- **Active Alerts Management**: Upgraded the Alerts screen with a `[24K, 22K, 21K, 18K]` purity pill selector and an Active Alerts list with one-tap deletion.
- **Scraper Price & Hierarchy Validation (`backend/scraper/utils/validation.js`)**: Added `isValidGoldPrice`, `validateProviderPrices` (`24K >= 22K >= 21K >= 18K`), `normalizePriceMap`, and `isFallbackEligible` to prevent corrupted DOM scrapes from entering the database.
- **Automated Unit Test Suites**: Added unit test suites for both the mobile frontend (`npm --prefix app test`) and backend scraper (`npm --prefix backend test`).

### Fixed
- **Cold-Start Auth Gate**: Prevented premature unauthenticated query firing by gating root stack rendering on anonymous auth readiness (`isReady`) in `app/_layout.tsx`.
- **Historical Chart Windowing**: Replaced fixed `limit(500)` with a date-bounded `.gte('scraped_at', cutoffIso)` query in `useHistoricalPrices` so 30D charts display complete timelines.
- **Vault Deletion Confirmation & Input Guardrails**: Added a confirmation dialog before deleting holdings and KeyboardAvoidingView wrappers on Calculator and Alerts screens.
- **Browser Pooling & Alert Isolation**: Shared a single Puppeteer browser instance across providers during scrape/health-check runs, cached aggregator fallback results per run, and scoped push notifications to newly scraped prices.

## [1.2.0] - 2026-09-29

### Changed
- **Provider Registry Streamlining**: Soft-deactivated Shine Jewelers in the provider registry (`is_active: false`) following vendor storefront migration dropping public gold rate tables, preserving historical records.
- **Scraper Resilience & Multi-Tier Architecture**: Enhanced Malabar Gold extraction with a sub-second direct pricing API fast-path, interactive UI browser automation, and aggregator failover.
- **Fail-Safe Orchestration**: Updated critical retail fallback eligibility list to focus on active retail vendors (Al Fardan Exchange, Joyalukkas, Malabar Gold).

## [1.1.0] - 2026-04-26

### Added
- **My Gold Portfolio**: A new, private local-only tracker for physical gold holdings.
- **Smart-Cost Entry**: Intelligent form logic that cross-calculates *Total Price* vs. *Price per Gram* automatically.
- **Native Date Picker**: Replaced manual date input with a professional, native calendar picker for purchase dates.
- **18K Standardization**: Full integration of 18K gold pricing and historical trends across the entire app.
- **Trends Purity Selector**: Added the ability to toggle between 18K, 21K, 22K, and 24K on the historical charts.

### Fixed
- **Startup Stability**: Implemented global error boundaries and a "Safe-Start" layer to prevent app crashes on launch.
- **Defensive Data Handling**: Added robust null-checks for Supabase environment variables, allowing the app to function gracefully in "Offline Mode" if keys are missing.
- **Keyboard Overlap**: Optimized the "Add Asset" modal with `KeyboardAvoidingView` and `ScrollView` for seamless data entry.
- **Asset Validation**: Fixed image file extension mismatches (.png vs .jpg) to satisfy production build requirements.

### Infrastructure
- **Local Persistence**: Integrated `expo-sqlite` with the modern `SQLiteProvider` pattern for secure, asynchronous local storage.
- **Modernized Navigation**: Registered the "My Gold" tab in the bottom navigation with a dedicated icon.
- **EAS Environment**: Successfully configured Supabase environment variables in the cloud build environment.

## [1.0.0] - 2026-04-13

### Added
- **21K Gold Support**: Added full support for 21K gold rates across the scraper, database, and mobile application.
- **Calculator Tab**: New estimation tool allowing users to calculate the value of their gold based on current market averages for 24K, 22K, 21K, and 18K purity.
- **Enhanced Scraper**: Improved Puppeteer strategy for `LivePriceOfGold` to capture all four major karats (24K, 22K, 21K, 18K).
- **Dashboard Market Average**: Real-time 24K market average display on the home screen.

### Fixed
- **Database Constraints**: Updated `gold_prices` table to allow 21K karat values.
- **Scraper Reliability**: Added error handling and better user-agent simulation to avoid scraping blocks.
- **UI Refinement**: Optimized dashboard provider sorting and data grouping.

### Infrastructure
- **Production Build Config**: Configured `eas.json` for production-ready distribution.
- **Supabase Integration**: Finalized RLS policies for secure data access.
