import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Service role key missing on server." },
      { status: 500 },
    );
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    membersCountRes,
    membersRes,
    alertsCountRes,
    routesCountRes,
    analysesCountRes,
    placesCountRes,
    feedbackCountRes,
    visits24Res,
    visits7Res,
    visits30Res,
    clicks7Res,
    recentAlertsRes,
    recentRoutesRes,
    recentAnalysesRes,
    recentFeedbackRes,
    recentVisitsRes,
    topPagesRes,
    topCountriesRes,
    topClicksRes,
    visitSplitRes,
    fuelLatestRes,
    intelLatestRes,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select(
        "id, display_name, email, role, plan, created_at, ai_queries_used, analyses_used, last_seen_at",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("alerts").select("id", { count: "exact", head: true }),
    admin.from("saved_routes").select("id", { count: "exact", head: true }),
    admin.from("load_analyses").select("id", { count: "exact", head: true }),
    admin.from("places").select("id", { count: "exact", head: true }),
    admin.from("place_feedback").select("id", { count: "exact", head: true }),
    admin
      .from("page_visits")
      .select("id", { count: "exact", head: true })
      .gte("visited_at", since24h),
    admin
      .from("page_visits")
      .select("id", { count: "exact", head: true })
      .gte("visited_at", since7d),
    admin
      .from("page_visits")
      .select("id", { count: "exact", head: true })
      .gte("visited_at", since30d),
    admin
      .from("click_events")
      .select("id", { count: "exact", head: true })
      .gte("clicked_at", since7d),
    admin
      .from("alerts")
      .select("id, kind, message, location, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("saved_routes")
      .select("id, origin, destination, miles, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("load_analyses")
      .select(
        "id, origin, destination, miles, rate_total, net_profit, score, created_at, user_id",
      )
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("place_feedback")
      .select("id, place_id, did_park, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("page_visits")
      .select(
        "id, path, country, ip_hash, referrer, visited_at, user_id, profiles(email, display_name)",
      )
      .order("visited_at", { ascending: false })
      .limit(50),
    admin.rpc("admin_top_pages", { since_ts: since7d, row_limit: 20 }),
    admin.rpc("admin_top_countries", { since_ts: since7d, row_limit: 20 }),
    admin.rpc("admin_top_clicks", { since_ts: since7d, row_limit: 30 }),
    admin.rpc("admin_visit_split", { since_ts: since7d }),
    admin
      .from("fuel_snapshots")
      .select("region, price_usd, fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(1),
    admin
      .from("system_alerts")
      .select("kind, message, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1),
  ]);

  const visitSplitRow = visitSplitRes.data?.[0] as
    | { member_visits: number; guest_visits: number }
    | undefined;

  const recentVisits = (recentVisitsRes.data ?? []).map((row) => {
    const profile = row.profiles as
      | { email: string | null; display_name: string | null }
      | { email: string | null; display_name: string | null }[]
      | null;
    const p = Array.isArray(profile) ? profile[0] : profile;
    return {
      id: row.id,
      path: row.path,
      country: row.country,
      ip_hash: row.ip_hash,
      referrer: row.referrer,
      visited_at: row.visited_at,
      user_id: row.user_id,
      email: p?.email ?? null,
      display_name: p?.display_name ?? null,
    };
  });

  return NextResponse.json({
    stats: {
      members: membersCountRes.count ?? 0,
      alerts: alertsCountRes.count ?? 0,
      savedRoutes: routesCountRes.count ?? 0,
      loadAnalyses: analysesCountRes.count ?? 0,
      places: placesCountRes.count ?? 0,
      placeFeedback: feedbackCountRes.count ?? 0,
      visits24h: visits24Res.count ?? 0,
      visits7d: visits7Res.count ?? 0,
      visits30d: visits30Res.count ?? 0,
      clicks7d: clicks7Res.count ?? 0,
      memberVisits7d: visitSplitRow?.member_visits ?? 0,
      guestVisits7d: visitSplitRow?.guest_visits ?? 0,
    },
    topPages: topPagesRes.data ?? [],
    topCountries: topCountriesRes.data ?? [],
    topClicks: topClicksRes.data ?? [],
    recentVisits,
    members: membersRes.data ?? [],
    recentAlerts: recentAlertsRes.data ?? [],
    recentRoutes: recentRoutesRes.data ?? [],
    recentAnalyses: recentAnalysesRes.data ?? [],
    recentFeedback: recentFeedbackRes.data ?? [],
    ops: {
      fuelLatest: fuelLatestRes.data?.[0] ?? null,
      intelLatest: intelLatestRes.data?.[0] ?? null,
    },
    errors: {
      members: membersRes.error?.message ?? null,
      visits: visits24Res.error?.message ?? null,
      analytics:
        topPagesRes.error?.message ??
        topCountriesRes.error?.message ??
        topClicksRes.error?.message ??
        visitSplitRes.error?.message ??
        null,
    },
  });
}
