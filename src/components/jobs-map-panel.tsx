"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BoardJobCard } from "@/components/board-job-card";
import { TodayRunBar } from "@/components/today-run-bar";
import { ShiplyLiveView } from "@/components/shiply-live-view";
import { JobsExploreMap } from "@/components/jobs-explore-map";
import { JobsLaneMatrix } from "@/components/jobs-lane-matrix";
import { JobsPlannerGrid } from "@/components/jobs-planner-grid";
import { useMarket } from "@/lib/market-context";
import {
  buildRouteConnections,
  classifyJobsByCorridor,
  sortConnections,
  unmappedJobs,
  type DirectionId,
  type SortMode,
} from "@/lib/jobs-map-explore";
import {
  DEFAULT_RUN_PREFS,
  type RunBuilderPrefs,
} from "@/lib/jobs-run-builder";
import {
  huntBoardJobs,
  mergeScannedJobs,
  placeKey,
  readJobsMapState,
  shortPlace,
  writeJobsMapState,
  type JobsMapDriver,
  type MapJob,
  type MapJobStatus,
} from "@/lib/jobs-map";
import {
  appendTodayRunId,
  driverAtJobDrop,
  orderTodayRun,
  pruneTodayRunIds,
} from "@/lib/jobs-today-run";
import { resolveUkPlace } from "@/lib/uk-places";
import type { VisibleShiplyJob } from "@/lib/run-shortlist";
import {
  diffAgainstLastScan,
  formatLastScan,
  jobFingerprint,
  readLastScanSnapshot,
  scanSummaryMessage,
  writeLastScanSnapshot,
} from "@/lib/shiply-scan-snapshot";

const CONTEXT_KEY = "tlm_shiply_bb_context";

const SORTS: { id: SortMode; label: string }[] = [
  { id: "money", label: "Most money" },
  { id: "jobs", label: "Most jobs" },
  { id: "rpm", label: "Best £/mi" },
  { id: "distance", label: "Shortest" },
];

type MainTab = "jobs" | "run";
type JobsLook = "list" | "map" | "lanes";

const LIST_PAGE_SIZE = 12;

