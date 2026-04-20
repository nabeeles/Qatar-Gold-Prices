# Project Setup & Development Guide

This document describes how to set up the project for local development and deployment.

---

## 🏗️ Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
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

### 3. Start Development Server
```bash
npx expo start
```
> **Note:** Push notifications and some specific device features require a **Development Build**. To create one, use EAS:
> ```bash
> eas build --profile development --platform android
> ```

### 4. Build for Android (APK)
To create an installable APK for testing:
```bash
eas build --platform android --profile preview
```

> **CRITICAL:** Standalone builds require environment variables to be set in EAS. If your build crashes on startup, ensure you've run:
> ```bash
> eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "your_url" --environment preview --visibility plaintext
> eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your_key" --environment preview --visibility secret
> ```

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
```

### 3. Run Scraper Manually
```bash
# Navigate to backend and run the orchestrator
cd backend
node scraper/index.js
```

### 4. Run Administrative Scripts (Archived)
To re-initialize providers or migrate policies:
```bash
# From project root
node scripts/admin/migrate_providers.js
```

---

## 🚀 Deployment & CI/CD

### GitHub Actions (Scraper Cron)
The scraper is deployed using GitHub Actions. The workflow is located in `.github/workflows/scrape-prices.yml`.

To enable it, add the following secrets to your GitHub repository:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The cron job is set to run periodically (e.g., every 4 hours):
```yaml
on:
  schedule:
    - cron: '0 */4 * * *' # Every 4 hours
```

### EAS Build (App)
The app is built and deployed using Expo Application Services (EAS).
- Configure your project: `eas build:configure`
- Build for production: `eas build --platform android --profile production`
- Submit to Play Store: `eas submit --platform android`

---

## 🛠️ Supabase Configuration

### Initializing the Database
You can find the database schema in `backend/supabase_schema.sql`. Use the Supabase SQL Editor to run this script to set up the tables (`providers`, `gold_prices`, `price_alerts`) and the appropriate RLS policies.

### Adding Initial Providers
After creating the tables, ensure you add at least one active provider to the `providers` table to test the scraper:
```sql
INSERT INTO providers (name, url, is_active)
VALUES ('LivePriceOfGold', 'https://www.livepriceofgold.com/Qatar-gold-price.html', true);
```
