"use client";

import { useEffect, useMemo, useState } from "react";
import { citySuggestions, sampleRoute } from "@/lib/mock-data";
import { getCorridorSupport } from "@/lib/corridor-support";
import { useAuthGate } from "@/lib/auth-gate";
import { saveRoute } from "@/lib/supabase/data";
import { writeLastCorridor } from "@/lib/corridor-store";
import { RouteMap } from "@/components/route-map";
import { HScroll } from "@/components/h-scroll";
import { CorridorIntelMap } from "@/components/corridor-intel-map";
import { corridorFromSearch } from "@/lib/intel/rank";
import { liveActivities } from "@/lib/mock-data";
import type { PlannedRoute } from "@/types";
import type { LiveFeedItem } from "@/types";

const seedFeedItems: LiveFeedItem[] = liveActivities.map((item) => ({
  ...item,
  source: "seed",
  updatedAt: new Date(Date.now() - item.minutesAgo * 60_000).toISOString(),
}));

type PlanFilter = "all" | "parking" | "fuel" | "repair" | "lodging" | "weigh";

const planFilterChips: { id: PlanFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "parking", label: "Parking" },
  { id: "fuel", label: "Fuel" },
  { id: "repair", label: "Repair" },
  { id: "lodging", label: "Lodging" },
  { id: "weigh", label: "Weigh" },
];

const serviceLabel: Record<Exclude<PlanFilter, "all">, string> = {
  parking: "Parking",
  fuel: "Fuel",
  repair: "Truck repair",
  lodging: "Truck lodging",
  weigh: "Weigh",
};

type PlanService = {
  id: string;
  kind: Exclude<PlanFilter, "all">;
  name: string;
  detail: string;
  mile: number;
};

