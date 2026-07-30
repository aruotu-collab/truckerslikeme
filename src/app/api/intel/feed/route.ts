import { NextResponse } from "next/server";
import { buildLiveFeed } from "@/lib/intel/feed";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshLiveIntel } from "@/lib/intel/refresh";

export const dynamic = "force-dynamic";

const STALE_MS = 45 * 60 * 1000;

async function maybeRefreshStaleIntel() {
  const admin = createAdminClient();
  if (!admin) return;

  // Always try diesel refresh when the last EIA attempt was an error placeholder
  const [{ data: latestAlert }, { data: latestFuel }, { data: eiaError }] =
    await Promise.all([
      admin
        .from("system_alerts")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("fuel_snapshots")
        .select("fetched_at")
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("system_alerts")
        .select("id")
        .eq("external_id", "eia-diesel-error")
        .maybeSingle(),
    ]);

  const lastAlert = latestAlert?.updated_at
    ? new Date(latestAlert.updated_at).getTime()
    : 0;
  const lastFuel = latestFuel?.fetched_at
    ? new Date(latestFuel.fetched_at).getTime()
    : 0;
  const last = Math.max(lastAlert, lastFuel);
  const missingFuel = !latestFuel;
  const stale = Date.now() - last >= STALE_MS;
  const retryEia = Boolean(eiaError);

  if (!stale && !missingFuel && !retryEia) return;

  if (missingFuel || retryEia) {
    await refreshLiveIntel();
    return;
  }

  void refreshLiveIntel();
}

export async function GET() {
  try {
    await maybeRefreshStaleIntel();
    const feed = await buildLiveFeed();
    return NextResponse.json(feed, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        items: [],
        updatedAt: new Date().toISOString(),
        sources: [],
        error: err instanceof Error ? err.message : "Feed failed",
      },
      { status: 500 },
    );
  }
}
