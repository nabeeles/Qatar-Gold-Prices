-- Create Price Alerts Table
create table price_alerts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  karat integer not null check (karat in (24, 22, 21, 18)),
  target_price decimal(10, 2) not null,
  condition text not null check (condition in ('above', 'below')),
  expo_push_token text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Enable RLS
alter table price_alerts enable row level security;

-- RLS Policies
-- Users can manage their own alerts (for authenticated users)
create policy "Users can manage their own alerts"
  on price_alerts for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Allow inserting alerts without user_id (for anonymous or service-led tests)
create policy "Allow anonymous alert insertion"
  on price_alerts for insert
  to anon, authenticated
  with check (true);

-- Unique constraint to prevent duplicate identical alerts for the same token/target
alter table price_alerts add constraint unique_user_alert unique (user_id, karat, condition, target_price, expo_push_token);
