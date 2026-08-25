"use client";

import { useEffect, useMemo, useState } from "react";
import { JobsExploreMap } from "@/components/jobs-explore-map";
import { JobsTubeMap } from "@/components/jobs-tube-map";
import { useMarket } from "@/lib/market-context";
import {
  buildRouteConnections,
  findPossibleRuns,
  sortConnections,
  unmappedJobs,
  type DirectionId,
  type MapViewMode,
  type SortMode,
} from "@/lib/jobs-map-explore";
import {
  filterMapJobs,
  mapStatusMeta,
  mergeScannedJobs,
  placeKey,
  readJobsMapState,
  shortPlace,
  writeJobsMapState,
  type JobsMapDriver,
  type JobsMapFilter,
  type MapJob,
  type MapJobStatus,
} from "@/lib/jobs-map";
import { resolveUkPlace } from "@/lib/uk-places";
import type { VisibleShiplyJob } from "@/lib/run-shortlist";

const CONTEXT_KEY = "tlm_shiply_bb_context";

const FILTERS: { id: JobsMapFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "hunting", label: "Hunting" },
  { id: "won", label: "Won" },
];

const VIEW_MODES: { id: MapViewMode; label: string; hint: string }[] = [
  {
    id: "explore",
    label: "Explore",
    hint: "Direction clusters — no spaghetti lines until you tap",
  },
  {
    id: "connections",
    label: "Connections",
    hint: "Tube map for one hub city",
  },
  { id: "runs", label: "Build a run", hint: "Auto-found job chains" },
];

const SORTS: { id: SortMode; label: string }[] = [
  { id: "money", label: "Most money" },
  { id: "jobs", label: "Most jobs" },
  { id: "rpm", label: "Best £/mi" },
  { id: "distance", label: "Shortest" },
];

