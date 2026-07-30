import type { ActivityKind, LiveActivity, LiveFeedItem } from "@/types";
import { liveActivities as seedActivities } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";

function minutesAgo(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function mapKind(kind: string): ActivityKind {
  const allowed: ActivityKind[] = [
    "parking",
    "traffic",
    "fuel",
    "delay",
    "route",
    "weather",
  ];
  return (allowed.includes(kind as ActivityKind) ? kind : "route") as ActivityKind;
}

export async function buildLiveFeed(): Promise<{
  items: LiveFeedItem[];
  updatedAt: string;
  sources: string[];
}> {
  const supabase = await createClient();
  const sources = new Set<string>(["seed"]);
  const remote: LiveFeedItem[] = [];

  if (supabase) {
    const [{ data: alerts }, { data: system }, { data: fuels }] =
      await Promise.all([
        supabase
          .from("alerts")
          .select("id, kind, message, location, created_at")
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("system_alerts")
          .select(
            "id, kind, message, location, source, severity, updated_at, created_at",
          )
          .order("updated_at", { ascending: false })
          .limit(40),
        supabase
          .from("fuel_snapshots")
          .select("region, region_code, price_usd, period, fetched_at")
          .order("fetched_at", { ascending: false })
          .limit(6),
      ]);

    for (const row of alerts ?? []) {
      sources.add("drivers");
      remote.push({
        id: row.id,
        kind: mapKind(row.kind),
        message: row.message,
        location: row.location,
        minutesAgo: minutesAgo(row.created_at),
        source: "drivers",
        updatedAt: row.created_at,
      });
    }

    for (const row of system ?? []) {
      sources.add(row.source || "system");
      const stamp = row.updated_at || row.created_at;
      remote.push({
        id: row.id,
        kind: mapKind(row.kind),
        message: row.message,
        location: row.location,
        minutesAgo: minutesAgo(stamp),
        source: row.source || "system",
        updatedAt: stamp,
      });
    }

    const seenFuelRegions = new Set<string>();
    for (const fuel of fuels ?? []) {
      if (seenFuelRegions.has(fuel.region_code)) continue;
      seenFuelRegions.add(fuel.region_code);
      sources.add("eia");
      remote.push({
        id: `fuel-${fuel.region_code}-${fuel.period}`,
        kind: "fuel",
        message: `${fuel.region}: $${Number(fuel.price_usd).toFixed(3)}/gal diesel (EIA ${fuel.period})`,
        location: "On-highway diesel",
        minutesAgo: minutesAgo(fuel.fetched_at),
        source: "eia",
        updatedAt: fuel.fetched_at,
      });
    }
  }

  const seed: LiveFeedItem[] = seedActivities.map((item: LiveActivity) => ({
    ...item,
    source: "seed",
    updatedAt: new Date(Date.now() - item.minutesAgo * 60_000).toISOString(),
  }));

  const merged = [...remote, ...seed].sort(
    (a, b) => a.minutesAgo - b.minutesAgo,
  );

  const seen = new Set<string>();
  const items: LiveFeedItem[] = [];
  for (const item of merged) {
    const key = `${item.source}:${item.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    if (items.length >= 40) break;
  }

  return {
    items,
    updatedAt: new Date().toISOString(),
    sources: [...sources],
  };
}
