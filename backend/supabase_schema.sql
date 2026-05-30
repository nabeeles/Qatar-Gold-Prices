-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Create Providers Table
create table providers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  url text not null,
  scraping_type text not null check (scraping_type in ('direct', 'aggregator')),
  selectors jsonb default '{}'::jsonb,
  is_active boolean default true,
  last_scraped_at timestamptz,
  created_at timestamptz default now()
);

comment on table providers is 'Registry of gold price retail institutions and aggregators.';
comment on column providers.name is 'The professional name of the retail institution.';
comment on column providers.url is 'The primary landing page or API endpoint used for market synchronization.';
comment on column providers.scraping_type is 'The architectural strategy used for data extraction (e.g., dynamic Puppeteer vs static Cheerio).';
comment on column providers.selectors is 'A JSON mapping of karat labels to their respective DOM selectors or regex patterns.';
comment on column providers.is_active is 'Administrative flag to toggle market data synchronization for this provider.';

-- 3. Create Gold Prices Table
create table gold_prices (
  id bigint primary key generated always as identity,
  provider_id uuid references providers(id) on delete cascade,
  karat integer not null check (karat in (24, 22, 21, 18)),
  price decimal(10, 2) not null,
  currency text default 'QAR',
  scraped_at timestamptz default now()
);

comment on table gold_prices is 'Historical ledger of gold price records aggregated from across the Qatari market.';
comment on column gold_prices.karat is 'The purity level of the gold record (24, 22, 21, or 18).';
comment on column gold_prices.price is 'The spot price per gram in Qatari Riyals.';
comment on column gold_prices.scraped_at is 'The precise timestamp of the market synchronization event.';

-- 4. Enable Row Level Security (RLS)
alter table providers enable row level security;
alter table gold_prices enable row level security;

-- 5. RLS Policies for 'providers' table
-- Scraper (service_role) has full access (bypasses RLS by default in Supabase)
-- Mobile App (authenticated users) should NOT see provider configs/selectors
create policy "No public/app access to providers"
  on providers for select
  using (false);

-- 6. RLS Policies for 'gold_prices' table
-- Mobile App (authenticated users, including Anonymous Sign-ins) can READ prices
create policy "Authenticated users can read gold prices"
  on gold_prices for select
  to authenticated
  using (true);

-- Scraper (service_role) can INSERT prices
-- (Note: service_role bypasses RLS, but we explicitly block anon/unauthenticated)
create policy "Unauthenticated users cannot read gold prices"
  on gold_prices for select
  to anon
  using (false);

-- 7. Seed Initial Data
insert into providers (name, url, scraping_type, selectors) values
('Al Fardan Exchange', 'https://alfardanexchange.com.qa/gold-rates', 'direct', '{"24k": "24 KARAT", "22k": "22 KARAT"}'),
('Joyalukkas', 'https://www.joyalukkas.com/qa/goldrate', 'direct', '{"24k": "24K", "22k": "22K"}'),
('Malabar Gold', 'https://www.malabargoldanddiamonds.com/us/stores/qatar', 'direct', '{"24k": "24K", "22k": "22K"}'),
('GoodReturns Aggregator', 'https://www.goodreturns.in/gold-rates/qatar.html', 'aggregator', '{"24k": "24 K Gold", "22k": "22 K Gold"}');
