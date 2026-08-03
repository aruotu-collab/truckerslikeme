-- TruckersLikeMe Money / Pro (run in Supabase SQL editor after schema.sql)

alter table public.profiles
  add column if not exists mpg numeric(4, 1) not null default 6.5,
  add column if not exists cost_per_mile numeric(6, 3) not null default 0.65,
  add column if not exists diesel_price_override numeric(6, 3),
  add column if not exists analyses_used integer not null default 0,
  add column if not exists analyses_reset_at timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create table if not exists public.load_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  origin text,
  destination text,
  miles integer not null,
  rate_total numeric(12, 2) not null,
  rate_per_mile numeric(8, 3),
  diesel_price numeric(6, 3),
  mpg numeric(4, 1),
  cost_per_mile numeric(6, 3),
  fuel_cost numeric(12, 2),
  operating_cost numeric(12, 2),
  net_profit numeric(12, 2),
  net_per_mile numeric(8, 3),
  score text not null,
  raw_input text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists load_analyses_user_created_idx
  on public.load_analyses (user_id, created_at desc);

alter table public.load_analyses enable row level security;

drop policy if exists "Users read own load analyses" on public.load_analyses;
create policy "Users read own load analyses"
  on public.load_analyses for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own load analyses" on public.load_analyses;
create policy "Users insert own load analyses"
  on public.load_analyses for insert
  with check (auth.uid() = user_id);

-- Service role (Stripe webhook, API) can write any row; clients use policies above.
