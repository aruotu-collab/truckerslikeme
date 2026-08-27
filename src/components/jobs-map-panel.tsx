"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { JobsExploreMap } from "@/components/jobs-explore-map";
import { JobBidField } from "@/components/job-bid-field";
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
  mapStatusMeta,
  mergeScannedJobs,
  placeKey,
  readJobsMapState,
  shortPlace,
  writeJobsMapState,
  type JobsMapDriver,
  type MapJob,
  type MapJobStatus,
} from "@/lib/jobs-map";
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

export function JobsMapPanel() {
  const { money } = useMarket();
  const [jobs, setJobs] = useState<MapJob[]>([]);
  const [driver, setDriver] = useState<JobsMapDriver | null>(null);
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
    const prev = readLastScanSnapshot();
    if (prev) setLastScanAt(prev.scannedAt);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeJobsMapState({ jobs, driver });
  }, [jobs, driver, hydrated]);

  const visible = huntBoardJobs(jobs);
  const startReady = Boolean(driver?.label.trim());

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

  function removeJob(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
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
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, status, updatedAt: new Date().toISOString() }
          : j,
      ),
    );
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
          Scan what&apos;s on Shiply near you, compare lanes, and build a run.
          Enter bids and track wins in{" "}
          <Link href="/jobs" className="font-semibold text-amber hover:text-asphalt">
            My Jobs
          </Link>
          .
        </p>
      </header>

      {/* Start location */}
      <section className="space-y-3 border border-asphalt/10 bg-white px-4 py-5 sm:px-5">
        <div>
          <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
            Where are you starting?
          </h2>
          <p className="mt-1 text-sm text-muted">
          Required — we plan empty miles from here to your first pickup.
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
            {lastScanAt && !scanSummary && (
              <p className="text-sm text-muted">
                Last scan {formatLastScan(lastScanAt)}
              </p>
            )}
          </div>
        )}

        {scanSummary && (
          <p
            className={`text-sm ${
              newScanFingerprints.size > 0
                ? "border-l-4 border-amber bg-amber/10 px-4 py-3 font-medium text-asphalt"
                : "text-muted"
            }`}
          >
            {scanSummary}
          </p>
        )}

        {coach && <p className="text-sm text-asphalt">{coach}</p>}

        {scanned.length > 0 && (
          <div className="space-y-3 border-t border-asphalt/10 pt-4">
            <p className="text-xs font-semibold tracking-wide text-asphalt uppercase">
              Add to map (
              {Object.values(selectedScan).filter(Boolean).length} selected)
            </p>
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {scanned.map((job) => {
                const isNew = newScanFingerprints.has(jobFingerprint(job));
                return (
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
                        {isNew && (
                          <span className="ml-2 rounded-sm bg-amber px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-asphalt uppercase">
                            New
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {[
                          job.item,
                          job.miles != null ? `${job.miles} mi` : null,
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

      {/* Simple board: Jobs (bid) | My run (earn) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
              {visible.length} jobs on board
            </h2>
            <p className="mt-1 text-sm text-muted">
              {mainTab === "jobs"
                ? "Explore the board — then open My run for suggested chains."
                : "Suggested chains from your board. Revenue uses your bids from My Jobs."}
            </p>
          </div>
          <div
            className="inline-flex flex-wrap border border-asphalt/15 bg-white"
            role="toolbar"
            aria-label="Board controls"
          >
            {(
              [
                { id: "jobs" as const, label: "Jobs" },
                { id: "run" as const, label: "My run" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={mainTab === t.id}
                onClick={() => setMainTab(t.id)}
                className={`px-4 py-2 text-xs font-semibold tracking-wide uppercase sm:px-5 ${
                  mainTab === t.id
                    ? "bg-amber text-asphalt"
                    : "text-asphalt/70 hover:bg-concrete/50"
                }`}
              >
                {t.label}
              </button>
            ))}
            <Link
              href="/jobs"
              className="border-l border-asphalt/15 px-4 py-2 text-xs font-semibold tracking-wide text-asphalt uppercase hover:bg-concrete/50 sm:px-5"
            >
              My Jobs →
            </Link>
          </div>
        </div>

        {mainTab === "jobs" && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">
              Look
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
            <button
              type="button"
              onClick={() => setMainTab("run")}
              className="ml-auto rounded-sm bg-asphalt px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white uppercase"
            >
              See my run →
            </button>
          </div>
        )}

        {mainTab === "jobs" && jobsLook === "lanes" && (
          <JobsLaneMatrix
            jobs={visible}
            driver={driver}
            formatMoney={money}
            onAddToRun={(laneJobs) => {
              setRunChainIds(laneJobs.map((j) => j.id));
              setMainTab("run");
            }}
          />
        )}

        {mainTab === "jobs" && jobsLook === "map" && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Direction clusters on your board — tap to drill in. Manage bids in{" "}
              <Link href="/jobs" className="font-semibold text-amber">
                My Jobs
              </Link>
              .
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
            />
          </div>
        )}

        {mainTab === "run" && (
          <div className="space-y-3">
            {visible.filter((j) => j.myBid != null && j.myBid > 0).length ===
              0 && (
              <div className="border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-asphalt">
                No bids yet — enter quotes in{" "}
                <Link href="/jobs" className="font-semibold text-amber underline">
                  My Jobs
                </Link>{" "}
                so My run can show earnings.
              </div>
            )}
            <JobsPlannerGrid
              jobs={visible}
              driver={driver}
              formatMoney={money}
              runPrefs={runPrefs}
              initialChainIds={runChainIds}
              runOnly
            />
          </div>
        )}
      </section>

      {/* Job list — hunt view only; bids managed in My Jobs */}
      {mainTab === "jobs" && jobsLook === "list" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
                On your board
              </h2>
              <p className="mt-1 text-sm text-muted">
                Enter your quote on each job — or manage wins in My Jobs.
              </p>
            </div>
            <Link
              href="/jobs"
              className="rounded-sm bg-amber px-4 py-2 text-xs font-semibold tracking-wide text-asphalt uppercase"
            >
              My Jobs →
            </Link>
          </div>
          {!visible.length ? (
            <p className="text-sm text-muted">
              No jobs on the board yet. Scan Shiply and add them above.
            </p>
          ) : (
            <ul className="divide-y divide-asphalt/10 border-y border-asphalt/10">
              {visible.map((job) => {
                const meta = mapStatusMeta[job.status];
                return (
                  <li
                    key={job.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-asphalt">
                        {shortPlace(job.origin)} → {shortPlace(job.destination)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {[
                          job.item,
                          job.miles != null ? `${job.miles} mi` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="mt-2">
                        <JobBidField
                          compact
                          value={job.myBid}
                          miles={job.miles}
                          onChange={(myBid) => setMyBid(job.id, myBid)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-sm border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${meta.soft}`}
                      >
                        {meta.label}
                      </span>
                      {job.status !== "won" && (
                        <button
                          type="button"
                          onClick={() => setJobStatus(job.id, "won")}
                          className="rounded-sm bg-[#2f6b4f] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase"
                        >
                          I got this
                        </button>
                      )}
                      {job.href ? (
                        <a
                          href={job.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-semibold tracking-wide text-amber uppercase"
                        >
                          Shiply →
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeJob(job.id)}
                        className="text-[11px] font-semibold tracking-wide text-alert uppercase"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}