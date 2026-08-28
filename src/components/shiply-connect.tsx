"use client";

import { useEffect, useState } from "react";
import type { RunJob, RunPrefs } from "@/lib/run-builder";
import type { VisibleShiplyJob } from "@/lib/run-shortlist";
import {
  diffAgainstLastScan,
  formatLastScan,
  jobFingerprint,
  readLastScanSnapshot,
  scanSummaryMessage,
  writeLastScanSnapshot,
} from "@/lib/shiply-scan-snapshot";
import { ShiplyLiveView } from "@/components/shiply-live-view";
import { useMarket } from "@/lib/market-context";
import type { ShiplyTabDraft } from "@/lib/run-builder-draft";
import { outlineBtnClass } from "@/lib/ui-buttons";

const CONTEXT_KEY = "tlm_shiply_bb_context";

type Props = {
  prefs: RunPrefs;
  busy: boolean;
  setBusy: (v: boolean) => void;
  initialDraft?: ShiplyTabDraft | null;
  onDraftChange?: (draft: ShiplyTabDraft) => void;
  onSession?: (sessionId: string | null) => void;
  onImported: (
    jobs: RunJob[],
    coach: string | null,
    meta?: { sessionId: string; detailsLoaded: boolean },
  ) => void;
  onStartAgain?: () => void;
};

