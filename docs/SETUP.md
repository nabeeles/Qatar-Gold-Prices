# Project Setup & Development Guide

This document describes how to set up the project for local development and deployment.

---

## 🏗️ Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v24+ recommended)
- [npm](https://www.npmjs.com/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, for local DB development)

---

## 📱 Mobile App Setup (`app/`)

### 1. Install Dependencies
```bash
cd app
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the `app/` directory:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run Unit Tests & Type Check
```bash
cd app
npm test
npx tsc --noEmit
```

### 4. Start Development Server
```bash
npx expo start
```

### 5. Build for Android (Local APK via EAS)
Per project mandates, production APKs are built locally using `--local` with environment variables explicitly exported in the shell:
```bash
export EXPO_PUBLIC_SUPABASE_URL="your_supabase_url"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
npx eas build --local -p android --profile production
```

---

## 🕷️ Backend Scraper Setup (`backend/`)

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the `backend/` directory:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
EMAIL_USER=your_gmail_address
EMAIL_PASS=your_gmail_app_password
NOTIFICATION_EMAIL=admin_recipient_email
```

### 3. Run Unit Tests
```bash
cd backend
npm test
```

### 4. Run Scraper or Health Check Manually
```bash
cd backend
node scraper/index.js
node scraper/health-check.js
```

---

## 🚀 Deployment & CI/CD

### GitHub Actions (Scraper Cron & Health Check)
The automated workflows are located in `.github/workflows/scrape-prices.yml` (hourly at `0 * * * *`) and `.github/workflows/health-check.yml` (daily at `0 8 * * *`).

Configure the following repository secrets in GitHub:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EMAIL_USER`
- `EMAIL_PASS`
- `NOTIFICATION_EMAIL`

---

## 🛠️ Supabase Configuration

### Initializing the Database
Run the following SQL scripts in the Supabase SQL Editor:
1. `backend/supabase_schema.sql`: Creates the `providers` and `gold_prices` tables, composite indexes (`idx_gold_prices_karat_scraped_at` and `idx_gold_prices_provider_karat_scraped_at`), RLS policies, and seeds the default providers (`Al Fardan Exchange`, `Joyalukkas`, `Malabar Gold`, `GoodReturns Aggregator`, and `LivePriceOfGold`).
2. `backend/price_alerts_schema.sql`: Creates the `price_alerts` table (`user_id`, `expo_push_token`, `karat`, `target_price`, `condition`, `is_active`) and enforces per-user RLS policies (`auth.uid() = user_id`). Ensure **Anonymous Sign-Ins** are enabled in your Supabase Auth settings.
