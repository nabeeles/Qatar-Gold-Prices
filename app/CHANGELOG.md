# Changelog

All notable changes to this project will be documented in this file.

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
