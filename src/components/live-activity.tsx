"use client";

import { useCallback, useEffect, useState } from "react";
import { liveActivities as seedActivities } from "@/lib/mock-data";
import { useAuthGate } from "@/lib/auth-gate";
import { createClient } from "@/lib/supabase/client";
import { ReportIncidentModal } from "@/components/report-incident-modal";
import type { ActivityKind, LiveFeedItem } from "@/types";

const kindMeta: Record<ActivityKind, { label: string; tone: string }> = {
  parking: { label: "Parking", tone: "text-amber" },
  traffic: { label: "Traffic", tone: "text-alert" },
  fuel: { label: "Fuel", tone: "text-diesel" },
  delay: { label: "Delay", tone: "text-alert" },
  route: { label: "Route", tone: "text-sky-deep" },
  weather: { label: "Weather", tone: "text-sky-deep" },
};

const sourceLabel: Record<string, string> = {
  drivers: "Driver",
  nws: "NWS",
  eia: "EIA",
  seed: "Corridor",
  system: "System",
};

function seedFeed(): LiveFeedItem[] {
  return seedActivities.map((item) => ({
    ...item,
    source: "seed",
    updatedAt: new Date(Date.now() - item.minutesAgo * 60_000).toISOString(),
  }));
}

export function LiveActivity() {
  const { isSignedIn, openGate } = useAuthGate();
  const [items, setItems] = useState<LiveFeedItem[]>(seedFeed);
  const [reportOpen, setReportOpen] = useState(false);
  const [awaitingAuth, setAwaitingAuth] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>(["seed"]);
  const [liveState, setLiveState] = useState<"connecting" | "live" | "polling">(
    "connecting",
  );

  const refreshFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/intel/feed", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        items: LiveFeedItem[];
        updatedAt: string;
        sources: string[];
      };
      if (data.items?.length) {
        setItems(data.items);
        setUpdatedAt(data.updatedAt);
        setSources(data.sources ?? []);
      }
    } catch {
      // keep current items
    }
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

  function handleReportClick() {
    if (!isSignedIn) {
      setAwaitingAuth(true);
      openGate("report-alert");
      return;
    }
    setReportOpen(true);
  }

  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

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
              <span className="rounded-sm border border-asphalt/10 bg-white/70 px-2 py-0.5 text-[11px] tracking-wide text-muted uppercase">
                {liveState === "live"
                  ? "Realtime on"
                  : liveState === "polling"
                    ? "Auto-refresh 30s"
                    : "Connecting…"}
              </span>
              {updatedLabel && (
                <span className="text-[11px] text-muted">
                  Updated {updatedLabel}
                </span>
              )}
            </div>
            <h2 className="font-display text-4xl tracking-wide text-asphalt uppercase sm:text-5xl">
              What drivers are seeing now
            </h2>
            <p className="mt-3 max-w-xl text-muted">
              Driver reports, NWS corridor weather, and EIA diesel — refreshing
              automatically.
              {sources.length > 1
                ? ` Sources: ${sources
                    .map((s) => sourceLabel[s] ?? s)
                    .join(", ")}.`
                : null}
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

        <ul className="mt-12 divide-y divide-asphalt/10 border-y border-asphalt/10">
          {items.map((item, index) => {
            const meta = kindMeta[item.kind];
            return (
              <li
                key={item.id}
                className="animate-slide-up flex flex-col gap-2 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
                style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-display text-xs tracking-[0.18em] uppercase ${meta.tone}`}
                    >
                      {meta.label}
                    </span>
                    {item.source && (
                      <span className="text-[10px] tracking-wide text-muted uppercase">
                        {sourceLabel[item.source] ?? item.source}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-lg text-asphalt sm:text-xl">
                    {item.message}
                  </p>
                  <p className="mt-1 text-sm text-muted">{item.location}</p>
                </div>
                <time className="shrink-0 text-sm text-muted">
                  {item.minutesAgo === 0
                    ? "Just now"
                    : `${item.minutesAgo}m ago`}
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
          void refreshFeed();
        }}
      />
    </section>
  );
}
