-- TruckersLikeMe Phase 1 schema (run in Supabase SQL editor)

create extension if not exists "pgcrypto";

create type public.plan_tier as enum ('free', 'pro');
create type public.activity_kind as enum (
  'parking',
  'traffic',
  'fuel',
  'delay',
  'route',
  'weather',
  'weigh',
  'repair'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  plan public.plan_tier not null default 'free',
  ai_queries_used integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  kind public.activity_kind not null,
  message text not null,
  location text not null,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create table public.truck_stops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  lat double precision not null,
  lng double precision not null,
  amenities text[] not null default '{}',
  diesel_price numeric(6, 3),
  parking_spaces integer,
  parking_available integer,
  created_at timestamptz not null default now()
);

create table public.saved_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  origin text not null,
  destination text not null,
  miles integer,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  stop_id uuid not null references public.truck_stops (id) on delete cascade,
  parking smallint check (parking between 1 and 5),
  food smallint check (food between 1 and 5),
  showers smallint check (showers between 1 and 5),
  security smallint check (security between 1 and 5),
  wifi smallint check (wifi between 1 and 5),
  body text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.alerts enable row level security;
alter table public.truck_stops enable row level security;
alter table public.saved_routes enable row level security;
alter table public.reviews enable row level security;

create policy "Public can read alerts"
  on public.alerts for select using (true);

create policy "Signed-in users can insert alerts"
  on public.alerts for insert
  with check (auth.uid() = user_id);

create policy "Public can read truck stops"
  on public.truck_stops for select using (true);

create policy "Users read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Backfill profiles for people who already signed up before this schema ran
insert into public.profiles (id, display_name)
select
  id,
  coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

create policy "Users manage own saved routes"
  on public.saved_routes for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Public can read reviews"
  on public.reviews for select using (true);

create policy "Users insert own reviews"
  on public.reviews for insert with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
