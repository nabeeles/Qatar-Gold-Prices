# API & Data Schema

This document covers the Supabase database schema and the data access patterns used in the project.

---

## 🗄️ Database Schema

The database is hosted on **Supabase** (PostgreSQL). Below is an overview of the primary tables and their relationships.

### 1. `providers` Table
This table stores information about the gold price vendors.
| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key (`uuid_generate_v4()`). |
| `name` | `text` | Name of the provider (e.g., Al Fardan Exchange). |
| `url` | `text` | The website URL used for scraping. |
| `scraping_type` | `text` | Extraction strategy (`'direct'` for Puppeteer or `'aggregator'` for Cheerio). |
| `selectors` | `jsonb` | JSON mapping of karat labels to DOM selectors or patterns. |
| `is_active` | `boolean` | Flag to enable/disable scraping for this provider. |
| `last_scraped_at` | `timestamptz` | Updated automatically after a successful scrape. |
| `created_at` | `timestamptz` | Record creation timestamp. |

### 2. `gold_prices` Table
This table stores historical gold price records.
| Column | Type | Description |
|---|---|---|
| `id` | `int8` | Primary key (`bigint generated always as identity`). |
| `provider_id` | `uuid` | Foreign key referencing `providers(id)`. |
| `karat` | `int4` | The gold karat (`24`, `22`, `21`, or `18`, enforced via `CHECK`). |
| `price` | `numeric(10, 2)` | The price per gram in QAR (`CHECK (price >= 100 AND price <= 2000)`). |
| `currency` | `text` | Always `'QAR'`. |
| `scraped_at` | `timestamptz` | Timestamp of when the price was extracted. |

### 3. `price_alerts` Table
Used to store user push notification targets.
| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key (`uuid_generate_v4()`). |
| `user_id` | `uuid` | The authenticated (including anonymous sign-in) Supabase user ID. |
| `karat` | `int4` | Target karat for the alert (`24`, `22`, `21`, or `18`). |
| `target_price` | `numeric(10, 2)` | Price threshold to trigger the alert. |
| `condition` | `text` | Trigger condition (`'above'` or `'below'`). |
| `expo_push_token` | `text` | The unique Expo token for sending push notifications. |
| `is_active` | `boolean` | Set to `false` after the alert is triggered. |
| `created_at` | `timestamptz` | Record creation timestamp. |

---

## 🔒 Security & Access Control

### Row Level Security (RLS)
The database uses Supabase RLS policies to control access (auditable via `npm --prefix backend run verify:db`):
- **Authenticated Sessions (including Anonymous Sign-ins):** Can **SELECT** from `gold_prices` and `providers`, and **SELECT/INSERT/UPDATE/DELETE** their own rows in `price_alerts` where `(select auth.uid()) = user_id`.
- **Unauthenticated (`anon`) Role:** Explicitly blocked from reading `gold_prices` and `providers` or modifying `price_alerts`.
- **Scraper (`service_role`):** Has full access to write into `gold_prices`, update `price_alerts`, and read/update `providers`.

### Authentication
The mobile app uses **Anonymous Authentication** (`signInAnonymously`) from Supabase and waits for session initialization before mounting data queries. This allows users to create and manage price alerts without needing a traditional login (email/password).

---

## 📡 Data Fetching (Mobile App)

The app uses **React Query** (`@tanstack/react-query`) to interact with the database efficiently.

### `useLatestPrices()`
- **Query Key:** `['latest-prices']`
- **Purpose:** Fetches the most recent price records (`.limit(100)`) and deduplicates by `(provider_id, karat)` via `deduplicateLatestPrices` (`app/lib/priceUtils.ts`), automatically dropping any stale karat row older than 1 hour relative to a provider's newest `scraped_at` timestamp.
- **Join Logic:** Performs a join with `providers (name, is_active)` and filters out inactive providers.

### `useHistoricalPrices(karat)`
- **Query Key:** `['historical-prices', karat]`
- **Purpose:** Fetches the last 35 days (`.limit(5000)`) of historical price records for a given karat from active providers, ordered chronologically for trend charts.
- **Aggregation:** Data is grouped by date and averaged on the client-side for smoother chart visualization.
