# 💰 Qatar Gold Prices

A premium, privacy-first mobile application to track real-time gold market data in Qatar and manage your personal holdings securely.

---

## ✨ Features

- **📍 Resilient Scraping:** Dual-engine architecture (Puppeteer & Cheerio) with a **Direct-with-Fallback** safety net for critical providers like Malabar Gold.
- **🛡️ Privacy-First Portfolio:** A secure, **Local-Only** vault to track your gold assets (Weight, Karat, Purchase Price). Your data never leaves your device.
- **🕒 Real-time Market Feed:** Aggregated 24K, 22K, 21K, and 18K gold rates synchronized every hour from 5 reliable local sources.
- **📈 Performance Analytics:** Instant ROI and profit/loss calculation based on live market averages.
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
- **[Scraping Strategy](docs/SCRAPING.md):** Detailed heuristics and aggregator fail-safe logic.
- **[Setup & Deployment](docs/SETUP.md):** Instructions for local EAS builds and environment injection.
- **[Security Audit](docs/SECURITY_AUDIT.md):** Remediated findings and dependency hardening report.

---

## 🚀 Development Note

Production builds are performed locally using **EAS Local** to ensure maximum stability.
```bash
# Manual environment injection is required for local builds
export EXPO_PUBLIC_SUPABASE_URL="your_url"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="your_key"
npx eas build --local -p android --profile production
```

---

## ⚖️ License
MIT
