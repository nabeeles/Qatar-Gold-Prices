# Architecture Overview

The **Qatar Gold Prices** project is a full-stack system designed to scrape gold prices from multiple providers, store them in a real-time database, and display them to users via a mobile application.

---

## 🏗️ High-Level System Design

```
+-------------------+      +-------------------+      +-------------------+
|  GitHub Actions   |      |     Supabase      |      | React Native App  |
| (Scraper Cron)    | ---> |  (PostgreSQL DB)  | <--- | (Expo / Mobile)   |
+---------+---------+      +---------+---------+      +---------+---------+
          |                          |                          |
          | Scrape Prices            | Real-time Updates        | Push Alerts
          v                          |                          v
+---------+---------+                |                +---------+---------+
| Provider Websites |                +--------------> |   Expo Push API   |
| (Shine, Malabar, etc)|                              | (Notifications)   |
+-------------------+                                  +-------------------+
```

---

## 🔍 Component Breakdown

### 1. The Scraper (Backend)
- **Runtime:** Node.js
- **Tooling:** [Puppeteer](https://pptr.dev/) for browser-based scraping and [Cheerio](https://cheerio.js.org/) for static HTML parsing.
- **Execution:** Runs as a scheduled job via **GitHub Actions** (CRON job).
- **Logic:** Fetches active providers from Supabase, visits their sites, extracts 24K/22K/21K/18K gold rates (QAR/Gram), and saves them to the database.

### 2. The Database (Supabase)
- **Engine:** PostgreSQL
- **Key Tables:**
  - `providers`: Stores provider details (name, URL, active status).
  - `gold_prices`: Stores historical price records linked to providers.
  - `price_alerts`: Stores user push notification tokens and target price conditions.
- **Security:** 
  - Row Level Security (RLS) policies are enabled.
  - **Identity Verification:** Users can only manage their own alerts using secure `(select auth.uid())` subqueries, which support both anonymous and permanent sessions.
  - **Access Control:** Restricts data writes to the service role (used by the scraper) while allowing public read access to market rates.

### 3. The App (Frontend)
- **Framework:** [Expo](https://expo.dev/) / React Native.
- **State Management:** [React Query](https://tanstack.com/query/latest) for caching, optimistic updates, and background data synchronization.
- **Styling:** NativeWind (Tailwind CSS for React Native).
- **Communication:** Directly interacts with Supabase using the `@supabase/supabase-js` SDK.

### 4. Alert System
- **Provider:** Expo Push Notification Service.
- **Flow:**
  - After every scraping run, the `backend` checks the `price_alerts` table.
  - If a price matches a user's target condition, the backend sends a request to the Expo Push API.
  - The Expo service delivers the notification to the user's mobile device.

---

## 🛠️ Data Flow

1. **GitHub Actions** triggers `backend/scraper/index.js` (every 1-4 hours).
2. **Scraper** fetches providers from `providers` table.
3. **Puppeteer** extracts prices from the vendor websites.
4. **Scraper** saves results into the `gold_prices` table.
5. **Scraper** calculates price averages and triggers the **Alert Service**.
6. **Alert Service** sends push notifications via **Expo SDK**.
7. **Mobile App** (React Query) detects the new database entries and updates the UI automatically.