export function JobsMapPanel() {
  const { money } = useMarket();
  const [jobs, setJobs] = useState<MapJob[]>([]);
  const [driver, setDriver] = useState<JobsMapDriver | null>(null);
  const [home, setHome] = useState<JobsMapDriver | null>(null);
  const [todayRunIds, setTodayRunIds] = useState<string[]>([]);
  const [startDraft, setStartDraft] = useState("");
  const [geoBusy, setGeoBusy] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("jobs");
  const [jobsLook, setJobsLook] = useState<JobsLook>("list");
  const [sortMode, setSortMode] = useState<SortMode>("money");
  const [selectedDirection, setSelectedDirection] =
    useState<DirectionId | null>(null);
  const [selectedCityKey, setSelectedCityKey] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [hubKey, setHubKey] = useState<string | null>(null);
  const [headingDraft, setHeadingDraft] = useState("");
  const [headingToward, setHeadingToward] = useState<string | null>(null);
  const [runPrefs, setRunPrefs] = useState<RunBuilderPrefs>(DEFAULT_RUN_PREFS);
  const [runChainIds, setRunChainIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coach, setCoach] = useState<string | null>(null);
  const [scanned, setScanned] = useState<VisibleShiplyJob[]>([]);
  const [selectedScan, setSelectedScan] = useState<Record<string, boolean>>({});
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [newScanFingerprints, setNewScanFingerprints] = useState<Set<string>>(
    () => new Set(),
  );
  const [scanSummary, setScanSummary] = useState<string | null>(null);
  const [justHiddenId, setJustHiddenId] = useState<string | null>(null);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [listLimit, setListLimit] = useState(LIST_PAGE_SIZE);
  const hiddenSectionRef = useRef<HTMLDetailsElement | null>(null);
  const hideUndoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loaded = readJobsMapState();
    setJobs(loaded.jobs);
    setDriver(loaded.driver);
    setHome(loaded.home ?? loaded.driver);
    setTodayRunIds(loaded.todayRunIds ?? []);
    setStartDraft(loaded.driver?.label ?? "");
    setHydrated(true);
    void fetch("/api/run/shiply/session")
      .then((r) => r.json())
      .then((d: { enabled?: boolean }) => setEnabled(Boolean(d.enabled)))
      .catch(() => setEnabled(false));
    const prev = readLastScanSnapshot();
    if (prev) setLastScanAt(prev.scannedAt);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeJobsMapState({ jobs, driver, home, todayRunIds });
  }, [jobs, driver, home, todayRunIds, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    setTodayRunIds((ids) => {
      const pruned = pruneTodayRunIds(ids, jobs);
      if (
        pruned.length === ids.length &&
        pruned.every((id, index) => id === ids[index])
      ) {
        return ids;
      }
      return pruned;
    });
  }, [jobs, hydrated]);

  const todayRunJobs = useMemo(
    () => orderTodayRun(todayRunIds, jobs),
    [todayRunIds, jobs],
  );

  const visible = huntBoardJobs(jobs);
  const listShown = useMemo(
    () => visible.slice(0, listLimit),
    [visible, listLimit],
  );
  const listRemaining = Math.max(0, visible.length - listShown.length);
  const hiddenJobs = useMemo(
    () => jobs.filter((j) => j.status === "skipped"),
    [jobs],
  );
  const justHiddenJob = justHiddenId
    ? hiddenJobs.find((j) => j.id === justHiddenId) ?? null
    : null;
  const startReady = Boolean(driver?.label.trim());

  useEffect(() => {
    return () => {
      if (hideUndoTimer.current) clearTimeout(hideUndoTimer.current);
    };
  }, []);

  const corridorGroups = useMemo(
    () => classifyJobsByCorridor(visible, driver, headingToward),
    [visible, driver, headingToward],
  );

  const exploreJobs = useMemo(() => {
    if (!headingToward) return visible;
    const onRoute = corridorGroups.find((g) => g.id === "on_route");
    const detour = corridorGroups.find((g) => g.id === "detour");
    const combined = [...(onRoute?.jobs ?? []), ...(detour?.jobs ?? [])];
    return combined.length ? combined : visible;
  }, [visible, headingToward, corridorGroups]);

  const routes = useMemo(
    () => sortConnections(buildRouteConnections(exploreJobs), sortMode),
    [exploreJobs, sortMode],
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
      setHome(null);
      setStartDraft("");
      return;
    }
    const resolved =
      lat != null && lon != null
        ? { lat, lon }
        : resolveUkPlace(trimmed);
    const nextDriver = {
      label: trimmed,
      lat: resolved?.lat ?? lat,
      lon: resolved?.lon ?? lon,
    };
    setHome(nextDriver);
    setDriver(nextDriver);
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

  function clearHideUndo() {
    if (hideUndoTimer.current) {
      clearTimeout(hideUndoTimer.current);
      hideUndoTimer.current = null;
    }
    setJustHiddenId(null);
  }

  function hideJob(id: string) {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? {
              ...j,
              status: "skipped" as MapJobStatus,
              updatedAt: new Date().toISOString(),
            }
          : j,
      ),
    );
    setTodayRunIds((ids) => ids.filter((x) => x !== id));
    setJustHiddenId(id);
    if (hideUndoTimer.current) clearTimeout(hideUndoTimer.current);
    hideUndoTimer.current = setTimeout(() => {
      setJustHiddenId(null);
      hideUndoTimer.current = null;
    }, 8000);
  }

  function restoreJob(id: string) {
    setJobStatus(id, "hunting");
    if (justHiddenId === id) clearHideUndo();
  }

  function showHiddenJobs() {
    setMainTab("jobs");
    setJobsLook("list");
    setHiddenOpen(true);
    window.setTimeout(() => {
      hiddenSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  }

  function setMyBid(id: string, myBid: number | null) {
    setJobs((prev) =>
      prev.map((j) => {
        if (j.id !== id) return j;
        const next: MapJob = {
          ...j,
          myBid,
          updatedAt: new Date().toISOString(),
        };
        if (myBid != null && myBid > 0 && j.status === "hunting") {
          next.status = "bidding";
        }
        return next;
      }),
    );
  }

  function setJobStatus(id: string, status: MapJobStatus) {
    setJobs((prev) => {
      const nextJobs = prev.map((j) =>
        j.id === id
          ? { ...j, status, updatedAt: new Date().toISOString() }
          : j,
      );
      if (status === "won") {
        const won = nextJobs.find((j) => j.id === id);
        if (won) {
          setTodayRunIds((ids) => appendTodayRunId(ids, id));
          const atDrop = driverAtJobDrop(won);
          if (atDrop) setDriver(atDrop);
        }
      }
      if (status === "delivered") {
        const done = nextJobs.find((j) => j.id === id);
        setTodayRunIds((ids) => ids.filter((x) => x !== id));
        if (done) {
          const atDrop = driverAtJobDrop(done);
          if (atDrop) setDriver(atDrop);
        }
      }
      if (status === "skipped") {
        setTodayRunIds((ids) => ids.filter((x) => x !== id));
      }
      return nextJobs;
    });
  }

  function markDelivered(id: string) {
    setJobStatus(id, "delivered");
  }

  function addToTodayRun(id: string) {
    setTodayRunIds((ids) => appendTodayRunId(ids, id));
  }

  function removeFromTodayRun(id: string) {
    setTodayRunIds((ids) => ids.filter((x) => x !== id));
  }

  function focusBoardJob(id: string) {
    const index = visible.findIndex((j) => j.id === id);
    if (index >= 0 && index >= listLimit) {
      setListLimit(index + 1);
    }
    window.setTimeout(() => {
      const el = document.getElementById(`board-job-${id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-amber", "ring-offset-2");
      window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-amber", "ring-offset-2");
      }, 1800);
    }, 50);
  }

  function resetDriverToHome() {
    if (home) setDriver({ ...home });
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
      const previous = readLastScanSnapshot();
      const diff = diffAgainstLastScan(previous, list);
      const scannedAt = new Date().toISOString();
      writeLastScanSnapshot(list);
      setLastScanAt(scannedAt);
      setNewScanFingerprints(diff.newFingerprints);
      setScanSummary(scanSummaryMessage(diff, list.length, scannedAt));
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

  const todayRunBar = (
    <TodayRunBar
      jobs={jobs}
      todayRunIds={todayRunIds}
      home={home}
      driver={driver}
      hiddenCount={hiddenJobs.length}
      highlightHidden={Boolean(justHiddenId)}
      onResetToHome={resetDriverToHome}
      onOpenRun={() => setMainTab("run")}
      onShowHidden={showHiddenJobs}
      onRemoveFromRun={removeFromTodayRun}
      onMarkDelivered={markDelivered}
      onMarkWon={(id) => setJobStatus(id, "won")}
      onSetBid={setMyBid}
    />
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl tracking-wide text-asphalt uppercase sm:text-3xl">
            Job Board
          </h1>
          <p className="mt-1 text-sm text-muted">
            Hunt jobs · Suggested chains · Today&apos;s run
          </p>
        </div>
      </header>

      {/* Start location + Shiply — always open */}
      <section className="border border-asphalt/10 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
          <div className="min-w-0 flex-1 text-sm text-asphalt">
            <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">
              Start
            </span>{" "}
            {startReady ? (
              <span className="font-medium">{driver!.label}</span>
            ) : (
              <span className="text-alert">Not set — required</span>
            )}
            {sessionId ? (
              <span className="ml-2 text-xs text-amber">· Shiply connected</span>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 border-t border-asphalt/10 px-3 py-4 sm:px-4">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                Where are you starting?
              </p>
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
                  className="w-full flex-1 border border-asphalt/15 bg-concrete/20 px-3 py-2 text-sm text-asphalt outline-none focus:border-amber"
                />
                <button
                  type="button"
                  disabled={geoBusy}
                  onClick={() => void useMyLocation()}
                  className="shrink-0 rounded-sm border border-asphalt/20 px-3 py-2 text-[10px] font-semibold tracking-wide uppercase disabled:opacity-60"
                >
                  {geoBusy ? "Locating…" : "GPS"}
                </button>
                <button
                  type="button"
                  onClick={() => applyStart(startDraft, null, null)}
                  className="shrink-0 rounded-sm bg-asphalt px-3 py-2 text-[10px] font-semibold tracking-wide text-white uppercase"
                >
                  Set start
                </button>
              </div>
            </div>

            <div className="space-y-3 border-t border-asphalt/10 pt-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                    Scan from Shiply
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Connect → scan → add to board
                  </p>
                </div>
                {enabled && !sessionId ? (
                  <button
                    type="button"
                    disabled={busy || !startReady}
                    onClick={() => void startSession()}
                    className="rounded-sm bg-asphalt px-4 py-2 text-[11px] font-semibold tracking-wide text-white uppercase disabled:opacity-60"
                  >
                    {busy ? "Opening…" : "Connect Shiply →"}
                  </button>
                ) : null}
              </div>

              {enabled === false && (
                <p className="border border-dashed border-asphalt/20 bg-concrete/30 px-3 py-2 text-xs text-muted">
                  Browserbase not configured — add{" "}
                  <code className="text-[10px]">BROWSERBASE_API_KEY</code> /{" "}
                  <code className="text-[10px]">BROWSERBASE_PROJECT_ID</code>.
                </p>
              )}

              {enabled && sessionId && (
                <div className="space-y-3">
                  {liveViewUrl && (
                    <ShiplyLiveView
                      url={liveViewUrl}
                      collapseSignal={scanSummary}
                    />
                  )}
                  <div className="sticky bottom-2 z-10 flex flex-wrap gap-2 border border-asphalt/10 bg-white/95 p-2 shadow-sm backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void scanVisible()}
                      className="rounded-sm bg-amber px-4 py-2 text-[11px] font-semibold tracking-wide text-asphalt uppercase disabled:opacity-60"
                    >
                      {busy ? "Scanning…" : "Scan visible jobs"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void startSession()}
                      className="rounded-sm border border-asphalt/20 px-4 py-2 text-[11px] font-semibold tracking-wide uppercase disabled:opacity-60"
                    >
                      New session
                    </button>
                  </div>
                  {lastScanAt && !scanSummary && (
                    <p className="text-xs text-muted">
                      Last scan {formatLastScan(lastScanAt)}
                    </p>
                  )}
                </div>
              )}

              {scanSummary && (
                <p
                  className={`text-sm ${
                    newScanFingerprints.size > 0
                      ? "border-l-4 border-amber bg-amber/10 px-3 py-2 font-medium text-asphalt"
                      : "text-muted"
                  }`}
                >
                  {scanSummary}
                </p>
              )}

              {coach && <p className="text-sm text-asphalt">{coach}</p>}

              {scanned.length > 0 && (
                <div className="space-y-3 border-t border-asphalt/10 pt-3">
                  <p className="text-[10px] font-semibold tracking-wide text-asphalt uppercase">
                    Add to map (
                    {Object.values(selectedScan).filter(Boolean).length}{" "}
                    selected)
                  </p>
                  <ul className="max-h-40 space-y-2 overflow-y-auto">
                    {scanned.map((job) => {
                      const isNew = newScanFingerprints.has(
                        jobFingerprint(job),
                      );
                      return (
                        <li key={job.id}>
                          <label className="flex cursor-pointer gap-3 border border-asphalt/10 px-3 py-2 hover:bg-concrete/30">
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
                                {shortPlace(job.origin)} →{" "}
                                {shortPlace(job.destination)}
                                {isNew && (
                                  <span className="ml-2 rounded-sm bg-amber px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-asphalt uppercase">
                                    New
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block text-xs text-muted">
                                {[
                                  job.item,
                                  job.miles != null
                                    ? `${job.miles} mi`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => addScannedToMap(true)}
                      className="rounded-sm bg-amber px-4 py-2 text-[11px] font-semibold tracking-wide text-asphalt uppercase"
                    >
                      Add all {scanned.length} to map →
                    </button>
                    <button
                      type="button"
                      onClick={() => addScannedToMap(false)}
                      className="rounded-sm border border-asphalt/20 px-4 py-2 text-[11px] font-semibold tracking-wide uppercase"
                    >
                      Add selected only
                    </button>
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-alert">{error}</p>}
            </div>
        </div>
      </section>

      {/* Hunt | Suggested — sticky under site header */}
      <section className="space-y-4">
        <div className="page-sticky-bar -mx-5 min-w-0 space-y-3 overflow-x-clip border-b border-asphalt/10 px-5 pb-3 pt-1 sm:-mx-8 sm:space-y-3 sm:px-8 sm:pb-3">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
                {mainTab === "jobs" && jobsLook === "list"
                  ? "Open jobs"
                  : mainTab === "run"
                    ? "Suggested chains"
                    : `${visible.length} open jobs`}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {mainTab === "jobs" && jobsLook === "list"
                  ? visible.length > listShown.length
                    ? `Showing ${listShown.length} of ${visible.length} — enter a quote, hide, or add to today's run. Load more below.`
                    : "Enter a quote to see after-fee net and verdict — then keep, bid on Shiply, or hide."
                  : mainTab === "jobs"
                    ? "Explore open jobs — enter bids on List, Map, or Lanes."
                    : "Pick a chain, then Use as today's run to bid and win from the yellow bar."}
              </p>
            </div>
            <div
              className="inline-flex max-w-full flex-wrap border border-asphalt/15 bg-white"
              role="toolbar"
              aria-label="Job Board tabs"
            >
              {(
                [
                  { id: "jobs" as const, label: "Hunt" },
                  { id: "run" as const, label: "Suggested" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={mainTab === t.id}
                  onClick={() => setMainTab(t.id)}
                  className={`px-3 py-2 text-[11px] font-semibold tracking-wide uppercase sm:px-5 sm:text-xs ${
                    mainTab === t.id
                      ? "bg-amber text-asphalt"
                      : "text-asphalt/70 hover:bg-concrete/50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {mainTab === "jobs" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                View
              </span>
              {(
                [
                  { id: "list" as const, label: "List" },
                  { id: "map" as const, label: "Map" },
                  { id: "lanes" as const, label: "Lanes" },
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setJobsLook(v.id)}
                  className={`rounded-sm px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ${
                    jobsLook === v.id
                      ? "bg-asphalt text-white"
                      : "text-asphalt/60 hover:bg-concrete/50 hover:text-asphalt"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0">{todayRunBar}</div>

        {mainTab === "jobs" && jobsLook === "list" && justHiddenJob && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 border border-asphalt/15 bg-white px-3 py-2.5 text-sm text-asphalt"
          >
            <p>
              Hidden{" "}
              <span className="font-medium">
                {shortPlace(justHiddenJob.origin)} →{" "}
                {shortPlace(justHiddenJob.destination)}
              </span>
              . Use Hidden jobs in Today&apos;s run above when you want it back.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => restoreJob(justHiddenJob.id)}
                className="rounded-sm bg-asphalt px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white uppercase"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={showHiddenJobs}
                className="rounded-sm border border-asphalt/20 px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase"
              >
                View hidden
              </button>
            </div>
          </div>
        )}

        {mainTab === "jobs" && jobsLook === "list" && !startReady && visible.length > 0 && (
          <p className="border border-amber/30 bg-amber/10 px-3 py-2 text-sm text-asphalt">
            Set your start location above so each job can show empty miles to
            pickup.
          </p>
        )}

        {mainTab === "jobs" && jobsLook === "list" && !visible.length && !hiddenJobs.length && (
          <p className="text-sm text-muted">
            No jobs on the board yet. Scan Shiply and add them above.
          </p>
        )}

        {mainTab === "jobs" && jobsLook === "list" && !visible.length && hiddenJobs.length > 0 && (
          <p className="text-sm text-muted">
            No jobs on the board — restore one from Hidden jobs below, or scan
            Shiply above.
          </p>
        )}

        {mainTab === "jobs" && jobsLook === "list" && visible.length > 0 && (
          <>
            <ul className="border-y border-asphalt/10">
              {listShown.map((job) => (
                <BoardJobCard
                  key={job.id}
                  job={job}
                  driver={driver}
                  allJobs={visible}
                  todayRunJobs={todayRunJobs}
                  todayRunIds={todayRunIds}
                  runLookupJobs={jobs}
                  home={home}
                  onSetBid={(myBid) => setMyBid(job.id, myBid)}
                  onMarkWon={() => setJobStatus(job.id, "won")}
                  onHide={() => hideJob(job.id)}
                  onAddToRun={() => addToTodayRun(job.id)}
                  onRemoveFromRun={() => removeFromTodayRun(job.id)}
                  onFocusJob={focusBoardJob}
                  onAddJobToRun={addToTodayRun}
                />
              ))}
            </ul>
            {listRemaining > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border border-asphalt/10 bg-white px-4 py-3">
                <p className="text-sm text-muted">
                  {listRemaining} more on the board
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setListLimit((n) => n + LIST_PAGE_SIZE)
                    }
                    className="rounded-sm bg-asphalt px-4 py-2 text-xs font-semibold tracking-wide text-white uppercase"
                  >
                    Load more
                  </button>
                  <button
                    type="button"
                    onClick={() => setListLimit(visible.length)}
                    className="rounded-sm border border-asphalt/20 px-4 py-2 text-xs font-semibold tracking-wide uppercase"
                  >
                    Show all ({visible.length})
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {mainTab === "jobs" && jobsLook === "list" && hiddenJobs.length > 0 && (
          <details
            ref={hiddenSectionRef}
            id="hidden-jobs"
            className="scroll-mt-40 border border-asphalt/10 bg-white px-4 py-3 text-sm text-muted"
            open={hiddenOpen}
            onToggle={(e) => setHiddenOpen(e.currentTarget.open)}
          >
            <summary className="cursor-pointer font-medium text-asphalt">
              Hidden jobs ({hiddenJobs.length}) — tap to restore
            </summary>
            <p className="mt-2 text-xs">
              Passed for now — restore to bid again. Same list as Hidden on{" "}
              <Link
                href="/jobs?tab=skipped"
                className="font-semibold text-amber hover:text-asphalt"
              >
                My Jobs
              </Link>
              .
            </p>
            <ul className="mt-2 space-y-1">
              {hiddenJobs.map((j) => (
                <li
                  key={j.id}
                  className={`flex flex-wrap items-center justify-between gap-2 border px-3 py-2 ${
                    j.id === justHiddenId
                      ? "border-amber/50 bg-amber/10"
                      : "border-asphalt/10 bg-white"
                  }`}
                >
                  <span className="text-asphalt">
                    {shortPlace(j.origin)} → {shortPlace(j.destination)}
                    {j.myBid != null && j.myBid > 0 ? (
                      <span className="ml-2 text-muted">
                        · quote {money(j.myBid)}
                      </span>
                    ) : null}
                    {j.item ? (
                      <span className="mt-0.5 block text-xs text-muted">
                        {j.item}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => restoreJob(j.id)}
                    className="shrink-0 text-[11px] font-semibold tracking-wide text-amber uppercase hover:text-asphalt"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        {mainTab === "jobs" && jobsLook === "lanes" && (
          <JobsLaneMatrix
            jobs={visible}
            driver={driver}
            formatMoney={money}
            onSetBid={setMyBid}
            onAddToRun={(laneJobs) => {
              setRunChainIds(laneJobs.map((j) => j.id));
              setMainTab("run");
            }}
          />
        )}

        {mainTab === "jobs" && jobsLook === "map" && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Direction clusters on your board — tap a route, then enter your
              bid on each job.
            </p>
            <JobsExploreMap
              jobs={exploreJobs}
              driver={driver}
              selectedDirection={selectedDirection}
              selectedCityKey={selectedCityKey}
              selectedRouteId={selectedRouteId}
              onSelectDirection={setSelectedDirection}
              onSelectCity={setSelectedCityKey}
              onSelectRoute={setSelectedRouteId}
              formatMoney={money}
              onSetBid={setMyBid}
            />
          </div>
        )}

        {mainTab === "run" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border border-asphalt/10 bg-white px-4 py-3 text-sm text-asphalt">
              <p>
                These are suggestions only. Push one into Today&apos;s run to
                bid, or track wins on My Jobs.
              </p>
              <Link
                href="/jobs?tab=won"
                className="rounded-sm bg-asphalt px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white uppercase"
              >
                My Jobs → Won
              </Link>
            </div>
            {visible.filter((j) => j.myBid != null && j.myBid > 0).length ===
              0 && (
              <div className="border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-asphalt">
                No bids yet — enter quotes on the jobs in a suggested run below
                (or on List / Map / Lanes) so revenue and £/mi make sense.
              </div>
            )}
            <JobsPlannerGrid
              jobs={visible}
              driver={driver}
              formatMoney={money}
              runPrefs={runPrefs}
              initialChainIds={runChainIds}
              runOnly
              onSetBid={setMyBid}
              onMarkWon={(id) => setJobStatus(id, "won")}
              todayRunIds={todayRunIds}
              onAddJobToTodayRun={addToTodayRun}
              onCommitToTodayRun={(ids) => {
                setTodayRunIds(ids);
                setMainTab("jobs");
                setJobsLook("list");
              }}
            />
          </div>
        )}
      </section>
    </div>
  );
}