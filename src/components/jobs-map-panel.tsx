"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BoardJobCard } from "@/components/board-job-card";
import { JobBoardIngest } from "@/components/job-board-ingest";
import { JobsExploreMap } from "@/components/jobs-explore-map";
import { JobsLaneMatrix } from "@/components/jobs-lane-matrix";
import { JobsPlannerGrid } from "@/components/jobs-planner-grid";
import { useAuthGate } from "@/lib/auth-gate";
import { useMarket } from "@/lib/market-context";
import { openShiplyAuthGate, requiresSignInForIngestSource } from "@/lib/shiply-client-auth";
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
  removeMapJobsByIds,
  shortPlace,
  writeJobsMapState,
  type JobsMapDriver,
  type MapJob,
  type MapJobStatus,
} from "@/lib/jobs-map";
import { resolveUkPlace } from "@/lib/uk-places";
import { outlineBtnAlertClass, outlineBtnClass } from "@/lib/ui-buttons";

const SORTS: { id: SortMode; label: string }[] = [
  { id: "money", label: "Most money" },
  { id: "jobs", label: "Most jobs" },
  { id: "rpm", label: "Best £/mi" },
  { id: "distance", label: "Shortest" },
];

type MainTab = "jobs" | "run";
type JobsLook = "list" | "map" | "lanes";

type PendingRemove =
  | { mode: "one"; id: string }
  | { mode: "all-visible" }
  | { mode: "all-hidden" };

const LIST_PAGE_SIZE = 12;