export function RoutePlanner() {
  const { isSignedIn, isAdmin, isPro, user, openGate } = useAuthGate();
  const [origin, setOrigin] = useState("Dallas, TX");
  const [destination, setDestination] = useState("Chicago, IL");
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [aiUsed, setAiUsed] = useState(false);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [awaitingAuthToSave, setAwaitingAuthToSave] = useState(false);
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");

  const canSearch = origin.trim() && destination.trim();

  const statusCounts = useMemo(() => {
    if (!route) return null;
    return {
      fuel: route.stops.filter((s) => s.type === "fuel").length,
      parking: route.stops.filter((s) => s.type === "parking").length,
      alerts: route.stops.filter((s) => s.type === "alert").length,
    };
  }, [route]);

  const support = useMemo(() => {
    if (!route) return null;
    return getCorridorSupport(route.origin, route.destination);
  }, [route]);

  const services = useMemo((): PlanService[] => {
    if (!route) return [];
    const fromSupport: PlanService[] = (support?.places ?? []).map((place) => ({
      id: `support-${place.id}`,
      kind: place.kind,
      name: place.name,
      detail: place.detail,
      mile: place.mile,
    }));
    const fromStops: PlanService[] = route.stops
      .filter((stop) => stop.type === "fuel" || stop.type === "weigh" || stop.type === "parking")
      .map((stop) => ({
        id: `stop-${stop.id}`,
        kind: stop.type as "fuel" | "weigh" | "parking",
        name: stop.label,
        detail: stop.detail,
        mile: stop.mile,
      }));

    const merged = [...fromSupport, ...fromStops];
    const seen = new Set<string>();
    return merged
      .filter((item) => {
        const key = `${item.kind}:${Math.round(item.mile / 8)}:${item.name.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.mile - b.mile);
  }, [route, support]);

  const filterCounts = useMemo(() => {
    const counts: Record<PlanFilter, number> = {
      all: services.length,
      parking: 0,
      fuel: 0,
      repair: 0,
      lodging: 0,
      weigh: 0,
    };
    for (const item of services) counts[item.kind] += 1;
    return counts;
  }, [services]);

  const filteredServices = useMemo(() => {
    if (planFilter === "all") return services;
    return services.filter((item) => item.kind === planFilter);
  }, [services, planFilter]);

  useEffect(() => {
    if (isSignedIn && awaitingAuthToSave && route && user) {
      setAwaitingAuthToSave(false);
      void persistRoute(route);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, awaitingAuthToSave, route, user]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!canSearch) return;
    const nextOrigin = origin.trim();
    const nextDestination = destination.trim();
    setRoute({
      ...sampleRoute,
      origin: nextOrigin,
      destination: nextDestination,
    });
    writeLastCorridor(nextOrigin, nextDestination);
    setAiReply(null);
    setSaved(false);
    setSaveError(null);
    setPlanFilter("all");
  }

  async function persistRoute(planned: PlannedRoute) {
    if (!user) return;
    setSaveBusy(true);
    setSaveError(null);
    const { error } = await saveRoute({ user, route: planned });
    setSaveBusy(false);
    if (error) {
      setSaveError(error);
      setSaved(false);
      return;
    }
    setSaved(true);
  }

  function handleSave() {
    if (!route) return;
    if (!isSignedIn) {
      setAwaitingAuthToSave(true);
      openGate("save-route");
      return;
    }
    void persistRoute(route);
  }

  function handleAskAi() {
    if (aiUsed && !isAdmin && !isPro) {
      if (!openGate("ask-ai")) return;
    }
    setAiUsed(true);
    setAiReply(
      `For ${origin} → ${destination} (~925 mi via I-35/I-44/I-55): fuel early at Pilot #701 Ardmore (I-35 Ex 33; Gulf diesel usually under Midwest EIA ~$5.20). Overnight at Petro Joplin (I-44 Ex 4, ~465 spaces) before lots fill mid-afternoon. Watch MoDOT’s St. Clair WB scale rebuild on I-44. Into Chicago, budget I-80 Joliet congestion and intermodal waits over 2 hours — confirm detention terms before you accept the load.`,
    );
  }

  return (
    <section className="w-full min-w-0 max-w-full overflow-x-clip bg-asphalt py-12 text-white sm:py-28">
      <div className="mx-auto w-full min-w-0 max-w-6xl px-4 sm:px-8">
        <div className="max-w-2xl">
          <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
            Route planner
          </p>
          <h2 className="mt-3 font-display text-3xl leading-tight tracking-wide uppercase sm:text-5xl">
            Search a corridor. See the road ahead.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-chrome sm:text-lg">
            No account needed to search. Sign up when you want to save the trip
            or ask AI for more than one free tip.
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs tracking-wide text-chrome uppercase">
              Origin
            </span>
            <input
              list="city-suggestions"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full rounded-sm border border-white/15 bg-road px-4 py-3 text-base text-white outline-none transition focus:border-amber sm:text-[1rem]"
              placeholder="Dallas, TX"
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs tracking-wide text-chrome uppercase">
              Destination
            </span>
            <input
              list="city-suggestions"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full rounded-sm border border-white/15 bg-road px-4 py-3 text-base text-white outline-none transition focus:border-amber sm:text-[1rem]"
              placeholder="Chicago, IL"
              autoComplete="off"
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-1 lg:flex lg:items-end">
            <button
              type="submit"
              disabled={!canSearch}
              className="w-full rounded-sm bg-amber px-6 py-3.5 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto lg:py-3"
            >
              Search route
            </button>
          </div>
          <datalist id="city-suggestions">
            {citySuggestions.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
        </form>

        {route && (
          <>
            <div className="mt-10">
              <CorridorIntelMap
                corridor={corridorFromSearch(route.origin, route.destination)}
                items={seedFeedItems}
              />
              <p className="mt-3 text-center text-sm text-chrome">
                Open{" "}
                <a href="/live" className="text-amber underline">
                  Live activity
                </a>{" "}
                for the full risk-ranked feed on these states.
              </p>
            </div>

          <div className="animate-fade-in mt-10 grid w-full min-w-0 max-w-full gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="order-2 min-w-0 max-w-full lg:order-1">
              <div className="flex min-w-0 flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="font-display text-2xl tracking-wide break-words uppercase sm:text-3xl">
                    {route.origin} → {route.destination}
                  </p>
                  <p className="mt-1 break-words text-sm text-chrome sm:text-base">
                    {route.miles} miles · ~{route.hours} driving hours
                    {statusCounts &&
                      ` · ${statusCounts.fuel} fuel · ${statusCounts.parking} parking · ${statusCounts.alerts} alerts`}
                  </p>
                </div>
                <div className="mt-4 flex w-full flex-col gap-2 sm:mt-0 sm:w-auto sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={handleAskAi}
                    className="w-full rounded-sm border border-amber/50 bg-amber/10 px-4 py-3 text-sm text-amber-hot transition hover:bg-amber/20 sm:w-auto sm:py-2"
                  >
                    Ask AI once
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saveBusy || saved}
                    className="w-full rounded-sm bg-white px-4 py-3 text-sm font-semibold text-asphalt transition hover:bg-concrete disabled:opacity-70 sm:w-auto sm:py-2"
                  >
                    {saveBusy
                      ? "Saving…"
                      : saved
                        ? "Route saved"
                        : "Save this route"}
                  </button>
                </div>
              </div>

              {saveError && (
                <p className="mt-4 text-sm text-alert">{saveError}</p>
              )}
              {saved && !saveError && (
                <p className="mt-4 text-sm text-amber-hot">
                  Saved to your Members page.
                </p>
              )}

              <div className="mt-8 min-w-0 border-t border-white/10 pt-8">
                <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
                  Along this corridor
                </p>
                <p className="mt-2 max-w-xl break-words text-sm leading-relaxed text-chrome">
                  {support?.note ??
                    "Tap a category to see only that service — same pattern as Live."}
                </p>

                <div className="mt-6 w-full min-w-0 [--h-scroll-fade:#1a1d23]">
                  <HScroll
                    aria-label="Filter corridor services"
                    hint="Swipe filters →"
                  >
                    {planFilterChips.map((chip) => {
                      const active = planFilter === chip.id;
                      const count = filterCounts[chip.id];
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => {
                            e.preventDefault();
                            const y = window.scrollY;
                            setPlanFilter(chip.id);
                            requestAnimationFrame(() => {
                              window.scrollTo(0, y);
                            });
                          }}
                          className={`shrink-0 border-b-2 px-1.5 pb-2 text-sm font-semibold tracking-wide uppercase transition ${
                            active
                              ? "border-white text-white"
                              : "border-transparent text-chrome hover:text-white"
                          }`}
                        >
                          {chip.label}
                          <span
                            className={`ml-1.5 text-xs font-normal ${
                              active ? "text-amber" : "text-chrome/70"
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </HScroll>
                </div>

                {filteredServices.length > 0 ? (
                  <ul className="mt-6 space-y-0 border-t border-white/10 pb-16">
                    {filteredServices.map((place) => (
                      <li
                        key={place.id}
                        className="grid min-w-0 grid-cols-[auto_1fr] gap-3 border-b border-white/10 py-3 sm:gap-4"
                      >
                        <div className="pt-0.5 text-right font-display text-sm text-amber">
                          mi {place.mile}
                        </div>
                        <div className="min-w-0">
                          <p className="break-words font-medium text-white">
                            <span className="mr-2 font-display text-xs tracking-wider text-chrome uppercase">
                              {serviceLabel[place.kind]}
                            </span>
                            {place.name}
                          </p>
                          <p className="mt-1 break-words text-sm text-chrome">
                            {place.detail}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-5 text-sm text-chrome">
                    No {planFilter === "all" ? "mapped" : planFilter} services
                    for this corridor yet.
                  </p>
                )}
              </div>

              <ul className="mt-6 space-y-4">
                {route.insights.map((insight) => (
                  <li
                    key={insight}
                    className="border-l-2 border-amber pl-4 text-chrome"
                  >
                    {insight}
                  </li>
                ))}
              </ul>

              {aiReply && (
                <div className="mt-8 border border-amber/30 bg-amber/5 p-5">
                  <p className="font-display text-xs tracking-[0.18em] text-amber uppercase">
                    AI trip tip
                  </p>
                  <p className="mt-2 leading-relaxed text-white/90">{aiReply}</p>
                  {aiUsed && (
                    <p className="mt-3 text-sm text-chrome">
                      Free guest tip used. Sign in for more AI answers.
                    </p>
                  )}
                </div>
              )}

              <ol className="mt-8 space-y-0">
                {route.stops.map((stop, index) => (
                  <li
                    key={stop.id}
                    className="grid grid-cols-[auto_1fr] gap-4 border-t border-white/10 py-4"
                  >
                    <div className="pt-1 text-right font-display text-sm text-amber">
                      mi {stop.mile}
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        <span className="mr-2 font-display text-xs tracking-wider text-chrome uppercase">
                          {stop.type}
                        </span>
                        {stop.label}
                      </p>
                      <p className="mt-1 text-sm text-chrome">{stop.detail}</p>
                      {index < route.stops.length - 1 && (
                        <div className="mt-3 h-px w-full bg-gradient-to-r from-white/20 to-transparent" />
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="order-1 min-w-0 max-w-full lg:order-2 lg:sticky lg:top-6 lg:self-start">
              <RouteMap
                route={route}
                supportPlaces={support?.places ?? []}
              />
            </div>
          </div>
          </>
        )}
      </div>
    </section>
  );
}
