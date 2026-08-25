"use client";

import { useEffect, useState } from "react";
import { JobsTubeMap } from "@/components/jobs-tube-map";
import { useMarket } from "@/lib/market-context";
import {
  filterMapJobs,
  mapStatusMeta,
  mergeScannedJobs,
  readJobsMap,
  shortPlace,
  writeJobsMap,
  type JobsMapFilter,
  type MapJob,
  type MapJobStatus,
} from "@/lib/jobs-map";
import type { VisibleShiplyJob } from "@/lib/run-shortlist";

const CONTEXT_KEY = "tlm_shiply_bb_context";

const FILTERS: { id: JobsMapFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "hunting", label: "Hunting" },
  { id: "won", label: "Won" },
];

export function JobsMapPanel() {
  const { money } = useMarket();
  const [jobs, setJobs] = useState<MapJob[]>([]);
  const [filter, setFilter] = useState<JobsMapFilter>("all");
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
    const loaded = readJobsMap();
    setJobs(loaded);
    setHydrated(true);
    void fetch("/api/run/shiply/session")
      .then((r) => r.json())
      .then((d: { enabled?: boolean }) => setEnabled(Boolean(d.enabled)))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeJobsMap(jobs);
  }, [jobs, hydrated]);

  const visible = filterMapJobs(jobs, filter);

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
          start: "",
          mode: "profit",
          vehicle: "van",
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

  function addScannedToMap() {
    const picked = scanned.filter((j) => selectedScan[j.id]);
    if (!picked.length) {
      setError("Tick at least one job to add to the map.");
      return;
    }
    setJobs((prev) => mergeScannedJobs(prev, picked));
    setCoach(
      `Added ${picked.length} job${picked.length === 1 ? "" : "s"} to your hunt map. Won jobs stay marked.`,
    );
    setError(null);
  }

  const counts = {
    all: jobs.filter((j) => j.status !== "skipped").length,
    hunting: jobs.filter((j) => j.status === "hunting").length,
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
          Tube-style map of Shiply jobs you’re hunting. Open each listing, mark
          wins green, skip the rest — won jobs stay on the board.
        </p>
      </header>

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
            <button
              type="button"
              onClick={addScannedToMap}
              className="rounded-sm bg-amber px-4 py-2.5 text-xs font-semibold tracking-wide text-asphalt uppercase"
            >
              Add selected to hunt map →
            </button>
          </div>
        )}

        {error && <p className="text-sm text-alert">{error}</p>}
      </section>

      {/* Map + filters */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
              Tube map
            </h2>
            <p className="mt-1 text-sm text-muted">
              Tap a coloured line to focus that job.
            </p>
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
                className={`px-3.5 py-2 text-xs font-semibold tracking-wide uppercase transition sm:px-4 ${
                  filter === f.id
                    ? "bg-asphalt text-white"
                    : "text-asphalt/70 hover:bg-concrete/50"
                }`}
              >
                {f.label}
                <span className="ml-1.5 opacity-70">
                  {counts[f.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-muted">
          {(Object.keys(mapStatusMeta) as MapJobStatus[])
            .filter((s) => s !== "skipped")
            .map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-6 rounded-sm"
                  style={{ background: mapStatusMeta[s].line }}
                />
                {mapStatusMeta[s].label}
              </span>
            ))}
        </div>

        <JobsTubeMap
          jobs={visible}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </section>

      {/* Job list */}
      <section className="space-y-3">
        <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
          Jobs on board
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
                        Back to hunting
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
