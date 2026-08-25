"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { citySuggestions, sampleRoute } from "@/lib/mock-data";
import { getCorridorSupport } from "@/lib/corridor-support";
import { writeLastCorridor, readLastCorridor } from "@/lib/corridor-store";
import {
  readPlanDraft,
  writePlanDraft,
  sameCorridor,
} from "@/lib/plan-draft";
import { useAuthGate } from "@/lib/auth-gate";
import { saveRoute } from "@/lib/supabase/data";
import { HScroll } from "@/components/h-scroll";
import { ResumeCheckBanner } from "@/components/resume-check-banner";
import type { PlannedRoute } from "@/types";

type StopKind = "parking" | "fuel" | "repair" | "lodging";
type Filter = "all" | "parking" | "fuel" | "repair";

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
];

const kindTone: Record<StopKind, string> = {
  fuel: "bg-amber text-asphalt",
  parking: "bg-sky-deep text-white",
  repair: "bg-asphalt text-white",
  lodging: "bg-road text-white",
};

const kindMark: Record<StopKind, string> = {
  fuel: "F",
  parking: "P",
  repair: "R",
  lodging: "L",
};

const PLAN_STOP_KINDS = new Set<string>([
  "parking",
  "fuel",
  "repair",
  "lodging",
]);

function isMappedUsCorridor(origin: string, destination: string) {
  const o = origin.toLowerCase();
  const d = destination.toLowerCase();
  return o.includes("dallas") && (d.includes("chicago") || d.includes("joliet"));
}

function buildRoute(origin: string, destination: string): PlannedRoute {
  // Only the Dallas→Chicago seed has real stop data. Never paste US sample
  // weigh/alerts onto UK or other corridors.
  if (isMappedUsCorridor(origin, destination)) {
    return {
      ...sampleRoute,
      origin,
      destination,
      stops: sampleRoute.stops.filter(
        (s) => s.type === "fuel" || s.type === "parking",
      ),
      insights: sampleRoute.insights,
    };
  }
  return {
    origin,
    destination,
    miles: 0,
    hours: 0,
    insights: [],
    stops: [],
  };
}