export function ShiplyConnect({
  prefs,
  busy,
  setBusy,
  initialDraft,
  onDraftChange,
  onImported,
  onSession,
  onStartAgain,
}: Props) {
  const { money } = useMarket();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(
    initialDraft?.sessionId ?? null,
  );
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(
    initialDraft?.liveViewUrl ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [coach, setCoach] = useState<string | null>(
    initialDraft?.coach ?? null,
  );
  const [scanned, setScanned] = useState<VisibleShiplyJob[]>(
    initialDraft?.scanned ?? [],
  );
  const [selected, setSelected] = useState<Record<string, boolean>>(
    initialDraft?.selected ?? {},
  );
  const [lastScanAt, setLastScanAt] = useState<string | null>(
    initialDraft?.lastScanAt ?? null,
  );
  const [newScanFingerprints, setNewScanFingerprints] = useState<Set<string>>(
    () => new Set(initialDraft?.newScanFingerprints ?? []),
  );
  const [scanSummary, setScanSummary] = useState<string | null>(
    initialDraft?.scanSummary ?? null,
  );

  useEffect(() => {
    onDraftChange?.({
      sessionId,
      liveViewUrl,
      coach,
      scanned,
      selected,
      scanSummary,
      lastScanAt,
      newScanFingerprints: [...newScanFingerprints],
    });
  }, [
    sessionId,
    liveViewUrl,
    coach,
    scanned,
    selected,
    scanSummary,
    lastScanAt,
    newScanFingerprints,
    onDraftChange,
  ]);

  useEffect(() => {
    const prev = readLastScanSnapshot();
    if (prev) setLastScanAt(prev.scannedAt);
  }, []);

  useEffect(() => {
    void fetch("/api/run/shiply/session")
      .then((r) => r.json())
      .then((d: { enabled?: boolean }) => setEnabled(Boolean(d.enabled)))
      .catch(() => setEnabled(false));
  }, []);

  async function startSession() {
    setError(null);
    setBusy(true);
    setScanned([]);
    setSelected({});
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
      onSession?.(data.sessionId ?? null);
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
          start: prefs.start,
          mode: prefs.mode,
          home: prefs.home,
          destination: prefs.destination,
          vehicle: prefs.vehicle,
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
      const jobs = data.jobs ?? [];
      const previous = readLastScanSnapshot();
      const diff = diffAgainstLastScan(previous, jobs);
      const scannedAt = new Date().toISOString();
      writeLastScanSnapshot(jobs);
      setLastScanAt(scannedAt);
      setNewScanFingerprints(diff.newFingerprints);
      setScanSummary(scanSummaryMessage(diff, jobs.length, scannedAt));
      setScanned(jobs);
      setCoach(data.coach ?? null);
      const next: Record<string, boolean> = {};
      for (const j of jobs) {
        next[j.id] = j.verdict === "high" || j.verdict === "open";
      }
      setSelected(next);
    } catch {
      setError("Network error scanning Shiply.");
    } finally {
      setBusy(false);
    }
  }

  async function analyseSelected() {
    if (!sessionId) return;
    const picked = scanned.filter((j) => selected[j.id]);
    if (!picked.length) {
      setError("Tick at least one job to analyse.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/run/shiply/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, jobs: picked }),
      });
      const data = (await res.json()) as {
        jobs?: RunJob[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not import selected jobs.");
        return;
      }
      onImported(data.jobs ?? [], coach, {
        sessionId,
        detailsLoaded: true,
      });
    } catch {
      setError("Network error importing jobs.");
    } finally {
      setBusy(false);
    }
  }

  if (enabled === false) {
    return (
      <div className="border border-dashed border-asphalt/20 bg-concrete/30 px-4 py-4 text-sm text-muted">
        <p className="font-medium text-asphalt">Connect Shiply (Phase 1)</p>
        <p className="mt-1">
          Browserbase keys are not on this environment yet. Use screenshots for
          now — or add{" "}
          <code className="text-xs">BROWSERBASE_API_KEY</code> and{" "}
          <code className="text-xs">BROWSERBASE_PROJECT_ID</code> to enable live
          connect.
        </p>
      </div>
    );
  }

  if (enabled === null) {
    return <p className="text-sm text-muted">Checking Shiply connect…</p>;
  }

  return (
    <div className="space-y-4 border border-asphalt/10 bg-white px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-xs tracking-[0.16em] text-amber uppercase">
            Phase 1 · Connect Shiply
          </p>
          <h3 className="mt-1 font-display text-xl tracking-wide text-asphalt uppercase">
            Your account, your control
          </h3>
          <p className="mt-2 text-sm text-muted">
            We open a cloud browser. You log into Shiply yourself, run the search,
            then tick which jobs we may analyse — we don’t crawl your account in
            the background.
          </p>
        </div>
        {onStartAgain ? (
          <button
            type="button"
            onClick={onStartAgain}
            className={outlineBtnClass("muted", "sm")}
          >
            Start again
          </button>
        ) : null}
      </div>

      {!sessionId ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void startSession()}
          className="rounded-sm bg-asphalt px-5 py-3 text-sm font-semibold tracking-wide text-white uppercase disabled:opacity-60"
        >
          {busy ? "Opening browser…" : "Connect Shiply →"}
        </button>
      ) : (
        <div className="space-y-3">
          {liveViewUrl && (
            <ShiplyLiveView url={liveViewUrl} collapseSignal={scanSummary} />
          )}
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>
              Log into Shiply in the window above (we open shiply.com for you;
              saved for next time when possible).
            </li>
            <li>Search near {prefs.start || "your start"} as coached.</li>
            <li>Stay on the results list, then scan.</li>
          </ol>
          <div className="sticky bottom-2 z-10 flex flex-wrap gap-2 border border-asphalt/10 bg-white/95 p-2 shadow-sm backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
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
            Select jobs to analyse ({Object.values(selected).filter(Boolean).length}{" "}
            selected)
          </p>
          <ul className="space-y-2">
            {scanned.map((job) => {
              const isNew = newScanFingerprints.has(jobFingerprint(job));
              return (
              <li key={job.id}>
                <label className="flex cursor-pointer gap-3 border border-asphalt/10 px-3 py-3 hover:bg-concrete/30">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={Boolean(selected[job.id])}
                    onChange={(e) =>
                      setSelected((s) => ({
                        ...s,
                        [job.id]: e.target.checked,
                      }))
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-asphalt">
                      {job.origin || "?"} → {job.destination || "?"}
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
                        job.rateTotal != null
                          ? money(job.rateTotal)
                          : null,
                        job.verdict?.toUpperCase(),
                        job.reason,
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
            <button
              type="button"
              disabled={busy}
              onClick={() => void analyseSelected()}
              className="rounded-sm bg-amber px-4 py-2.5 text-xs font-semibold tracking-wide text-asphalt uppercase disabled:opacity-60"
            >
              {busy ? "Opening jobs…" : "Auto-open selected jobs →"}
            </button>
        </div>
      )}

      {error && <p className="text-sm text-alert">{error}</p>}
    </div>
  );
}