export function JobsMapPanel() {
  const { money } = useMarket();
  const { isSignedIn, openGate, loading: authLoading } = useAuthGate();
  const [jobs, setJobs] = useState<MapJob[]>([]);
  const [driver, setDriver] = useState<JobsMapDriver | null>(null);
  const [home, setHome] = useState<JobsMapDriver | null>(null);
  const [startDraft, setStartDraft] = useState("");
  const [geoBusy, setGeoBusy] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("jobs");
  const [jobsLook, setJobsLook] = useState<JobsLook>("list");
  const [sortMode, setSortMode] = useState<SortMode>("money");
  const [selectedDirection, setSelectedDirection] =
    useState<DirectionId | null>(null);
  const [hubKey, setHubKey] = useState<string | null>(null);
  const [headingDraft, setHeadingDraft] = useState("");
  const [headingToward, setHeadingToward] = useState<string | null>(null);
  const [runPrefs, setRunPrefs] = useState<RunBuilderPrefs>(DEFAULT_RUN_PREFS);
  const [runChainIds, setRunChainIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [justHiddenId, setJustHiddenId] = useState<string | null>(null);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [listLimit, setListLimit] = useState(LIST_PAGE_SIZE);
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const hiddenSectionRef = useRef<HTMLDetailsElement | null>(null);
  const hideUndoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loaded = readJobsMapState();
    setJobs(loaded.jobs);
    setDriver(loaded.driver);
    setHome(loaded.home ?? loaded.driver);
    setStartDraft(loaded.driver?.label ?? "");
    setHydrated(true);
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "suggested" || tab === "chains" || tab === "run") {
        setMainTab("run");
      }
    }
  }, []);

  useEffect(() => {
    if (!hydrated || authLoading || isSignedIn) return;
    setJobs((prev) => {
      const next = prev.filter(
        (j) => j.ingestSource !== "scan",
      );
      if (next.length === prev.length) return prev;
      const stored = readJobsMapState();
      writeJobsMapState({ ...stored, jobs: next });
      return next;
    });
  }, [hydrated, authLoading, isSignedIn]);

  useEffect(() => {
    if (!hydrated) return;
    const prev = readJobsMapState();
    writeJobsMapState({ ...prev, jobs, driver, home });
  }, [jobs, driver, home, hydrated]);

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
      setStatusNote(`Start set to ${place.label}.`);
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

  function deleteJobs(ids: string[]) {
    if (!ids.length) return;
    setJobs((prev) => {
      const stored = readJobsMapState();
      const nextState = removeMapJobsByIds(
        { ...stored, jobs: prev },
        ids,
      );
      writeJobsMapState(nextState);
      return nextState.jobs;
    });
    setRunChainIds((prev) => prev.filter((id) => !ids.includes(id)));
    if (justHiddenId && ids.includes(justHiddenId)) clearHideUndo();
  }

  function requestRemoveJob(id: string) {
    setPendingRemove({ mode: "one", id });
  }

  function requestRemoveAllVisible() {
    if (!visible.length) return;
    setPendingRemove({ mode: "all-visible" });
  }

  function requestRemoveAllHidden() {
    if (!hiddenJobs.length) return;
    setPendingRemove({ mode: "all-hidden" });
  }

  function confirmRemove() {
    if (!pendingRemove) return;
    if (pendingRemove.mode === "one") {
      deleteJobs([pendingRemove.id]);
      const job = jobs.find((j) => j.id === pendingRemove.id);
      if (job) {
        setStatusNote(
          `Removed ${shortPlace(job.origin)} → ${shortPlace(job.destination)} from the board.`,
        );
      }
    } else if (pendingRemove.mode === "all-visible") {
      const count = visible.length;
      deleteJobs(visible.map((j) => j.id));
      setStatusNote(
        `Removed ${count} job${count === 1 ? "" : "s"} from Hunt and Chains.`,
      );
    } else {
      const count = hiddenJobs.length;
      deleteJobs(hiddenJobs.map((j) => j.id));
      setStatusNote(
        `Removed ${count} hidden job${count === 1 ? "" : "s"} permanently.`,
      );
    }
    setPendingRemove(null);
    setError(null);
  }

  const pendingRemoveJob =
    pendingRemove?.mode === "one"
      ? jobs.find((j) => j.id === pendingRemove.id) ?? null
      : null;

  function hideJob(id: string) {
    setJobs((prev) => {
      const next = prev.map((j) =>
        j.id === id
          ? {
              ...j,
              status: "skipped" as MapJobStatus,
              updatedAt: new Date().toISOString(),
            }
          : j,
      );
      const stored = readJobsMapState();
      writeJobsMapState({
        ...stored,
        jobs: next,
        todayRunIds: (stored.todayRunIds ?? []).filter((x) => x !== id),
      });
      return next;
    });
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
      prev.map((j) =>
        j.id === id
          ? { ...j, myBid, updatedAt: new Date().toISOString() }
          : j,
      ),
    );
  }

  function startBidding(id: string) {
    setJobStatus(id, "bidding");
    const job = jobs.find((j) => j.id === id);
    if (job) {
      setStatusNote(
        `Tracking ${shortPlace(job.origin)} → ${shortPlace(job.destination)} in My Jobs → Bidding.`,
      );
    }
  }

  function setJobStatus(id: string, status: MapJobStatus) {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, status, updatedAt: new Date().toISOString() }
          : j,
      ),
    );
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


  function addIngestedJobs(
    picked: Array<{
      id: string;
      origin: string | null;
      destination: string | null;
      miles: number | null;
      rateTotal: number | null;
      item: string | null;
      href?: string | null;
      ingestSource?: "scan" | "screenshot" | "manual" | "paste";
    }>,
  ) {
    if (!startReady) {
      setError("Set your starting location before adding jobs to the board.");
      return;
    }
    if (!picked.length) return;
    if (
      !authLoading &&
      !isSignedIn &&
      picked.some((j) => j.ingestSource && requiresSignInForIngestSource(j.ingestSource))
    ) {
      openShiplyAuthGate(openGate);
      setError("Sign in to add live-scanned jobs to Hunt.");
      return;
    }
    setJobs((prev) => mergeScannedJobs(prev, picked));
    setStatusNote(
      `Added ${picked.length} job${picked.length === 1 ? "" : "s"} to Hunt.`,
    );
    setError(null);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl tracking-wide text-asphalt uppercase sm:text-3xl">
            Job Board
          </h1>
          <p className="mt-1 text-sm text-muted">
            Hunt new jobs · Compare chains · Track wins in My Jobs
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

            <JobBoardIngest
              startLabel={driver?.label ?? ""}
              startReady={startReady}
              onAddJobs={addIngestedJobs}
            />

            {statusNote ? (
              <p className="text-sm text-asphalt">{statusNote}</p>
            ) : null}
            {error && <p className="text-sm text-alert">{error}</p>}
        </div>
      </section>

      {/* Hunt | Suggested — sticky under site header */}
      <section className="space-y-4">
        <div className="page-sticky-bar -mx-5 min-w-0 space-y-3 overflow-x-clip border-b border-asphalt/10 px-5 pb-3 pt-1 sm:-mx-8 sm:space-y-3 sm:px-8 sm:pb-3">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
                {mainTab === "jobs" && jobsLook === "list"
                  ? "Hunt"
                  : mainTab === "run"
                    ? "Chains"
                    : `${visible.length} to review`}
              </h2>
              <p className="mt-1 text-base leading-relaxed text-muted sm:text-sm">
                {mainTab === "jobs" && jobsLook === "list"
                  ? visible.length > listShown.length
                    ? `Showing ${listShown.length} of ${visible.length} — enter a quote, then Start bidding (→ My Jobs), hide, or remove.`
                    : "Enter a quote, then Start bidding to track in My Jobs — or hide / remove."
                  : mainTab === "jobs"
                    ? "Considering jobs only — bidding jobs live in My Jobs."
                    : "Compare chains — enter quotes and Start bidding here (same jobs as Hunt)."}
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
                  { id: "run" as const, label: "Chains" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={mainTab === t.id}
                  onClick={() => setMainTab(t.id)}
                  className={`px-3 py-2.5 text-xs font-semibold tracking-normal uppercase sm:px-5 sm:py-2 sm:text-xs sm:tracking-wide ${
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
              <span className="text-xs font-semibold tracking-normal text-muted uppercase sm:text-[10px] sm:tracking-wide">
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
                  className={`rounded-sm border-2 px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ${
                    jobsLook === v.id
                      ? "border-asphalt bg-asphalt text-white"
                      : "border-asphalt/40 bg-white text-asphalt/70 hover:border-asphalt hover:bg-concrete/50 hover:text-asphalt"
                  }`}
                >
                  {v.label}
                </button>
              ))}
              {visible.length > 0 ? (
                <button
                  type="button"
                  onClick={requestRemoveAllVisible}
                  className={outlineBtnAlertClass("sm")}
                >
                  Remove all ({visible.length})
                </button>
              ) : null}
            </div>
          )}

          {mainTab === "run" && visible.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={requestRemoveAllVisible}
                className={outlineBtnAlertClass("sm")}
              >
                Remove all from board ({visible.length})
              </button>
            </div>
          ) : null}
        </div>


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
              . Restore from Hidden below, or find it in{" "}
              <Link href="/jobs?tab=skipped" className="font-semibold text-amber">
                My Jobs → Hidden
              </Link>
              .
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
            No jobs on the board yet — add jobs above via screenshots, manual
            entry, or live scan.
          </p>
        )}

        {mainTab === "jobs" && jobsLook === "list" && !visible.length && hiddenJobs.length > 0 && (
          <p className="text-sm text-muted">
            No jobs on the board — restore one from Hidden jobs below, or add
            more via screenshots / manual entry above.
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
                  onSetBid={(myBid) => setMyBid(job.id, myBid)}
                  onStartBidding={() => startBidding(job.id)}
                  onHide={() => hideJob(job.id)}
                  onRemove={() => requestRemoveJob(job.id)}
                  onFocusJob={focusBoardJob}
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
              Passed for now — restore to bid again, or remove permanently.
              Same list as Hidden on{" "}
              <Link
                href="/jobs?tab=skipped"
                className="font-semibold text-amber hover:text-asphalt"
              >
                My Jobs
              </Link>
              .
            </p>
            {hiddenJobs.length > 0 ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={requestRemoveAllHidden}
                  className={outlineBtnAlertClass("sm")}
                >
                  Remove all hidden ({hiddenJobs.length})
                </button>
              </div>
            ) : null}
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
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => restoreJob(j.id)}
                      className={`shrink-0 ${outlineBtnClass("amber", "sm")}`}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => requestRemoveJob(j.id)}
                      className={outlineBtnAlertClass("sm")}
                    >
                      Remove
                    </button>
                  </div>
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
              Direction clusters on your board — tap a circle to list jobs in
              that direction. Enter your bid on each job below.
            </p>
            <JobsExploreMap
              jobs={exploreJobs}
              driver={driver}
              selectedDirection={selectedDirection}
              onSelectDirection={setSelectedDirection}
              formatMoney={money}
              onSetBid={setMyBid}
            />
          </div>
        )}

        {mainTab === "run" && (
          <div className="space-y-3">
            <p className="border border-asphalt/10 bg-white px-4 py-3 text-sm text-asphalt">
              Same jobs as Hunt — enter quotes below and tap{" "}
              <strong className="font-semibold">Start bidding</strong> to track
              in{" "}
              <Link href="/jobs?tab=bidding" className="font-semibold text-amber">
                My Jobs
              </Link>
              . Wins land in Today&apos;s run automatically.
            </p>
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
              onStartBidding={startBidding}
              onRemoveJob={requestRemoveJob}
            />
          </div>
        )}
      </section>

      {pendingRemove && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-asphalt/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="board-remove-job-title"
          onClick={() => setPendingRemove(null)}
        >
          <div
            className="animate-slide-up w-full max-w-md border border-asphalt/10 bg-background p-6 shadow-2xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-xs tracking-[0.2em] text-alert uppercase">
              Remove from board
            </p>
            <h2
              id="board-remove-job-title"
              className="mt-2 font-display text-2xl tracking-wide text-asphalt uppercase"
            >
              Are you sure?
            </h2>
            <p className="mt-3 text-sm text-muted">
              {pendingRemove.mode === "one" && pendingRemoveJob ? (
                <>
                  Remove{" "}
                  <span className="font-semibold text-asphalt">
                    {shortPlace(pendingRemoveJob.origin)} →{" "}
                    {shortPlace(pendingRemoveJob.destination)}
                  </span>{" "}
                  permanently from Hunt and Chains? Use Hide if you might want
                  it again.
                </>
              ) : pendingRemove.mode === "all-visible" ? (
                <>
                  Remove all{" "}
                  <span className="font-semibold text-asphalt">
                    {visible.length} job{visible.length === 1 ? "" : "s"}
                  </span>{" "}
                  from Hunt and Chains? This cannot be undone.
                </>
              ) : (
                <>
                  Remove all{" "}
                  <span className="font-semibold text-asphalt">
                    {hiddenJobs.length} hidden job
                    {hiddenJobs.length === 1 ? "" : "s"}
                  </span>{" "}
                  permanently? This cannot be undone.
                </>
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPendingRemove(null)}
                className={outlineBtnClass("muted")}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                className="rounded-sm bg-alert px-4 py-2.5 text-xs font-semibold tracking-wide text-white uppercase"
              >
                Remove permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}