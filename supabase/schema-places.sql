-- TruckersLikeMe places / Find (run in Supabase SQL editor)

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'parking',
  address text,
  area text,
  country text,
  lat double precision,
  lng double precision,
  truck_types text[] not null default '{}',
  overnight boolean,
  security boolean,
  phone text,
  price_note text,
  source text not null default 'web',
  confidence text not null default 'web_found',
  confirm_yes integer not null default 0,
  confirm_no integer not null default 0,
  last_confirmed_at timestamptz,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists places_area_kind_idx on public.places (area, kind);
create index if not exists places_confidence_idx on public.places (confidence);

create table if not exists public.place_feedback (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  did_park boolean not null,
  overnight boolean,
  security boolean,
  price_note text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists place_feedback_place_idx
  on public.place_feedback (place_id, created_at desc);

alter table public.places enable row level security;
alter table public.place_feedback enable row level security;

drop policy if exists "Public read places" on public.places;
create policy "Public read places"
  on public.places for select
  using (true);

drop policy if exists "Users insert place feedback" on public.place_feedback;
create policy "Users insert place feedback"
  on public.place_feedback for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users read own place feedback" on public.place_feedback;
create policy "Users read own place feedback"
  on public.place_feedback for select
  using (auth.uid() = user_id);
