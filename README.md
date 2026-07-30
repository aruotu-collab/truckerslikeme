# TruckersLikeMe

Live road intelligence for truck drivers — parking, fuel, delays, weather, and route tips. Browse without an account; sign up when you save, post, or ask AI.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind
- **Supabase** auth + Postgres + Realtime
- **NWS** weather alerts (free) + **EIA** diesel prices (API key)
- **Vercel Cron** hourly intel refresh
- Progressive auth (browse first, sign up on intent)

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Live auto-update setup

1. Run SQL in Supabase (in order):
   - `supabase/schema.sql`
   - `supabase/schema-intel.sql`
2. Supabase → **Project Settings → API** → copy **service_role** into `SUPABASE_SERVICE_ROLE_KEY` (Vercel + `.env.local`)
3. Create a long random `CRON_SECRET` and set it in Vercel (Production + Preview)
4. Optional but recommended: free [EIA API key](https://www.eia.gov/opendata/register.php) → `EIA_API_KEY`
5. Redeploy

### What updates automatically

| Source | Cadence | What truckers see |
|--------|---------|-------------------|
| Driver reports | Realtime + 30s poll | Live activity posts |
| NWS weather | Daily cron + on-demand if stale | Wind, winter, flood, storm alerts on TX/OK/MO/IL/KS/TN/AR |
| EIA diesel | Daily cron + on-demand if stale | U.S. / Midwest / Gulf Coast $/gal |
| Seed corridor intel | Always | Researched baseline stops/issues |

Manual cron test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://truckerslikeme.com/api/cron/refresh-live-intel
```

## Project layout

```
src/app/api/cron     # hourly live intel refresh
src/app/api/intel    # aggregated live feed
src/lib/intel        # NWS, EIA, feed builder
supabase/            # schema + intel tables
```

## Roadmap

| Phase | Focus |
|-------|--------|
| 1 (done) | Landing, progressive auth, members, reports |
| 2 (done) | Persist routes/alerts, researched seed data |
| 3 (now) | Live feed auto-refresh + NWS/EIA cron intel |
| Next | Mapbox map, real AI, Stripe Pro |

## Design

Highway asphalt / safety amber palette with Oswald + Barlow.