export function JobsMapPanel() {
  const { money } = useMarket();
  const [jobs, setJobs] = useState<MapJob[]>([]);
  const [driver, setDriver] = useState<JobsMapDriver | null>(null);
  const [startDraft, setStartDraft] = useState("");
  const [geoBusy, setGeoBusy] = useState(false);
  const [filter, setFilter] = useState<JobsMapFilter>("all");
  const [viewMode, setViewMode] = useState<MapViewMode>("explore");
  const [sortMode, setSortMode] = useState<SortMode>("money");
  const [selectedDirection, setSelectedDirection] =
    useState<DirectionId | null>(null);
  const [selectedCityKey, setSelectedCityKey] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [hubKey, setHubKey] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coach, setCoach] = useState<string | null>(null);
  const [scanned, setScanned] = useState<VisibleShiplyJob[]>([]);
  const [selectedScan, setSelectedScan] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loaded = readJobsMapState();
    setJobs(loaded.jobs);
    setDriver(loaded.driver);
    setStartDraft(loaded.driver?.label ?? "");
    setHydrated(true);
    void fetch("/api/run/shiply/session")
      .then((r) => r.json())
      .then((d: { enabled?: boolean }) => setEnabled(Boolean(d.enabled)))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeJobsMapState({ jobs, driver });
  }, [jobs, driver, hydrated]);

  const visible = filterMapJobs(jobs, filter);
  const startReady = Boolean(driver?.label.trim());

  const routes = useMemo(
    () => sortConnections(buildRouteConnections(visible), sortMode),
    [visible, sortMode],
  );

  const possibleRuns = useMemo(
    () => findPossibleRuns(visible, driver),
    [visible, driver],
  );

  const unmapped = useMemo(() => unmappedJobs(visible), [visible]);

  const hubOptions = useMemo(() => {
    const counts = new Map<string, { label: string; n: number }>();
    for (const j of visible) {
      for (const place of [j.origin, j.destination]) {
        const k = placeKey(place);
        if (!k) continue;
        const prev = counts.get(k);
        if (prev) prev.n += 1;
        else counts.set(k, { label: shortPlace(place), n: 1 });
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 12)
      .map(([key, v]) => ({ key, ...v }));
  }, [visible]);

  const hubJobs = useMemo(() => {
    if (!hubKey) return [];
    return visible.filter(
      (j) =>
        placeKey(j.origin) === hubKey || placeKey(j.destination) === hubKey,
    );
  }, [visible, hubKey]);

  function applyStart(label: string, lat: number | null, lon: number | null) {
    const trimmed = label.trim();
    if (!trimmed) {
      setDriver(null);
      setStartDraft("");
      return;
    }
    const resolved =
      lat != null && lon != null
        ? { lat, lon }
        : resolveUkPlace(trimmed);
    setDriver({
      label: trimmed,
      lat: resolved?.lat ?? lat,
      lon: resolved?.lon ?? lon,
    });
    setStartDraft(trimmed);
  }

  async function useMyLocation() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Location isn’t available in this browser.");
      return;
    }
    setGeoBusy(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15_000,
        });
      });
      const { reverseGeocodePlace } = await import("@/lib/reverse-geocode");
      const place = await reverseGeocodePlace(
        pos.coords.latitude,
        pos.coords.longitude,
      );
      applyStart(place.label, pos.coords.latitude, pos.coords.longitude);
      setCoach(`Start set to ${place.label}.`);
    } catch {
      setError("Couldn’t read your location. Type a town instead.");
    } finally {
      setGeoBusy(false);
    }
  }

  function setStatus(id: string, status: MapJobStatus) {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, status, updatedAt: new Date().toISOString() }
          : j,
      ),
    );
  }

  function removeJob(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  async function startSession() {
    if (!startReady) {
      setError("Set your starting location first — the map needs where you are.");
      return;
    }
    setError(null);
    setBusy(true);
    setScanned([]);
    setSelectedScan({});
    setCoach(null);
    try {
      const contextId =
        typeof window !== "undefined"
          ? localStorage.getItem(CONTEXT_KEY)
          : null;
      const res = await fetch("/api/run/shiply/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextId }),
      });
      const data = (await res.json()) as {
        sessionId?: string;
        liveViewUrl?: string;
        contextId?: string;
        error?: string;
        tip?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not start Shiply browser.");
        return;
      }
      if (data.contextId) {
        localStorage.setItem(CONTEXT_KEY, data.contextId);
      }
      setSessionId(data.sessionId ?? null);
      setLiveViewUrl(data.liveViewUrl ?? null);
      if (data.tip) setCoach(data.tip);
    } catch {
      setError("Network error starting Shiply connect.");
    } finally {
      setBusy(false);
    }
  }

  async function scanVisible() {
    if (!sessionId) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/run/shiply/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          start: driver?.label || "",
          mode: "profit",
          vehicle: "van",
          completeList: true,
        }),
      });
      const data = (await res.json()) as {
        jobs?: VisibleShiplyJob[];
        coach?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not scan the Shiply page.");
        return;
      }
      const list = data.jobs ?? [];
      setScanned(list);
      setCoach(data.coach ?? null);
      const next: Record<string, boolean> = {};
      for (const j of list) next[j.id] = true;
      setSelectedScan(next);
    } catch {
      setError("Network error scanning Shiply.");
    } finally {
      setBusy(false);
    }
  }

  function addScannedToMap(all = false) {
    if (!startReady) {
      setError("Set your starting location before adding jobs to the map.");
      return;
    }
    const picked = all
      ? scanned
      : scanned.filter((j) => selectedScan[j.id]);
    if (!picked.length) {
      setError(all ? "No jobs scanned yet." : "Tick at least one job to add to the map.");
      return;
    }
    setJobs((prev) => mergeScannedJobs(prev, picked));
    setCoach(
      `Added ${picked.length} job${picked.length === 1 ? "" : "s"} to your tube map. Tap a line → Open on Shiply.`,
    );
    setScanned([]);
    setSelectedScan({});
    setError(null);
  }

  const counts = {
    all: jobs.filter((j) => j.status !== "skipped").length,
    hunting: jobs.filter(
      (j) => j.status === "hunting" || j.status === "bidding",
    ).length,
    won: jobs.filter((j) => j.status === "won").length,
  };

  return (
    <div className="space-y-10">
      <header className="max-w-2xl">
        <p className="font-display text-xs tracking-[0.18em] text-amber uppercase">
          Hunt board
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-wide text-asphalt uppercase sm:text-4xl">
          Map Jobs
        </h1>
        <p className="mt-3 text-base text-muted sm:text-lg">
          {visible.length} jobs near your routes — explore by direction, drill
          into cities, then open Shiply links. No more 59 lines at once.
        </p>
      </header>

      {/* Start location */}
      <section className="space-y-3 border border-asphalt/10 bg-white px-4 py-5 sm:px-5">
        <div>
          <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
            Where are you starting?
          </h2>
          <p className="mt-1 text-sm text-muted">
            Required — shows as the amber <strong>YOU</strong> stop on the
            collect side of the tube map.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={startDraft}
            onChange={(e) => setStartDraft(e.target.value)}
            onBlur={() => applyStart(startDraft, null, null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyStart(startDraft, null, null);
              }
            }}
            placeholder="e.g. Manchester, Catford, Bristol…"
            className="w-full flex-1 border border-asphalt/15 bg-concrete/20 px-3 py-2.5 text-sm text-asphalt outline-none focus:border-amber"
          />
          <button
            type="button"
            disabled={geoBusy}
            onClick={() => void useMyLocation()}
            className="shrink-0 rounded-sm border border-asphalt/20 px-4 py-2.5 text-xs font-semibold tracking-wide uppercase disabled:opacity-60"
          >
            {geoBusy ? "Locating…" : "Use my location"}
          </button>
          <button
            type="button"
            onClick={() => applyStart(startDraft, null, null)}
            className="shrink-0 rounded-sm bg-asphalt px-4 py-2.5 text-xs font-semibold tracking-wide text-white uppercase"
          >
            Set start
          </button>
        </div>
        {startReady ? (
          <p className="text-sm text-asphalt">
            On the map as{" "}
            <span className="font-semibold">{driver!.label}</span>
            {driver?.lat != null && driver?.lon != null
              ? " (placed)"
              : " (name set — place approx if we know the town)"}
          </p>
        ) : (
          <p className="text-sm text-alert">
            Set a start location before connecting Shiply or adding jobs.
          </p>
        )}
      </section>

      {/* Connect */}
      <section className="space-y-4 border border-asphalt/10 bg-white px-4 py-5 sm:px-5">
        <div>
          <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
            Scan from Shiply
          </h2>
          <p className="mt-1 text-sm text-muted">
            Connect, search results in the live browser, scan, then add jobs to
            this map. Separate from Build My Run.
          </p>
        </div>

        {enabled === false && (
          <p className="border border-dashed border-asphalt/20 bg-concrete/30 px-4 py-3 text-sm text-muted">
            Browserbase is not configured on this environment. Add{" "}
            <code className="text-xs">BROWSERBASE_API_KEY</code> and{" "}
            <code className="text-xs">BROWSERBASE_PROJECT_ID</code> to enable
            Connect Shiply.
          </p>
        )}

        {enabled && !sessionId && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void startSession()}
            className="rounded-sm bg-asphalt px-5 py-3 text-sm font-semibold tracking-wide text-white uppercase disabled:opacity-60"
          >
            {busy ? "Opening browser…" : "Connect Shiply →"}
          </button>
        )}

        {enabled && sessionId && (
          <div className="space-y-3">
            {liveViewUrl && (
              <div className="space-y-2">
                <div className="overflow-hidden border border-asphalt/15 bg-concrete/20">
                  <iframe
                    title="Shiply browser session"
                    src={liveViewUrl}
                    className="h-[min(60vh,640px)] min-h-[420px] w-full bg-white"
                    allow="clipboard-read; clipboard-write"
                  />
                </div>
                <p className="text-xs text-muted">
                  <a
                    href={liveViewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-amber hover:text-asphalt"
                  >
                    Open browser full size →
                  </a>
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void scanVisible()}
                className="rounded-sm bg-amber px-4 py-2.5 text-xs font-semibold tracking-wide text-asphalt uppercase disabled:opacity-60"
              >
                {busy ? "Scanning…" : "Scan visible jobs"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void startSession()}
                className="rounded-sm border border-asphalt/20 px-4 py-2.5 text-xs font-semibold tracking-wide uppercase disabled:opacity-60"
              >
                New session
              </button>
            </div>
          </div>
        )}

        {coach && <p className="text-sm text-asphalt">{coach}</p>}

        {scanned.length > 0 && (
          <div className="space-y-3 border-t border-asphalt/10 pt-4">
            <p className="text-xs font-semibold tracking-wide text-asphalt uppercase">
              Add to map (
              {Object.values(selectedScan).filter(Boolean).length} selected)
            </p>
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {scanned.map((job) => (
                <li key={job.id}>
                  <label className="flex cursor-pointer gap-3 border border-asphalt/10 px-3 py-2.5 hover:bg-concrete/30">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(selectedScan[job.id])}
                      onChange={(e) =>
                        setSelectedScan((s) => ({
                          ...s,
                          [job.id]: e.target.checked,
                        }))
                      }
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium text-asphalt">
                        {shortPlace(job.origin)} → {shortPlace(job.destination)}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {[
                          job.item,
                          job.miles != null ? `${job.miles} mi` : null,
                          job.rateTotal != null ? money(job.rateTotal) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addScannedToMap(true)}
                className="rounded-sm bg-amber px-4 py-2.5 text-xs font-semibold tracking-wide text-asphalt uppercase"
              >
                Add all {scanned.length} to map →
              </button>
              <button
                type="button"
                onClick={() => addScannedToMap(false)}
                className="rounded-sm border border-asphalt/20 px-4 py-2.5 text-xs font-semibold tracking-wide uppercase"
              >
                Add selected only
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-alert">{error}</p>}
      </section>

      {/* Visual explorer */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
              {visible.length} jobs on board
            </h2>
            <p className="mt-1 text-sm text-muted">
              {VIEW_MODES.find((m) => m.id === viewMode)?.hint}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div
              className="inline-flex border border-asphalt/15 bg-white"
              role="tablist"
            >
              {VIEW_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={viewMode === m.id}
                  onClick={() => setViewMode(m.id)}
                  className={`px-3 py-2 text-xs font-semibold tracking-wide uppercase sm:px-4 ${
                    viewMode === m.id
                      ? "bg-asphalt text-white"
                      : "text-asphalt/70 hover:bg-concrete/50"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div
              className="inline-flex border border-asphalt/15 bg-white"
              role="tablist"
              aria-label="Job filter"
            >
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-3 py-2 text-xs font-semibold tracking-wide uppercase sm:px-3 ${
                    filter === f.id
                      ? "bg-amber text-asphalt"
                      : "text-asphalt/70 hover:bg-concrete/50"
                  }`}
                >
                  {f.label}
                  <span className="ml-1 opacity-70">{counts[f.id]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {viewMode === "explore" && (
          <>
            <div className="flex flex-wrap gap-2">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSortMode(s.id)}
                  className={`rounded-sm px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase ${
                    sortMode === s.id
                      ? "bg-asphalt text-white"
                      : "border border-asphalt/15 text-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <JobsExploreMap
              jobs={visible}
              driver={driver}
              selectedDirection={selectedDirection}
              selectedCityKey={selectedCityKey}
              selectedRouteId={selectedRouteId}
              onSelectDirection={setSelectedDirection}
              onSelectCity={setSelectedCityKey}
              onSelectRoute={setSelectedRouteId}
              formatMoney={money}
            />
            {unmapped.length > 0 && (
              <p className="text-xs text-muted">
                {unmapped.length} job{unmapped.length === 1 ? "" : "s"} hidden
                from the map (place not recognised — listed below only).
              </p>
            )}
          </>
        )}

        {viewMode === "connections" && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Pick a hub — tube map shows only jobs touching that city.
            </p>
            <div className="flex flex-wrap gap-2">
              {hubOptions.map((h) => (
                <button
                  key={h.key}
                  type="button"
                  onClick={() => setHubKey(h.key)}
                  className={`rounded-sm px-3 py-1.5 text-xs font-semibold tracking-wide uppercase ${
                    hubKey === h.key
                      ? "bg-asphalt text-white"
                      : "border border-asphalt/15 text-asphalt"
                  }`}
                >
                  {h.label} ({h.n})
                </button>
              ))}
            </div>
            {hubKey ? (
              <JobsTubeMap
                jobs={hubJobs}
                driver={driver}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ) : (
              <p className="text-sm text-muted">
                Choose Manchester, Birmingham, London… to open the network view.
              </p>
            )}
          </div>
        )}

        {viewMode === "runs" && (
          <div className="space-y-3">
            {!possibleRuns.length ? (
              <p className="text-sm text-muted">
                Need at least 2 mapped jobs that chain (drop ≈ next collect) for
                run suggestions.
              </p>
            ) : (
              <ul className="space-y-3">
                {possibleRuns.map((run) => (
                  <li
                    key={run.id}
                    className="border border-asphalt/10 bg-white px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-display text-sm tracking-wide text-amber uppercase">
                          Possible run · {run.label}
                        </p>
                        <p className="mt-1 font-medium text-asphalt">
                          {run.stops.join(" → ")}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {run.jobs.length} jobs · {money(run.totalPay)} · ~
                          {run.extraMiles} mi loaded
                        </p>
                      </div>
                      <a
                        href="/run"
                        className="shrink-0 rounded-sm bg-amber px-3 py-2 text-[11px] font-semibold tracking-wide text-asphalt uppercase"
                      >
                        Build in Run →
                      </a>
                    </div>
                    <ul className="mt-3 space-y-1 border-t border-asphalt/10 pt-3 text-sm">
                      {run.jobs.map((j) => (
                        <li key={j.id} className="flex flex-wrap gap-2">
                          <span>
                            {shortPlace(j.origin)} → {shortPlace(j.destination)}
                            {j.rateTotal != null
                              ? ` · ${money(j.rateTotal)}`
                              : ""}
                          </span>
                          {j.href && (
                            <a
                              href={j.href}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-amber"
                            >
                              Shiply →
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Synced opportunity cards (Explore) */}
      {viewMode === "explore" && routes.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
            Best opportunities
          </h2>
          <p className="text-sm text-muted">
            Same routes as the map — tap to highlight.{" "}
            {routes.length} connections from {visible.length} jobs.
          </p>
          <ul className="space-y-2">
            {routes.slice(0, 12).map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRouteId(
                      selectedRouteId === r.id ? null : r.id,
                    );
                    setSelectedCityKey(r.destKey);
                    setSelectedDirection(null);
                  }}
                  className={`w-full border px-4 py-3 text-left transition ${
                    selectedRouteId === r.id
                      ? "border-amber bg-amber/5"
                      : "border-asphalt/10 bg-white hover:border-asphalt/25"
                  }`}
                >
                  <p className="font-medium text-asphalt">
                    {r.originLabel} → {r.destLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {r.jobCount} job{r.jobCount === 1 ? "" : "s"} ·{" "}
                    {money(r.totalPay)}
                    {r.avgMiles != null ? ` · ~${r.avgMiles} mi` : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Job list — was "Jobs on board" */}
      <section className="space-y-3">
        <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
          All jobs
        </h2>
        {!visible.length ? (
          <p className="text-sm text-muted">
            No jobs in this view yet. Scan Shiply and add them above.
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((job) => {
              const meta = mapStatusMeta[job.status];
              const active = job.id === selectedId;
              return (
                <li
                  key={job.id}
                  className={`border px-4 py-3 transition ${
                    active
                      ? "border-asphalt bg-white"
                      : "border-asphalt/10 bg-white/80 hover:border-asphalt/25"
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setSelectedId(job.id)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-asphalt">
                          {shortPlace(job.origin)} →{" "}
                          {shortPlace(job.destination)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {[
                            job.item,
                            job.miles != null ? `${job.miles} mi` : null,
                            job.rateTotal != null
                              ? money(job.rateTotal)
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-sm border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${meta.soft}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                  </button>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.href ? (
                      <a
                        href={job.href}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-sm border border-asphalt/20 px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase hover:bg-concrete/40"
                      >
                        Open on Shiply →
                      </a>
                    ) : (
                      <span className="px-1 py-1.5 text-[11px] text-muted">
                        No Shiply link from scan
                      </span>
                    )}
                    {job.status !== "won" && job.status !== "bidding" && (
                      <button
                        type="button"
                        onClick={() => setStatus(job.id, "bidding")}
                        className="rounded-sm bg-amber px-3 py-1.5 text-[11px] font-semibold tracking-wide text-asphalt uppercase"
                      >
                        Bidding
                      </button>
                    )}
                    {job.status !== "won" && (
                      <button
                        type="button"
                        onClick={() => setStatus(job.id, "won")}
                        className="rounded-sm bg-[#2f6b4f] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white uppercase"
                      >
                        I got this
                      </button>
                    )}
                    {job.status === "won" && (
                      <button
                        type="button"
                        onClick={() => setStatus(job.id, "hunting")}
                        className="rounded-sm border border-asphalt/20 px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase"
                      >
                        Back to hunt
                      </button>
                    )}
                    {job.status === "bidding" && (
                      <button
                        type="button"
                        onClick={() => setStatus(job.id, "hunting")}
                        className="rounded-sm border border-asphalt/15 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase"
                      >
                        Considering
                      </button>
                    )}
                    {job.status !== "skipped" && (
                      <button
                        type="button"
                        onClick={() => setStatus(job.id, "skipped")}
                        className="rounded-sm border border-asphalt/15 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase"
                      >
                        Skip
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeJob(job.id)}
                      className="rounded-sm px-3 py-1.5 text-[11px] font-semibold tracking-wide text-alert uppercase"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {jobs.some((j) => j.status === "skipped") && (
          <details className="pt-2 text-sm text-muted">
            <summary className="cursor-pointer font-medium text-asphalt">
              Skipped ({jobs.filter((j) => j.status === "skipped").length})
            </summary>
            <ul className="mt-2 space-y-1">
              {jobs
                .filter((j) => j.status === "skipped")
                .map((j) => (
                  <li
                    key={j.id}
                    className="flex flex-wrap items-center justify-between gap-2 border border-asphalt/10 px-3 py-2"
                  >
                    <span>
                      {shortPlace(j.origin)} → {shortPlace(j.destination)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStatus(j.id, "hunting")}
                      className="text-[11px] font-semibold tracking-wide uppercase text-amber"
                    >
                      Restore
                    </button>
                  </li>
                ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
