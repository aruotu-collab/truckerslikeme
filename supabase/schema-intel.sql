-- TruckersLikeMe live intel tables (run after schema.sql)

create table if not exists public.fuel_snapshots (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  region_code text not null,
  price_usd numeric(6, 3) not null,
  period text,
  source text not null default 'eia',
  fetched_at timestamptz not null default now(),
  unique (region_code, period)
);

create table if not exists public.system_alerts (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  kind public.activity_kind not null,
  message text not null,
  location text not null,
  source text not null,
  severity text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists system_alerts_updated_idx
  on public.system_alerts (updated_at desc);

create index if not exists fuel_snapshots_fetched_idx
  on public.fuel_snapshots (fetched_at desc);

alter table public.fuel_snapshots enable row level security;
alter table public.system_alerts enable row level security;

drop policy if exists "Public can read fuel snapshots" on public.fuel_snapshots;
create policy "Public can read fuel snapshots"
  on public.fuel_snapshots for select using (true);

drop policy if exists "Public can read system alerts" on public.system_alerts;
create policy "Public can read system alerts"
  on public.system_alerts for select using (true);

-- Realtime (run in SQL editor; ignore error if already added)
alter publication supabase_realtime add table public.alerts;
alter publication supabase_realtime add table public.system_alerts;
