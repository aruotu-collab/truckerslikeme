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

  const [
    membersRes,
    alertsRes,
    routesRes,
    visits24Res,
    visits7Res,
    recentAlertsRes,
    recentRoutesRes,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, display_name, email, role, plan, created_at, ai_queries_used")
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("alerts").select("id", { count: "exact", head: true }),
    admin.from("saved_routes").select("id", { count: "exact", head: true }),
    admin
      .from("page_visits")
      .select("id", { count: "exact", head: true })
      .gte("visited_at", since24h),
    admin
      .from("page_visits")
      .select("id", { count: "exact", head: true })
      .gte("visited_at", since7d),
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
  ]);

  return NextResponse.json({
    stats: {
      members: membersRes.data?.length ?? 0,
      alerts: alertsRes.count ?? 0,
      savedRoutes: routesRes.count ?? 0,
      visits24h: visits24Res.count ?? 0,
      visits7d: visits7Res.count ?? 0,
    },
    members: membersRes.data ?? [],
    recentAlerts: recentAlertsRes.data ?? [],
    recentRoutes: recentRoutesRes.data ?? [],
    errors: {
      members: membersRes.error?.message ?? null,
      visits: visits24Res.error?.message ?? null,
    },
  });
}
