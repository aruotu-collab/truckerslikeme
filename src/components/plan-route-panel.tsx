"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { citySuggestions, sampleRoute } from "@/lib/mock-data";
import { getCorridorSupport } from "@/lib/corridor-support";
import { writeLastCorridor, readLastCorridor } from "@/lib/corridor-store";
import { useAuthGate } from "@/lib/auth-gate";
import { saveRoute } from "@/lib/supabase/data";
import { HScroll } from "@/components/h-scroll";
import type { PlannedRoute } from "@/types";

type StopKind = "parking" | "fuel" | "repair" | "weigh" | "alert" | "lodging";
type Filter = "all" | "parking" | "fuel" | "repair" | "weigh" | "alert";

type RibbonStop = {
  id: string;
  kind: StopKind;
  name: string;
  detail: string;
  mile: number;
};

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "fuel", label: "Fuel" },
  { id: "parking", label: "Parking" },
  { id: "repair", label: "Repair" },
  { id: "weigh", label: "Weigh" },
  { id: "alert", label: "Alerts" },
];

const kindTone: Record<StopKind, string> = {
  fuel: "bg-amber text-asphalt",
  parking: "bg-sky-deep text-white",
  repair: "bg-asphalt text-white",
  weigh: "bg-concrete text-asphalt",
  alert: "bg-alert text-white",
  lodging: "bg-road text-white",
};

const kindMark: Record<StopKind, string> = {
  fuel: "F",
  parking: "P",
  repair: "R",
  weigh: "W",
  alert: "!",
  lodging: "L",
};

function buildRoute(origin: string, destination: string): PlannedRoute {
  return {
    ...sampleRoute,
    origin,
    destination,
  };
}

