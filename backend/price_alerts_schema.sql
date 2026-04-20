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

comment on table price_alerts is 'User-defined notifications registry for gold price thresholds.';
comment on column price_alerts.user_id is 'Owner of the alert; supports both anonymous and permanent authenticated sessions.';
comment on column price_alerts.target_price is 'The threshold price in QAR that triggers the notification.';
comment on column price_alerts.condition is 'Trigger logic: above (market rose) or below (market fell).';
comment on column price_alerts.expo_push_token is 'Encrypted/Masked device identifier for push notification delivery.';
comment on column price_alerts.is_active is 'Operational flag to prevent redundant notifications after an alert has triggered.';

-- Enable RLS
alter table price_alerts enable row level security;

-- RLS Policies
-- Users can manage their own alerts (for authenticated users and anonymous sign-ins)
create policy "Users can manage their own alerts"
  on price_alerts for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Unique constraint to prevent duplicate identical alerts for the same token/target
alter table price_alerts add constraint unique_user_alert unique (user_id, karat, condition, target_price, expo_push_token);
