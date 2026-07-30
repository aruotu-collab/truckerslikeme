"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { liveActivities as seedActivities } from "@/lib/mock-data";
import { useAuthGate } from "@/lib/auth-gate";
import { createClient } from "@/lib/supabase/client";
import { readLastCorridor, writeLastCorridor } from "@/lib/corridor-store";
import {
  corridorFromSearch,
  rankFeed,
  type CorridorFocus,
  type RankedFeedItem,
} from "@/lib/intel/rank";
import { ReportIncidentModal } from "@/components/report-incident-modal";
import type { ActivityKind, LiveFeedItem } from "@/types";

const kindMeta: Record<ActivityKind, { label: string; tone: string }> = {
  parking: { label: "Parking", tone: "text-amber" },
  traffic: { label: "Traffic", tone: "text-alert" },
  fuel: { label: "Fuel", tone: "text-diesel" },
  delay: { label: "Delay", tone: "text-alert" },
  route: { label: "Route", tone: "text-sky-deep" },
  weather: { label: "Weather", tone: "text-sky-deep" },
  weigh: { label: "Weigh", tone: "text-sky-deep" },
  repair: { label: "Repair", tone: "text-diesel" },
};

type FeedFilter = "all" | "parking" | "fuel" | "traffic" | "weather" | "weigh" | "repair";

const filterChips: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "parking", label: "Parking" },
  { id: "fuel", label: "Fuel" },
  { id: "traffic", label: "Traffic" },
  { id: "weather", label: "Weather" },
  { id: "weigh", label: "Weigh" },
  { id: "repair", label: "Repair" },
];

function matchesFilter(item: LiveFeedItem, filter: FeedFilter) {
  if (filter === "all") return true;
  if (filter === "traffic") return item.kind === "traffic" || item.kind === "delay";
  return item.kind === filter;
}

const sourceLabel: Record<string, string> = {
  drivers: "Driver report",
  nws: "National Weather Service",
  eia: "EIA diesel",
  seed: "Corridor intel",
  system: "System",
};

const severityTone = {
  critical: "border-alert text-alert",
  watch: "border-amber text-amber",
  info: "border-sky-deep text-sky-deep",
} as const;

function seedFeed(): LiveFeedItem[] {
  return seedActivities.map((item) => ({
    ...item,
    source: "seed",
    updatedAt: new Date(Date.now() - item.minutesAgo * 60_000).toISOString(),
  }));
}

function timeLabel(minutesAgo: number) {
  if (minutesAgo <= 0) return "Just now";
  if (minutesAgo === 1) return "1m ago";
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  const hours = Math.floor(minutesAgo / 60);
  return `${hours}h ago`;
}

