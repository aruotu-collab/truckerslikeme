-- TruckersLikeMe analytics (run in Supabase SQL editor)
-- Self-contained: creates page_visits if missing, then analytics tables + helpers.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE).

-- Base visit log (from schema-admin.sql — included here so analytics works standalone)
create table if not exists public.page_visits (
  id bigserial primary key,
  path text not null,
  visited_at timestamptz not null default now()
);

alter table public.page_visits enable row level security;

drop policy if exists "Anyone can insert page visits" on public.page_visits;
create policy "Anyone can insert page visits"
  on public.page_visits for insert
  with check (true);

drop policy if exists "Admins read page visits" on public.page_visits;
create policy "Admins read page visits"
  on public.page_visits for select
  using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

create index if not exists page_visits_visited_at_idx on public.page_visits (visited_at desc);
create index if not exists page_visits_path_idx on public.page_visits (path);

-- Extend page visits with country, member, referrer, hashed IPalter table public.page_visits
  add column if not exists country text,
  add column if not exists user_id uuid references public.profiles (id) on delete set null,
  add column if not exists referrer text,
  add column if not exists ip_hash text;

create index if not exists page_visits_country_idx on public.page_visits (country);
create index if not exists page_visits_user_idx on public.page_visits (user_id);
create index if not exists page_visits_ip_hash_idx on public.page_visits (ip_hash);

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- Click events
create table if not exists public.click_events (
  id bigserial primary key,
  event_name text not null,
  label text not null,
  path text not null,
  country text,
  user_id uuid references public.profiles (id) on delete set null,
  referrer text,
  ip_hash text,
  clicked_at timestamptz not null default now()
);

alter table public.click_events enable row level security;

drop policy if exists "Anyone can insert click events" on public.click_events;
create policy "Anyone can insert click events"
  on public.click_events for insert
  with check (true);

drop policy if exists "Admins read click events" on public.click_events;
create policy "Admins read click events"
  on public.click_events for select
  using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

create index if not exists click_events_clicked_at_idx
  on public.click_events (clicked_at desc);
create index if not exists click_events_event_idx
  on public.click_events (event_name, clicked_at desc);

-- Admin analytics helpers (service role / security definer)
create or replace function public.admin_top_pages(since_ts timestamptz, row_limit int default 20)
returns table(path text, visit_count bigint)
language sql
security definer
set search_path = public
as $$
  select path, count(*)::bigint as visit_count
  from public.page_visits
  where visited_at >= since_ts
  group by path
  order by visit_count desc
  limit row_limit;
$$;

create or replace function public.admin_top_countries(since_ts timestamptz, row_limit int default 20)
returns table(country text, visit_count bigint)
language sql
security definer
set search_path = public
as $$
  select coalesce(country, '??') as country, count(*)::bigint as visit_count
  from public.page_visits
  where visited_at >= since_ts
  group by coalesce(country, '??')
  order by visit_count desc
  limit row_limit;
$$;

create or replace function public.admin_top_clicks(since_ts timestamptz, row_limit int default 30)
returns table(event_name text, label text, click_count bigint)
language sql
security definer
set search_path = public
as $$
  select event_name, label, count(*)::bigint as click_count
  from public.click_events
  where clicked_at >= since_ts
  group by event_name, label
  order by click_count desc
  limit row_limit;
$$;

create or replace function public.admin_visit_split(since_ts timestamptz)
returns table(member_visits bigint, guest_visits bigint)
language sql
security definer
set search_path = public
as $$
  select
    count(*) filter (where user_id is not null)::bigint as member_visits,
    count(*) filter (where user_id is null)::bigint as guest_visits
  from public.page_visits
  where visited_at >= since_ts;
$$;