function collectStops(route: PlannedRoute): RibbonStop[] {
  const support = getCorridorSupport(route.origin, route.destination);
  const fromSupport: RibbonStop[] = (support?.places ?? [])
    .filter((place) => PLAN_STOP_KINDS.has(place.kind))
    .map((place) => ({
      id: `support-${place.id}`,
      kind: place.kind as StopKind,
      name: place.name,
      detail: place.detail,
      mile: place.mile,
    }));
  const fromRoute: RibbonStop[] = route.stops
    .filter((stop) => PLAN_STOP_KINDS.has(stop.type))
    .map((stop) => ({
      id: `stop-${stop.id}`,
      kind: stop.type as StopKind,
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
  const queryKey = params.toString();
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
  const [discoverBusy, setDiscoverBusy] = useState(false);
  const [discoverNote, setDiscoverNote] = useState<string | null>(null);

  async function loadLiveStops(
    origin: string,
    destination: string,
    opts?: { force?: boolean },
  ) {
    setDiscoverBusy(true);
    setDiscoverNote("Finding fuel, parking, and repair along this haul…");
    try {
      const res = await fetch("/api/plan/corridor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination }),
      });
      const data = (await res.json()) as {
        miles?: number | null;
        hours?: number | null;
        notes?: string[];
        provider?: string;
        stops?: PlannedRoute["stops"];
        error?: string;
      };
      if (!res.ok) {
        setDiscoverNote(data.error || "Could not discover corridor stops.");
        return;
      }
      const liveStops = (data.stops ?? []).filter(
        (s) =>
          s.type === "fuel" || s.type === "parking" || s.type === "repair",
      );
      const seedStops = isMappedUsCorridor(origin, destination)
        ? buildRoute(origin, destination).stops
        : [];
      const merged = [...liveStops];
      for (const s of seedStops) {
        if (
          merged.some(
            (m) =>
              m.label.toLowerCase() === s.label.toLowerCase() &&
              Math.abs(m.mile - s.mile) < 15,
          )
        ) {
          continue;
        }
        merged.push(s);
      }
      merged.sort((a, b) => a.mile - b.mile);

      const nextRoute: PlannedRoute = {
        origin,
        destination,
        miles:
          data.miles && data.miles > 0
            ? data.miles
            : isMappedUsCorridor(origin, destination)
              ? sampleRoute.miles
              : 0,
        hours:
          data.hours && data.hours > 0
            ? data.hours
            : isMappedUsCorridor(origin, destination)
              ? sampleRoute.hours
              : 0,
        stops: merged,
        insights:
          data.notes && data.notes.length > 0
            ? data.notes
            : isMappedUsCorridor(origin, destination)
              ? sampleRoute.insights
              : [],
      };
      setRoute(nextRoute);

      let note: string;
      if (liveStops.length === 0) {
        note =
          data.notes?.[0] ||
          "No live stops found — use Find near pickup or delivery.";
      } else {
        note = `Found ${liveStops.length} stops along the haul${
          data.provider && data.provider !== "fallback"
            ? " (live discovery)"
            : ""
        }.`;
      }
      if (opts?.force) note = `Refreshed · ${note}`;
      setDiscoverNote(note);
      writePlanDraft({ route: nextRoute, discoverNote: note });
      writeLastCorridor(origin, destination);
    } catch {
      setDiscoverNote("Network error discovering stops. Try again.");
    } finally {
      setDiscoverBusy(false);
    }
  }

  useEffect(() => {
    const qFrom = params.get("from") || params.get("origin");
    const qTo = params.get("to") || params.get("destination");
    const last = readLastCorridor();
    const draft = readPlanDraft();
    const nextFrom = (qFrom || last?.origin || draft?.route.origin || "").trim();
    const nextTo = (
      qTo ||
      last?.destination ||
      draft?.route.destination ||
      ""
    ).trim();
    setFrom(nextFrom);
    setTo(nextTo);
    setHydrated(true);

    if (!nextFrom || !nextTo) return;

    writeLastCorridor(nextFrom, nextTo);

    // Resume cached haul if from/to match — do not re-hit OpenAI
    if (
      draft &&
      sameCorridor(draft.route, { origin: nextFrom, destination: nextTo }) &&
      draft.route.stops.length > 0
    ) {
      setRoute(draft.route);
      setDiscoverNote(
        draft.discoverNote ||
          `Restored ${draft.route.stops.length} saved stops for this haul.`,
      );
      return;
    }

    const planned = buildRoute(nextFrom, nextTo);
    setRoute(planned);
    void loadLiveStops(nextFrom, nextTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when URL query changes
  }, [params, queryKey]);

  const stops = useMemo(
    () => (route ? collectStops(route) : []),
    [route],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return stops;
    return stops.filter((s) => s.kind === filter);
  }, [stops, filter]);

  const selected = stops.find((s) => s.id === selectedId) ?? null;

  function runPlan(e?: React.FormEvent) {
    e?.preventDefault();
    const nextFrom = from.trim();
    const nextTo = to.trim();
    if (!nextFrom || !nextTo) return;
    setFilter("all");
    setSelectedId(null);
    setSaved(false);
    setSaveError(null);
    writeLastCorridor(nextFrom, nextTo);

    // Same corridor already loaded with stops → keep cache unless empty
    if (
      route &&
      sameCorridor(route, { origin: nextFrom, destination: nextTo }) &&
      route.stops.length > 0
    ) {
      setDiscoverNote(
        discoverNote ||
          `Showing ${route.stops.length} saved stops — tap Refresh to search again.`,
      );
      writePlanDraft({
        route,
        discoverNote:
          discoverNote ||
          `Showing ${route.stops.length} saved stops for this haul.`,
      });
      return;
    }

    const planned = buildRoute(nextFrom, nextTo);
    setRoute(planned);
    void loadLiveStops(nextFrom, nextTo);
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
      <ResumeCheckBanner />
      <section>
        <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
          Plan route
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-wide text-asphalt uppercase sm:text-5xl">
          See the whole haul
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          From and to on one line — fuel, parking, and repair along the way.
          Built for the trip you run today.
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
            disabled={!canPlan || discoverBusy}
            className="w-full rounded-sm bg-amber px-6 py-3.5 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot disabled:cursor-not-allowed disabled:opacity-40"
          >
            {discoverBusy ? "Finding stops…" : "Plan route"}
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
                {discoverBusy
                  ? "Finding fuel, parking, and repair along this haul…"
                  : stops.length > 0
                    ? `${
                        route.miles > 0 ? `~${route.miles} mi · ` : ""
                      }${
                        route.hours > 0 ? `~${route.hours} hrs · ` : ""
                      }${stops.length} stops on the corridor`
                    : "Corridor stops for this haul are not mapped yet — use Find for parking, fuel, or repair near pickup or delivery."}
              </p>
              {discoverNote && !discoverBusy && (
                <p className="mt-1 text-xs text-muted">{discoverNote}</p>
              )}
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
              <button
                type="button"
                disabled={discoverBusy || !route}
                onClick={() => {
                  if (!route) return;
                  void loadLiveStops(route.origin, route.destination, {
                    force: true,
                  });
                }}
                className="rounded-sm border border-asphalt/15 bg-white px-4 py-2.5 text-xs font-semibold tracking-wide text-asphalt uppercase transition hover:border-amber disabled:opacity-60"
              >
                {discoverBusy ? "Refreshing…" : "Refresh stops"}
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

          {/* Corridor journey — ordered stations (no geographic squeeze) */}
          <div className="overflow-hidden border border-asphalt/10 bg-white">
            <div className="border-b border-asphalt/10 px-4 py-3 sm:px-5">
              <p className="font-display text-xs tracking-[0.16em] text-muted uppercase">
                Corridor
              </p>
              <p className="mt-1 text-sm text-muted">
                {discoverBusy
                  ? "Searching the corridor…"
                  : stops.length > 0
                    ? "Stops in haul order — swipe along the journey. Tap for detail."
                    : "A → B is set. Mapped fuel, parking, and repair load in after discovery."}
              </p>
            </div>

            <div className="[--h-scroll-fade:#ffffff] px-3 py-5 sm:px-5">
              <HScroll aria-label="Route corridor" role="list" hint="">
                <div className="flex min-w-min items-start gap-0 px-1">
                  {/* Origin */}
                  <div className="relative z-10 flex w-[4.75rem] shrink-0 flex-col items-center text-center sm:w-24">
                    <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-emerald-700 text-xs font-bold tracking-wide text-white">
                      A
                    </span>
                    <span className="mt-2 line-clamp-3 px-0.5 text-[10px] font-semibold leading-tight tracking-wide text-asphalt uppercase sm:text-[11px]">
                      {route.origin}
                    </span>
                    <span className="mt-1 text-[10px] text-muted">mi 0</span>
                  </div>

                  {stops.map((stop, index) => (
                    <div
                      key={stop.id}
                      className="relative flex shrink-0 items-start"
                    >
                      {/* Connector from previous station */}
                      <div
                        className="mt-5 h-0.5 w-6 shrink-0 bg-asphalt/20 sm:w-10"
                        aria-hidden
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedId(
                            selectedId === stop.id ? null : stop.id,
                          )
                        }
                        className="relative z-10 flex w-[4.75rem] flex-col items-center text-center transition sm:w-24"
                        title={`${stop.name} · mi ${stop.mile}`}
                      >
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-sm text-xs font-bold transition ${
                            kindTone[stop.kind]
                          } ${
                            selectedId === stop.id
                              ? "ring-2 ring-amber ring-offset-2"
                              : ""
                          }`}
                        >
                          {kindMark[stop.kind]}
                        </span>
                        <span className="mt-2 line-clamp-2 px-0.5 text-[10px] font-medium leading-tight text-asphalt sm:text-[11px]">
                          {stop.name}
                        </span>
                        <span className="mt-1 font-display text-[10px] tracking-wide text-muted uppercase">
                          mi {stop.mile}
                          <span className="mx-1 text-asphalt/30">·</span>
                          {stop.kind}
                        </span>
                        <span className="sr-only">
                          Stop {index + 1} of {stops.length}
                        </span>
                      </button>
                    </div>
                  ))}

                  {/* Connector into delivery */}
                  <div
                    className="mt-5 h-0.5 w-6 shrink-0 bg-asphalt/20 sm:w-10"
                    aria-hidden
                  />
                  <div className="relative z-10 flex w-[4.75rem] shrink-0 flex-col items-center text-center sm:w-24">
                    <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-alert text-xs font-bold tracking-wide text-white">
                      B
                    </span>
                    <span className="mt-2 line-clamp-3 px-0.5 text-[10px] font-semibold leading-tight tracking-wide text-asphalt uppercase sm:text-[11px]">
                      {route.destination}
                    </span>
                    {route.miles > 0 && (
                      <span className="mt-1 text-[10px] text-muted">
                        mi {Math.round(route.miles)}
                      </span>
                    )}
                  </div>
                </div>
              </HScroll>
              {stops.length > 0 && (
                <p className="mt-3 text-xs text-muted">
                  Spacing is journey order, not map distance — so clustered
                  services stay readable.
                </p>
              )}
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
                  {stops.length === 0
                    ? "No corridor stops mapped for this haul yet."
                    : `No ${filter} stops on this corridor yet.`}
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
