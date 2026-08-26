-- Admin role for TruckersLikeMe (run in Supabase SQL editor)
-- Promotes aruotu@gmail.com to admin + Pro.
-- Self-contained: bootstraps profiles + page_visits even on partial databases.

do $$ begin
  create type public.plan_tier as enum ('free', 'pro');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.user_role as enum ('driver', 'admin');
exception
  when duplicate_object then null;
end $$;

-- Minimal profiles table if missing entirely
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text,
  role public.user_role not null default 'driver',
  plan public.plan_tier not null default 'free',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Backfill columns on older / partial profiles tables
alter table public.profiles
  add column if not exists display_name text;

alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  add column if not exists plan public.plan_tier not null default 'free';

alter table public.profiles
  add column if not exists role public.user_role not null default 'driver';

alter table public.profiles
  add column if not exists ai_queries_used integer not null default 0;

alter table public.profiles
  add column if not exists mpg numeric(4, 1) not null default 6.5;

alter table public.profiles
  add column if not exists cost_per_mile numeric(6, 3) not null default 0.65;

alter table public.profiles
  add column if not exists diesel_price_override numeric(6, 3);

alter table public.profiles
  add column if not exists analyses_used integer not null default 0;

alter table public.profiles
  add column if not exists analyses_reset_at timestamptz;

alter table public.profiles
  add column if not exists stripe_customer_id text;

alter table public.profiles
  add column if not exists stripe_subscription_id text;

alter table public.profiles
  add column if not exists created_at timestamptz not null default now();

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- Keep email on profile for admin member lists
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, role, plan)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email,
    case when lower(new.email) = 'aruotu@gmail.com' then 'admin'::public.user_role else 'driver'::public.user_role end,
    case when lower(new.email) = 'aruotu@gmail.com' then 'pro'::public.plan_tier else 'free'::public.plan_tier end
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name);
  return new;
end;
$$;

-- Backfill emails from auth.users
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');

-- Promote your admin account
update public.profiles p
set
  role = 'admin',
  plan = 'pro',
  email = coalesce(p.email, u.email)
from auth.users u
where p.id = u.id
  and lower(u.email) = 'aruotu@gmail.com';

-- If profile row is missing for that user, create it
insert into public.profiles (id, display_name, email, role, plan)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)),
  u.email,
  'admin',
  'pro'
from auth.users u
where lower(u.email) = 'aruotu@gmail.com'
on conflict (id) do update set
  role = 'admin',
  plan = 'pro',
  email = excluded.email;

-- Admins can read all profiles (member management)
drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

drop policy if exists "Admins update all profiles" on public.profiles;
create policy "Admins update all profiles"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

-- Soft page-visit counter for admin (no PII)
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
