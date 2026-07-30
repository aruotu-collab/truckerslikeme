import { NextResponse } from "next/server";
import { buildLiveFeed } from "@/lib/intel/feed";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshLiveIntel } from "@/lib/intel/refresh";

export const dynamic = "force-dynamic";

const STALE_MS = 45 * 60 * 1000;

async function maybeRefreshStaleIntel() {
  const admin = createAdminClient();
  if (!admin) return;

  const { data } = await admin
    .from("system_alerts")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const last = data?.updated_at ? new Date(data.updated_at).getTime() : 0;
  if (Date.now() - last < STALE_MS) return;

  // Fire-and-forget so the feed stays fast
  void refreshLiveIntel();
}

export async function GET() {
  try {
    void maybeRefreshStaleIntel();
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