export function LiveActivity() {
  const { isSignedIn, openGate } = useAuthGate();
  const [items, setItems] = useState<LiveFeedItem[]>(seedFeed);
  const [reportOpen, setReportOpen] = useState(false);
  const [awaitingAuth, setAwaitingAuth] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<"connecting" | "live" | "polling">(
    "connecting",
  );
  const [corridor, setCorridor] = useState<CorridorFocus | null>(null);
  const [corridorOnly, setCorridorOnly] = useState(true);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [newCount, setNewCount] = useState(0);
  const knownIds = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  const refreshFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/intel/feed", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        items: LiveFeedItem[];
        updatedAt: string;
      };
      if (!data.items?.length) return;

      if (!primed.current) {
        knownIds.current = new Set(data.items.map((item) => item.id));
        primed.current = true;
        setNewCount(0);
      } else {
        const fresh = data.items.filter((item) => !knownIds.current.has(item.id));
        if (fresh.length) {
          setNewCount((count) => count + fresh.length);
          fresh.forEach((item) => knownIds.current.add(item.id));
        }
      }

      setItems(data.items);
      setUpdatedAt(data.updatedAt);
    } catch {
      // keep current items
    }
  }, []);

  useEffect(() => {
    const existing = readLastCorridor();
    if (existing) {
      setCorridor(existing);
    } else {
      const fallback = corridorFromSearch("Dallas, TX", "Chicago, IL");
      writeLastCorridor(fallback.origin, fallback.destination);
      setCorridor(fallback);
    }
    const onCorridor = (event: Event) => {
      const detail = (event as CustomEvent<CorridorFocus>).detail;
      setCorridor(detail);
      setCorridorOnly(true);
    };
    window.addEventListener("tlm:corridor", onCorridor);
    return () => window.removeEventListener("tlm:corridor", onCorridor);
  }, []);

  useEffect(() => {
    void refreshFeed();
    const poll = window.setInterval(() => {
      void refreshFeed();
      setLiveState((prev) => (prev === "live" ? prev : "polling"));
    }, 30_000);
    return () => window.clearInterval(poll);
  }, [refreshFeed]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLiveState("polling");
      return;
    }

    const channel = supabase
      .channel("live-intel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        () => {
          void refreshFeed();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_alerts" },
        () => {
          void refreshFeed();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLiveState("live");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setLiveState("polling");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshFeed]);

  useEffect(() => {
    if (isSignedIn && awaitingAuth) {
      setAwaitingAuth(false);
      setReportOpen(true);
    }
  }, [isSignedIn, awaitingAuth]);

  const ranked = useMemo(
    () => rankFeed(items, corridor, corridorOnly && Boolean(corridor)),
    [items, corridor, corridorOnly],
  );

  const filterCounts = useMemo(() => {
    const counts: Record<FeedFilter, number> = {
      all: ranked.length,
      parking: 0,
      fuel: 0,
      traffic: 0,
      weather: 0,
      weigh: 0,
      repair: 0,
    };
    for (const item of ranked) {
      if (item.kind === "parking") counts.parking += 1;
      if (item.kind === "fuel") counts.fuel += 1;
      if (item.kind === "traffic" || item.kind === "delay") counts.traffic += 1;
      if (item.kind === "weather") counts.weather += 1;
      if (item.kind === "weigh") counts.weigh += 1;
      if (item.kind === "repair") counts.repair += 1;
    }
    return counts;
  }, [ranked]);

  const filtered = useMemo(
    () => ranked.filter((item) => matchesFilter(item, feedFilter)),
    [ranked, feedFilter],
  );

  const hero: RankedFeedItem | null = filtered[0] ?? null;
  const rest = filtered.slice(1);

  const secondsAgo = updatedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000))
    : null;

  function handleReportClick() {
    if (!isSignedIn) {
      setAwaitingAuth(true);
      openGate("report-alert");
      return;
    }
    setReportOpen(true);
  }

  return (
    <section id="live" className="relative scroll-mt-8 py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2">
                <span className="animate-pulse-dot inline-block size-2.5 rounded-full bg-alert" />
                <span className="font-display text-sm tracking-[0.2em] text-muted uppercase">
                  Live activity
                </span>
              </span>
              <span className="text-[11px] tracking-wide text-muted uppercase">
                {liveState === "live"
                  ? "Realtime"
                  : liveState === "polling"
                    ? "Auto-refresh"
                    : "Connecting"}
                {secondsAgo != null
                  ? ` · updated ${secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`}`
                  : null}
              </span>
              {newCount > 0 && (
                <button
                  type="button"
                  onClick={() => setNewCount(0)}
                  className="text-[11px] font-semibold tracking-wide text-alert uppercase"
                >
                  {newCount} new since you opened
                </button>
              )}
            </div>
            <h2 className="font-display text-4xl tracking-wide text-asphalt uppercase sm:text-5xl">
              What&apos;s ahead on the haul
            </h2>
            <p className="mt-3 max-w-xl text-muted">
              Ranked by risk for drivers — tap a category when you need parking,
              fuel, weigh, or repair only.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReportClick}
            className="self-start rounded-sm bg-asphalt px-5 py-3 text-sm font-semibold tracking-wide text-white uppercase transition hover:bg-road sm:self-auto"
          >
            Report an incident
          </button>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {corridor ? (
            <>
              <p className="text-sm text-asphalt">
                Corridor:{" "}
                <span className="font-medium">
                  {corridor.origin} → {corridor.destination}
                </span>
              </p>
              <button
                type="button"
                onClick={() => setCorridorOnly(true)}
                className={`rounded-sm px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
                  corridorOnly
                    ? "bg-asphalt text-white"
                    : "border border-asphalt/15 text-muted hover:bg-concrete/50"
                }`}
              >
                On my corridor
              </button>
              <button
                type="button"
                onClick={() => setCorridorOnly(false)}
                className={`rounded-sm px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
                  !corridorOnly
                    ? "bg-asphalt text-white"
                    : "border border-asphalt/15 text-muted hover:bg-concrete/50"
                }`}
              >
                All intel
              </button>
            </>
          ) : (
            <a
              href="/plan"
              className="text-sm font-medium text-amber transition hover:text-asphalt"
            >
              Search a route to personalize this feed →
            </a>
          )}
        </div>

        <div
          className="mt-6 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Filter live feed by type"
        >
          {filterChips.map((chip) => {
            const active = feedFilter === chip.id;
            const count = filterCounts[chip.id];
            return (
              <button
                key={chip.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFeedFilter(chip.id)}
                className={`shrink-0 border-b-2 px-1 pb-2 text-sm font-semibold tracking-wide uppercase transition ${
                  active
                    ? "border-asphalt text-asphalt"
                    : "border-transparent text-muted hover:text-asphalt"
                }`}
              >
                {chip.label}
                <span className={`ml-1.5 text-xs font-normal ${active ? "text-amber" : "text-muted"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {hero && (
          <div className="animate-fade-in mt-8 border-l-4 border-alert bg-asphalt px-5 py-6 text-white sm:px-8 sm:py-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-display text-xs tracking-[0.2em] text-amber uppercase">
                {feedFilter === "all" ? "Top risk now" : `Top ${filterChips.find((c) => c.id === feedFilter)?.label ?? ""} now`}
              </span>
              <span
                className={`font-display text-xs tracking-[0.18em] uppercase ${
                  hero.severity === "critical"
                    ? "text-alert"
                    : hero.severity === "watch"
                      ? "text-amber-hot"
                      : "text-chrome"
                }`}
              >
                {hero.severity}
              </span>
              <span className="text-xs text-chrome">
                {sourceLabel[hero.source ?? ""] ?? hero.source}
              </span>
            </div>
            <p className="mt-3 font-display text-2xl leading-snug tracking-wide uppercase sm:text-3xl">
              {hero.message}
            </p>
            <p className="mt-2 text-chrome">{hero.location}</p>
            <p className="mt-4 text-sm text-amber-hot">{hero.action}</p>
            <p className="mt-3 text-xs text-chrome/80">
              {timeLabel(hero.minutesAgo)}
              {hero.onCorridor && corridor ? " · on your corridor" : null}
            </p>
          </div>
        )}

        <ul className="mt-10 divide-y divide-asphalt/10 border-y border-asphalt/10">
          {!hero && (
            <li className="py-8 text-muted">
              {feedFilter !== "all"
                ? `No ${filterChips.find((c) => c.id === feedFilter)?.label.toLowerCase()} intel right now — try All or another category.`
                : corridorOnly && corridor
                  ? "No corridor matches right now — switch to All intel or search another route."
                  : "Waiting for live intel…"}
            </li>
          )}
          {rest.map((item, index) => {
            const meta = kindMeta[item.kind];
            return (
              <li
                key={item.id}
                className="animate-slide-up grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:gap-8"
                style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`border-l-2 pl-2 font-display text-xs tracking-[0.18em] uppercase ${severityTone[item.severity]}`}
                    >
                      {item.severity}
                    </span>
                    <span
                      className={`font-display text-xs tracking-[0.18em] uppercase ${meta.tone}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[10px] tracking-wide text-muted uppercase">
                      {sourceLabel[item.source ?? ""] ?? item.source}
                    </span>
                    {item.onCorridor && corridor && (
                      <span className="text-[10px] tracking-wide text-diesel uppercase">
                        On corridor
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-lg text-asphalt sm:text-xl">
                    {item.message}
                  </p>
                  <p className="mt-1 text-sm text-muted">{item.location}</p>
                  <p className="mt-2 text-sm text-asphalt/80">{item.action}</p>
                </div>
                <time className="shrink-0 text-sm text-muted sm:text-right">
                  {timeLabel(item.minutesAgo)}
                </time>
              </li>
            );
          })}
        </ul>
      </div>

      <ReportIncidentModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmitted={(item) => {
          setItems((prev) => [
            { ...item, source: "drivers", updatedAt: new Date().toISOString() },
            ...prev,
          ]);
          knownIds.current.add(item.id);
          void refreshFeed();
        }}
      />
    </section>
  );
}
