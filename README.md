# 💰 Qatar Gold Prices

A full-stack mobile application to track real-time gold prices in Qatar from multiple local providers.

---

## ✨ Features

- **📍 Multiple Providers:** Scraping prices directly from Al Fardan Exchange, Malabar Gold, LivePriceOfGold, and more.
- **🕒 Real-time Updates:** Stay updated with the latest 24K, 22K, 21K, and 18K gold rates per gram in QAR.
- **📊 Historical Trends:** Interactive charts showing gold price fluctuations over time.
- **🔔 Price Alerts:** Set custom targets for when the gold price drops or rises above your specified value.
- **📱 Native Mobile Experience:** Built with Expo and React Native for a smooth, high-performance UI.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** [Expo](https://expo.dev/) (React Native)
- **State Management:** [React Query](https://tanstack.com/query/latest)
- **Styling:** [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for React Native)
- **Charts:** [Victory Native](https://formidable.com/open-source/victory/)

### Backend
- **Database:** [Supabase](https://supabase.com/) (PostgreSQL)
- **Scraper:** [Node.js](https://nodejs.org/) + [Puppeteer](https://pptr.dev/)
- **Infrastructure:** [GitHub Actions](https://github.com/features/actions) (Scheduled CRON Scraping)
- **Push Notifications:** [Expo SDK](https://docs.expo.dev/push-notifications/overview/)

---

## 🚀 Quick Start

### 1. Repository Setup
```bash
git clone https://github.com/your-username/qatar-gold-prices.git
cd qatar-gold-prices
```

### 2. Backend & Scraper Setup
Detailed instructions can be found in [docs/SETUP.md](docs/SETUP.md).

### 3. Mobile App Setup
Detailed instructions can be found in [docs/SETUP.md](docs/SETUP.md).

---

## 📂 Project Structure

```bash
├── app/              # React Native Mobile Application (Expo)
├── backend/          # Node.js Scraper and Supabase configurations
├── conductor/        # Project planning and feature roadmap
├── docs/             # Technical Documentation & Security Audits
├── scripts/          # Administrative and provisioning tools
└── .github/          # GitHub Actions (Scraper Automation)
```

---

## 📄 Documentation

For more detailed information, please refer to the following guides:

- **[Architecture Overview](docs/ARCHITECTURE.md):** High-level system design and data flow.
- **[Scraping Strategies](docs/SCRAPING.md):** How we extract data from various vendors.
- **[API & Schema](docs/API.md):** Database structure and data access patterns.
- **[Setup Guide](docs/SETUP.md):** Local development and deployment instructions.

---

## ⚖️ License
MIT