function collectStops(route: PlannedRoute): RibbonStop[] {
  const support = getCorridorSupport(route.origin, route.destination);
  const fromSupport: RibbonStop[] = (support?.places ?? []).map((place) => ({
    id: `support-${place.id}`,
    kind: place.kind,
    name: place.name,
    detail: place.detail,
    mile: place.mile,
  }));
  const fromRoute: RibbonStop[] = route.stops.map((stop) => ({
    id: `stop-${stop.id}`,
    kind: stop.type,
    name: stop.label,
    detail: stop.detail,
    mile: stop.mile,
  }));

  const merged = [...fromSupport, ...fromRoute];
  const seen = new Set<string>();
  return merged
    .filter((item) => {
      const key = `${item.kind}:${Math.round(item.mile / 10)}:${item.name.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.mile - b.mile);
}

export function PlanRoutePanel() {
  const params = useSearchParams();
  const { isSignedIn, user, openGate } = useAuthGate();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const qFrom = params.get("from") || params.get("origin");
    const qTo = params.get("to") || params.get("destination");
    const last = readLastCorridor();
    const nextFrom = (qFrom || last?.origin || "").trim();
    const nextTo = (qTo || last?.destination || "").trim();
    setFrom(nextFrom);
    setTo(nextTo);
    setHydrated(true);
    if (nextFrom && nextTo) {
      const planned = buildRoute(nextFrom, nextTo);
      setRoute(planned);
      writeLastCorridor(nextFrom, nextTo);
    }
  }, [params]);

  const stops = useMemo(
    () => (route ? collectStops(route) : []),
    [route],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return stops;
    return stops.filter((s) => s.kind === filter);
  }, [stops, filter]);

  const selected = stops.find((s) => s.id === selectedId) ?? null;
  const maxMile = Math.max(route?.miles ?? 1, ...stops.map((s) => s.mile), 1);

  function runPlan(e?: React.FormEvent) {
    e?.preventDefault();
    const nextFrom = from.trim();
    const nextTo = to.trim();
    if (!nextFrom || !nextTo) return;
    const planned = buildRoute(nextFrom, nextTo);
    setRoute(planned);
    setFilter("all");
    setSelectedId(null);
    setSaved(false);
    setSaveError(null);
    writeLastCorridor(nextFrom, nextTo);
  }

  async function handleSave() {
    if (!route) return;
    if (!isSignedIn || !user) {
      openGate("save-route");
      return;
    }
    setSaveBusy(true);
    setSaveError(null);
    const { error } = await saveRoute({ user, route });
    setSaveBusy(false);
    if (error) {
      setSaveError(error);
      return;
    }
    setSaved(true);
  }

  const canPlan = from.trim() && to.trim();

  return (
    <div className="space-y-8">
      <section>
        <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
          Plan route
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-wide text-asphalt uppercase sm:text-5xl">
          See the whole haul
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          From and to on one line — fuel, parking, repair, and alerts along the
          way. Built for the trip you run today.
        </p>
      </section>

      <form
        onSubmit={runPlan}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_auto]"
      >
        <label className="block">
          <span className="font-display text-xs tracking-[0.16em] text-muted uppercase">
            From
          </span>
          <input
            list="plan-city-suggestions"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="Ottery St Mary · Dallas · Lekki"
            className="mt-2 w-full rounded-sm border border-asphalt/15 bg-white px-4 py-3 text-asphalt focus:border-amber focus:outline-none"
            autoComplete="off"
          />
        </label>
        <div className="hidden items-end justify-center pb-3 lg:flex" aria-hidden>
          <span className="font-display text-2xl text-amber">→</span>
        </div>
        <label className="block">
          <span className="font-display text-xs tracking-[0.16em] text-muted uppercase">
            To
          </span>
          <input
            list="plan-city-suggestions"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Kenilworth · Chicago · Apapa"
            className="mt-2 w-full rounded-sm border border-asphalt/15 bg-white px-4 py-3 text-asphalt focus:border-amber focus:outline-none"
            autoComplete="off"
          />
        </label>
        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <button
            type="submit"
            disabled={!canPlan}
            className="w-full rounded-sm bg-amber px-6 py-3.5 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot disabled:cursor-not-allowed disabled:opacity-40"
          >
            Plan route
          </button>
        </div>
        <datalist id="plan-city-suggestions">
          {citySuggestions.map((city) => (
            <option key={city} value={city} />
          ))}
        </datalist>
      </form>

      {!route && hydrated && (
        <p className="text-sm text-muted">
          Enter from and to, or plan a trip after you check a load.
        </p>
      )}

      {route && (
        <section className="animate-fade-in space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-display text-2xl tracking-wide text-asphalt uppercase sm:text-3xl">
                {route.origin} → {route.destination}
              </p>
              <p className="mt-1 text-sm text-muted">
                ~{route.miles} mi · ~{route.hours} hrs · {stops.length} stops on
                the corridor
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saveBusy || saved}
                className="rounded-sm border border-asphalt/15 bg-white px-4 py-2.5 text-xs font-semibold tracking-wide text-asphalt uppercase transition hover:border-amber disabled:opacity-60"
              >
                {saveBusy ? "Saving…" : saved ? "Saved" : "Save trip"}
              </button>
              <Link
                href={`/find?need=parking&near=${encodeURIComponent(route.destination)}`}
                className="rounded-sm bg-asphalt px-4 py-2.5 text-xs font-semibold tracking-wide text-white uppercase"
              >
                Parking near delivery
              </Link>
            </div>
          </div>
          {saveError && <p className="text-sm text-alert">{saveError}</p>}

          {/* Corridor ribbon */}
          <div className="overflow-hidden rounded-sm border border-asphalt/10 bg-white">
            <div className="border-b border-asphalt/10 px-4 py-3 sm:px-5">
              <p className="font-display text-xs tracking-[0.16em] text-muted uppercase">
                Corridor
              </p>
              <p className="mt-1 text-sm text-muted">
                Swipe the haul. Tap a stop for detail.
              </p>
            </div>
            <div className="[--h-scroll-fade:#ffffff] px-3 pt-6 pb-5 sm:px-5">
              <HScroll aria-label="Route corridor" role="list" hint="">
                <div className="relative h-28 w-[40rem] shrink-0 sm:w-[52rem]">
                  <div
                    className="absolute top-4 right-10 left-10 h-0.5 bg-asphalt/20"
                    aria-hidden
                  />
                  {/* A */}
                  <div className="absolute top-0 left-0 z-10 flex w-20 flex-col items-center text-center">
                    <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-emerald-700 text-xs font-bold text-white">
                      A
                    </span>
                    <span className="mt-2 line-clamp-2 px-0.5 text-[10px] font-semibold tracking-wide text-asphalt uppercase">
                      {route.origin}
                    </span>
                  </div>
                  {/* B */}
                  <div className="absolute top-0 right-0 z-10 flex w-20 flex-col items-center text-center">
                    <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-alert text-xs font-bold text-white">
                      B
                    </span>
                    <span className="mt-2 line-clamp-2 px-0.5 text-[10px] font-semibold tracking-wide text-asphalt uppercase">
                      {route.destination}
                    </span>
                  </div>
                  {/* Stops along the line (inset so they stay between A/B) */}
                  {stops.map((stop) => {
                    const pct = Math.min(90, Math.max(10, (stop.mile / maxMile) * 100));
                    return (
                      <button
                        key={stop.id}
                        type="button"
                        onClick={() =>
                          setSelectedId(
                            selectedId === stop.id ? null : stop.id,
                          )
                        }
                        className="absolute top-0 z-20 flex w-12 -translate-x-1/2 flex-col items-center text-center"
                        style={{ left: `${pct}%` }}
                        title={`${stop.name} · mi ${stop.mile}`}
                      >
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-sm text-xs font-bold transition ${
                            kindTone[stop.kind]
                          } ${
                            selectedId === stop.id
                              ? "ring-2 ring-amber ring-offset-2"
                              : ""
                          }`}
                        >
                          {kindMark[stop.kind]}
                        </span>
                        <span className="mt-2 text-[10px] text-muted">
                          mi {stop.mile}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </HScroll>
            </div>

            {selected && (
              <div className="border-t border-asphalt/10 bg-concrete/40 px-4 py-4 sm:px-5">
                <p className="font-display text-xs tracking-[0.16em] text-amber uppercase">
                  {selected.kind} · mi {selected.mile}
                </p>
                <p className="mt-1 text-lg font-medium text-asphalt">
                  {selected.name}
                </p>
                <p className="mt-1 text-sm text-muted">{selected.detail}</p>
                <Link
                  href={`/find?need=${
                    selected.kind === "fuel"
                      ? "diesel"
                      : selected.kind === "repair"
                        ? "repair"
                        : "parking"
                  }&near=${encodeURIComponent(selected.name)}`}
                  className="mt-3 inline-block text-sm font-medium text-amber transition hover:text-asphalt"
                >
                  Open in Find →
                </Link>
              </div>
            )}
          </div>

          <div>
            <div className="[--h-scroll-fade:var(--background)]">
              <HScroll aria-label="Filter stops" hint="">
                {filters.map((chip) => {
                  const count =
                    chip.id === "all"
                      ? stops.length
                      : stops.filter((s) => s.kind === chip.id).length;
                  const active = filter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setFilter(chip.id)}
                      className={`shrink-0 rounded-sm px-3.5 py-2 text-xs font-semibold tracking-wide uppercase transition ${
                        active
                          ? "bg-amber text-asphalt"
                          : "border border-asphalt/15 bg-white text-asphalt hover:bg-concrete/50"
                      }`}
                    >
                      {chip.label}
                      <span className="ml-1.5 opacity-70">{count}</span>
                    </button>
                  );
                })}
              </HScroll>
            </div>

            <ul className="mt-4 divide-y divide-asphalt/10 border-y border-asphalt/10">
              {filtered.map((stop) => (
                <li key={stop.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedId(selectedId === stop.id ? null : stop.id)
                    }
                    className="grid w-full grid-cols-[auto_1fr] gap-3 py-4 text-left transition hover:bg-white/60 sm:gap-4"
                  >
                    <div className="pt-0.5 text-right font-display text-sm text-amber">
                      mi {stop.mile}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-asphalt">
                        <span className="mr-2 font-display text-xs tracking-wider text-muted uppercase">
                          {stop.kind}
                        </span>
                        {stop.name}
                      </p>
                      <p className="mt-1 text-sm text-muted">{stop.detail}</p>
                    </div>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="py-6 text-sm text-muted">
                  No {filter} stops on this corridor yet.
                </li>
              )}
            </ul>
          </div>

          {route.insights.length > 0 && (
            <div>
              <p className="font-display text-xs tracking-[0.16em] text-muted uppercase">
                Corridor notes
              </p>
              <ul className="mt-3 space-y-2">
                {route.insights.map((insight) => (
                  <li
                    key={insight}
                    className="border-l-2 border-amber pl-4 text-sm text-muted"
                  >
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
