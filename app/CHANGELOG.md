# Changelog

All notable changes to this project will be documented in this file.

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
