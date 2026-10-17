# 💰 Qatar Gold Prices

A premium, privacy-first mobile application to track real-time gold market data in Qatar and manage your personal holdings securely.

---

## ✨ Features

- **📍 Resilient Scraping:** Dual-engine architecture (Puppeteer & Cheerio) with **2-Tier Direct Extraction** (fast-path JSON APIs + interactive browser automation) for retail providers like Malabar Gold and Al Fardan Exchange.
- **🛡️ Privacy-First Portfolio:** A secure, **Local-Only** vault to track your gold assets (Weight, Karat, Purchase Price). Your data never leaves your device.
- **🕒 Real-time Market Feed:** Aggregated 24K, 22K, 21K, and 18K gold rates synchronized every hour from 5 reliable sources.
- **📈 Performance Analytics:** Instant ROI and profit/loss calculation based on live deduplicated market averages.
- **⚡ Smart-Sync Entry:** Intelligent bi-directional calculation between "Total Price" and "Price per Gram."
- **🔔 Proactive Alerts:** Custom target notifications and automated system health emails for administrators.

---

## 🛠️ Tech Stack

### Mobile Frontend
- **Framework:** [Expo 54](https://expo.dev/) (React Native)
- **Local Database:** [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) (Secure Sandbox)
- **State Engine:** [React Query v5](https://tanstack.com/query/latest)
- **Styling:** [NativeWind v4](https://www.nativewind.dev/) (Tailwind CSS)

### Backend & Infrastructure
- **Cloud Database:** [Supabase](https://supabase.com/) (PostgreSQL with RLS)
- **Automation:** [GitHub Actions](https://github.com/features/actions) (Hourly Scraper & Daily Health Check)
- **Communications:** [Nodemailer](https://nodemailer.com/) (SMTP Alerts) & [Expo Push SDK](https://docs.expo.dev/push-notifications/overview/)

---

## 📂 Documentation

- **[Architecture Overview](docs/ARCHITECTURE.md):** The robust system design and data sovereignty model.
- **[Scraping Strategy](docs/SCRAPING.md):** Multi-tier direct extraction, heuristics, and failure notification logic.
- **[API & Schema Reference](docs/API.md):** Supabase schema, RLS policies, and data hooks.
- **[Setup & Deployment](docs/SETUP.md):** Instructions for local EAS builds, testing, and environment injection.
- **[Google Play Store Release Guide](docs/PLAY_STORE_RELEASE.md):** Store listing assets, Data Safety answers, and release build steps.
- **[Privacy Policy](docs/PRIVACY_POLICY.md)** ([HTML page](docs/privacy-policy.html)): Public zero-knowledge privacy disclosure.
- **[Security Audit](docs/SECURITY_AUDIT.md):** Remediated findings, live Supabase verification, and dependency hardening report.

---

## 🚀 Development & Testing

Run the automated unit test suites and the 18-point live Supabase production readiness check:
```bash
npm --prefix app test
npm --prefix backend test
npm --prefix backend run verify:db
```

Production builds are performed locally using **EAS Local** (`app/scripts/build-release-local.sh` validates and exports `EXPO_PUBLIC_SUPABASE_*` automatically from `app/.env`):
```bash
# Build signed Android App Bundle (.aab) for Google Play Store
npm --prefix app run build:playstore:local

# Build signed standalone APK (.apk) for direct distribution
npm --prefix app run build:apk:local
```

---

## ⚖️ License
MIT
