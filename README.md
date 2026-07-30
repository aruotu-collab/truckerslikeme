# TruckersLikeMe

Live road intelligence for truck drivers — parking, fuel, delays, and route tips. Browse without an account; sign up when you save, post, or ask AI.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind
- **Supabase** for auth + Postgres (keys optional for local demo)
- Progressive auth gate (demo mode works without Supabase)
- Stripe / Mapbox / OpenAI stubs for later phases

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### What you can try now

1. Browse **Live activity** with no login
2. **Search a route** (Dallas → Chicago sample)
3. Click **Ask AI once** (one free guest tip)
4. Click **Save this route** or **Report an incident** → auth gate
5. Use **Continue with demo account** to unlock gated actions

## Connect Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy `.env.example` → `.env.local` and fill in URL + anon key
3. Run `supabase/schema.sql` in the Supabase SQL editor
4. Enable Email auth (or Google) in Authentication → Providers

Until keys are set, the app uses a local demo sign-in so you can ship UI without a backend.

## Project layout

```
src/app              # pages + global styles
src/components       # hero, live feed, route planner, auth modal
src/lib              # mock data, auth gate, supabase clients
supabase/schema.sql  # Phase 1 tables + RLS
```

## Roadmap

| Phase | Focus |
|-------|--------|
| 1 (done) | Landing, live intel, route shell, progressive auth |
| 2 | Real alerts + truck stops in Supabase, Mapbox map |
| 3 | Real AI + Stripe Pro (£24–39/mo) |
| 4 | Saved routes, notifications, reviews |

## Design

Highway asphalt / safety amber palette with Oswald + Barlow. Full-bleed hero, live feed below the fold, no login wall on first paint.
