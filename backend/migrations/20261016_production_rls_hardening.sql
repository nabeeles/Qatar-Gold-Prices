-- 1. Reconcile 'providers' RLS policies so inactive providers are hidden from mobile clients
alter table public.providers enable row level security;

drop policy if exists "No public/app access to providers" on public.providers;
drop policy if exists "Authenticated users can read providers" on public.providers;
drop policy if exists "Authenticated users can read active providers" on public.providers;
drop policy if exists "Unauthenticated users cannot read providers" on public.providers;
drop policy if exists "Enable read access for all users" on public.providers;
drop policy if exists "Allow public read access" on public.providers;

create policy "Authenticated users can read active providers"
  on public.providers for select
  to authenticated
  using (is_active = true);

create policy "Unauthenticated users cannot read providers"
  on public.providers for select
  to anon
  using (false);

-- 2. Reconcile 'price_alerts' RLS policies to block cross-user user_id spoofing on INSERT/UPDATE
alter table public.price_alerts enable row level security;

drop policy if exists "Allow anonymous alert insertion" on public.price_alerts;
drop policy if exists "Users can manage their own alerts" on public.price_alerts;

create policy "Users can manage their own alerts"
  on public.price_alerts for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 3. Enforce database-level price sanity bounds on 'gold_prices' (100 to 2000 QAR/g)
alter table public.gold_prices
  drop constraint if exists gold_prices_price_bounds_check;

alter table public.gold_prices
  add constraint gold_prices_price_bounds_check
  check (price >= 100 and price <= 2000);

