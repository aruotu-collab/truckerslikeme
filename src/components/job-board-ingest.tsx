"use client";

import { useEffect, useRef, useState } from "react";
import { ShiplyLiveView } from "@/components/shiply-live-view";
import { JobIngestPreview } from "@/components/job-ingest-preview";
import {
  appendManualJobs,
  JobManualEntryForm,
} from "@/components/job-manual-entry-form";
import { useAuthGate } from "@/lib/auth-gate";
import {
  draftsToVisible,
  fileToDataUrl,
  filesFromList,
  imagesFromPaste,
  MAX_INGEST_SCREENSHOTS,
  sourceLabel,
  visibleToIngestDraft,
  type IngestJobDraft,
} from "@/lib/job-ingest";
import {
  handleShiplyApiAuth,
  openShiplyAuthGate,
  requiresSignInForIngestSource,
  shiplyApiErrorMessage,
  shiplyConnectUi,
} from "@/lib/shiply-client-auth";
import type { VisibleShiplyJob } from "@/lib/run-shortlist";
import {
  diffAgainstLastScan,
  formatLastScan,
  jobFingerprint,
  readLastScanSnapshot,
  scanSummaryMessage,
  writeLastScanSnapshot,
} from "@/lib/shiply-scan-snapshot";
import { typeLabel } from "@/lib/typography";

const CONTEXT_KEY = "tlm_shiply_bb_context";

type IngestTab = "scan" | "screenshot" | "manual";

type PendingShot = { id: string; file: File; preview: string };

type JobBoardIngestProps = {
  startLabel: string;
  startReady: boolean;
  onAddJobs: (
    jobs: Array<
      VisibleShiplyJob & {
        ingestSource?: IngestJobDraft["source"];
      }
    >,
  ) => void;
};

export function JobBoardIngest({ startLabel, startReady, onAddJobs }: JobBoardIngestProps) {
  const { isSignedIn, openGate, loading: authLoading } = useAuthGate();
  const awaitingConnect = useRef(false);
  const [tab, setTab] = useState<IngestTab>("scan");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coach, setCoach] = useState<string | null>(null);

  const [pending, setPending] = useState<IngestJobDraft[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [newFingerprints, setNewFingerprints] = useState<Set<string>>(
    () => new Set(),
  );

  // Live scan
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [scanSummary, setScanSummary] = useState<string | null>(null);

  // Screenshots
  const [shots, setShots] = useState<PendingShot[]>([]);

  useEffect(() => {
    void fetch("/api/run/shiply/session")
      .then((r) => r.json())
      .then((d: { enabled?: boolean }) => setEnabled(Boolean(d.enabled)))
      .catch(() => setEnabled(false));
    const prev = readLastScanSnapshot();
    if (prev) setLastScanAt(prev.scannedAt);
  }, []);

  useEffect(() => {
    return () => {
      for (const s of shots) URL.revokeObjectURL(s.preview);
    };
  }, [shots]);

  useEffect(() => {
    if (!isSignedIn || !awaitingConnect.current) return;
    awaitingConnect.current = false;
    void startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume once after sign-in
  }, [isSignedIn]);

  useEffect(() => {
    if (authLoading) return;
    if (isSignedIn) return;
    setSessionId(null);
    setLiveViewUrl(null);
    setPending((prev) => {
      const next = prev.filter((j) => !requiresSignInForIngestSource(j.source));
      if (next.length === prev.length) return prev;
      setScanSummary(null);
      setNewFingerprints(new Set());
      return next;
    });
  }, [isSignedIn, authLoading]);

  function loadPending(
    jobs: IngestJobDraft[],
    opts?: { newFps?: Set<string>; summary?: string | null; coachMsg?: string | null },
  ) {
    if (
      jobs.some((j) => requiresSignInForIngestSource(j.source)) &&
      !isSignedIn
    ) {
      openShiplyAuthGate(openGate);
      setError("Sign in to review live-scanned jobs.");
      return;
    }
    setPending(jobs);
    const nextSel: Record<string, boolean> = {};
    for (const j of jobs) nextSel[j.id] = true;
    setSelected(nextSel);
    if (opts?.newFps) setNewFingerprints(opts.newFps);
    if (opts?.summary !== undefined) setScanSummary(opts.summary);
    if (opts?.coachMsg !== undefined) setCoach(opts.coachMsg);
    setError(null);
  }

  function queueShots(files: File[] | FileList | null) {
    const list = (
      files instanceof FileList
        ? filesFromList(files)
        : Array.isArray(files)
          ? files
          : []
    ).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;

    const room = MAX_INGEST_SCREENSHOTS - shots.length;
    if (room <= 0) {
      setError(`You can add up to ${MAX_INGEST_SCREENSHOTS} screenshots.`);
      return;
    }
    const next = list.slice(0, room).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setShots((prev) => [...prev, ...next].slice(0, MAX_INGEST_SCREENSHOTS));
    setError(null);
  }

  function removeShot(id: string) {
    setShots((prev) => {
      const shot = prev.find((s) => s.id === id);
      if (shot) URL.revokeObjectURL(shot.preview);
      return prev.filter((s) => s.id !== id);
    });
  }

  function clearReview() {
    setPending([]);
    setSelected({});
    setNewFingerprints(new Set());
    setScanSummary(null);
    setCoach(null);
    setError(null);
  }

  async function startNewSession() {
    clearReview();
    await startSession();
  }

  async function startSession() {
    if (!startReady) {
      setError("Set your starting location first.");
      return;
    }
    if (!isSignedIn) {
      awaitingConnect.current = true;
      openShiplyAuthGate(openGate);
      return;
    }
    setError(null);
    setBusy(true);
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
        requiresAuth?: boolean;
      };
      if (!res.ok) {
        if (handleShiplyApiAuth(data, openGate)) return;
        setError(shiplyApiErrorMessage(data, "Could not start Shiply browser."));
        return;
      }
      if (data.contextId) localStorage.setItem(CONTEXT_KEY, data.contextId);
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
    if (!startReady) {
      setError("Set your starting location first.");
      return;
    }
    if (!isSignedIn) {
      openShiplyAuthGate(openGate);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/run/shiply/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          start: startLabel,
          mode: "profit",
          vehicle: "van",
          completeList: true,
        }),
      });
      const data = (await res.json()) as {
        jobs?: VisibleShiplyJob[];
        coach?: string;
        error?: string;
        requiresAuth?: boolean;
      };
      if (!res.ok) {
        if (handleShiplyApiAuth(data, openGate)) return;
        setError(shiplyApiErrorMessage(data, "Could not scan the Shiply page."));
        return;
      }
      const list = data.jobs ?? [];
      const previous = readLastScanSnapshot();
      const diff = diffAgainstLastScan(previous, list);
      const scannedAt = new Date().toISOString();
      writeLastScanSnapshot(list);
      setLastScanAt(scannedAt);
      const drafts = list.map((j) => visibleToIngestDraft(j, "scan"));
      loadPending(drafts, {
        newFps: diff.newFingerprints,
        summary: scanSummaryMessage(diff, list.length, scannedAt),
        coachMsg: data.coach ?? null,
      });
    } catch {
      setError("Network error scanning Shiply.");
    } finally {
      setBusy(false);
    }
  }

  async function extractFromScreenshots() {
    if (!shots.length) {
      setError("Add at least one screenshot of your Shiply results list.");
      return;
    }
    if (!startReady) {
      setError("Set your starting location first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const images: string[] = [];
      for (const shot of shots) {
        images.push(await fileToDataUrl(shot.file));
      }
      const res = await fetch("/api/jobs/ingest/screenshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, start: startLabel, vehicle: "van" }),
      });
      const data = (await res.json()) as {
        jobs?: VisibleShiplyJob[];
        coach?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not read those screenshots.");
        return;
      }
      const list = data.jobs ?? [];
      const previous = readLastScanSnapshot();
      const diff = diffAgainstLastScan(previous, list);
      const scannedAt = new Date().toISOString();
      writeLastScanSnapshot(list);
      setLastScanAt(scannedAt);
      const drafts = list.map((j) => visibleToIngestDraft(j, "screenshot"));
      loadPending(drafts, {
        newFps: diff.newFingerprints,
        summary: scanSummaryMessage(diff, list.length, scannedAt),
        coachMsg:
          data.coach ||
          `Found ${list.length} job${list.length === 1 ? "" : "s"} from screenshots.`,
      });
      for (const s of shots) URL.revokeObjectURL(s.preview);
      setShots([]);
    } catch {
      setError("Network error reading screenshots.");
    } finally {
      setBusy(false);
    }
  }

  function addManualJobs(incoming: IngestJobDraft[]) {
    setPending((prev) => appendManualJobs(prev, incoming));
    setSelected((s) => {
      const next = { ...s };
      for (const j of incoming) next[j.id] = true;
      return next;
    });
  }

  function commitToBoard(all: boolean) {
    if (!startReady) {
      setError("Set your starting location before adding jobs.");
      return;
    }
    const picked = all ? pending : pending.filter((j) => selected[j.id]);
    if (!picked.length) {
      setError(all ? "No jobs in the list." : "Tick at least one job to add.");
      return;
    }
    if (
      picked.some((j) => requiresSignInForIngestSource(j.source)) &&
      !isSignedIn
    ) {
      openShiplyAuthGate(openGate);
      setError("Sign in to add live-scanned jobs to Hunt.");
      return;
    }
    const visible = draftsToVisible(picked).map((j, i) => ({
      ...j,
      id: picked[i]!.id,
      ingestSource: picked[i]!.source,
    }));
    onAddJobs(visible);
    setPending([]);
    setSelected({});
    setScanSummary(null);
    setCoach(
      `Added ${picked.length} job${picked.length === 1 ? "" : "s"} to the board.`,
    );
    setError(null);
  }

  const tabBtn =
    "min-h-11 flex-1 rounded-sm px-3 py-2 text-xs font-semibold tracking-wide uppercase transition sm:text-[11px]";

  const connectUi = shiplyConnectUi({
    startReady,
    isSignedIn,
    busy,
    startHint: "Set your starting location above first — use the field at the top of this page.",
  });

  const scanReviewBlocked =
    !authLoading &&
    !isSignedIn &&
    pending.some((j) => requiresSignInForIngestSource(j.source));

  return (
    <div className="space-y-4 border-t border-asphalt/10 pt-4">
      <div>
        <p className={typeLabel}>Add jobs to the board</p>
        <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">
          Live scan when it works · screenshots from your phone · manual entry
          always works. All paths land in Hunt as Considering.
        </p>
      </div>

      <div
        className="grid grid-cols-3 gap-1 border border-asphalt/15 bg-concrete/30 p-1"
        role="tablist"
        aria-label="Add jobs method"
      >
        {(
          [
            { id: "scan" as const, label: "Live scan" },
            { id: "screenshot" as const, label: "Screenshots" },
            { id: "manual" as const, label: "Manual" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`${tabBtn} ${
              tab === t.id
                ? "bg-white text-asphalt shadow-sm ring-1 ring-amber/40"
                : "text-muted hover:bg-white/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "scan" && (
        <div className="space-y-3" role="tabpanel">
          <p className="text-xs leading-relaxed text-muted">
            Connect to Shiply in the browser below, open your search results,
            then scan visible jobs. Best when Browserbase is configured — gets
            real Shiply links.
          </p>

          {enabled === false && (
            <p className="border border-dashed border-amber/40 bg-amber/5 px-3 py-2.5 text-xs text-asphalt">
              Live scan needs Browserbase keys. Use{" "}
              <strong>Screenshots</strong> or <strong>Manual</strong> instead —
              they work without any server setup.
            </p>
          )}

          {enabled && !sessionId ? (
            <div className="space-y-2">
              {connectUi.hint ? (
                <p className="border border-amber/40 bg-amber/10 px-3 py-2.5 text-xs leading-relaxed text-asphalt">
                  {connectUi.hint}
                </p>
              ) : null}
              <button
                type="button"
                disabled={connectUi.disabled}
                onClick={() => void startSession()}
                className="min-h-11 rounded-sm bg-asphalt px-4 py-2 text-xs font-semibold tracking-wide text-white uppercase disabled:cursor-not-allowed disabled:opacity-60"
              >
                {connectUi.buttonLabel}
              </button>
            </div>
          ) : null}

          {enabled && sessionId ? (
            <div className="space-y-3">
              {liveViewUrl ? (
                <ShiplyLiveView url={liveViewUrl} collapseSignal={scanSummary} />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void scanVisible()}
                  className="min-h-11 rounded-sm bg-amber px-4 py-2 text-xs font-semibold tracking-wide text-asphalt uppercase disabled:opacity-60"
                >
                  {busy ? "Scanning…" : "Scan visible jobs"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startNewSession()}
                  className="min-h-11 rounded-sm border-2 border-asphalt/25 bg-white px-4 py-2 text-xs font-semibold tracking-wide uppercase disabled:opacity-60"
                >
                  New session
                </button>
              </div>
              {lastScanAt && !scanSummary ? (
                <p className="text-xs text-muted">
                  Last scan {formatLastScan(lastScanAt)}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {tab === "screenshot" && (
        <div className="space-y-3" role="tabpanel">
          <p className="text-xs leading-relaxed text-muted">
            Screenshot your Shiply <strong>results list</strong> — scroll and
            overlap each shot. Works on mobile (camera or camera roll). Up to{" "}
            {MAX_INGEST_SCREENSHOTS} images per batch.
          </p>

          <div
            className="flex flex-wrap gap-2"
            onPaste={(e) => {
              const files = imagesFromPaste(e);
              if (files.length) {
                e.preventDefault();
                queueShots(files);
              }
            }}
          >
            <label className="min-h-11 cursor-pointer rounded-sm border-2 border-dashed border-asphalt/25 bg-white px-4 py-2.5 text-xs font-semibold tracking-wide text-asphalt uppercase hover:border-amber/50">
              Add screenshots
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  queueShots(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <label className="min-h-11 cursor-pointer rounded-sm border-2 border-asphalt/25 bg-white px-4 py-2.5 text-xs font-semibold tracking-wide uppercase hover:border-amber/50 sm:hidden">
              Take photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  queueShots(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {shots.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted">
                {shots.length} screenshot{shots.length === 1 ? "" : "s"} ready
              </p>
              <ul className="flex flex-wrap gap-2">
                {shots.map((s) => (
                  <li key={s.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.preview}
                      alt="Shiply results screenshot"
                      className="h-20 w-14 border border-asphalt/15 object-cover object-top"
                    />
                    <button
                      type="button"
                      onClick={() => removeShot(s.id)}
                      className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-asphalt text-[10px] text-white"
                      aria-label="Remove screenshot"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={busy}
                onClick={() => void extractFromScreenshots()}
                className="min-h-11 rounded-sm bg-amber px-4 py-2 text-xs font-semibold tracking-wide text-asphalt uppercase disabled:opacity-60"
              >
                {busy
                  ? "Reading screenshots…"
                  : `Extract jobs from ${shots.length} screenshot${shots.length === 1 ? "" : "s"} →`}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {tab === "manual" && (
        <div className="space-y-4" role="tabpanel">
          <JobManualEntryForm
            onJobsAdded={addManualJobs}
            onCoach={setCoach}
            onError={setError}
          />
        </div>
      )}

      {scanSummary ? (
        <p
          className={`text-sm ${
            newFingerprints.size > 0
              ? "border-l-4 border-amber bg-amber/10 px-3 py-2 font-medium text-asphalt"
              : "text-muted"
          }`}
        >
          {scanSummary}
        </p>
      ) : null}

      {coach ? <p className="text-sm text-asphalt">{coach}</p> : null}
      {error ? <p className="text-sm text-alert">{error}</p> : null}

      <JobIngestPreview
        jobs={pending}
        selected={selected}
        newFingerprints={newFingerprints}
        fingerprint={(j) =>
          jobFingerprint({
            id: j.id,
            origin: j.origin,
            destination: j.destination,
            item: j.item,
            href: j.href,
          })
        }
        onToggle={(id, checked) =>
          setSelected((s) => ({ ...s, [id]: checked }))
        }
        onSelectAll={(checked) => {
          const next: Record<string, boolean> = {};
          for (const j of pending) next[j.id] = checked;
          setSelected(next);
        }}
        onAddAll={() => commitToBoard(true)}
        onAddSelected={() => commitToBoard(false)}
        onClearReview={clearReview}
        addBlocked={scanReviewBlocked}
        onAddBlocked={() => openShiplyAuthGate(openGate)}
        disabled={busy}
      />

      {pending.length > 0 ? (
        <p className="text-[11px] text-muted">
          Sources:{" "}
          {[...new Set(pending.map((j) => sourceLabel(j.source)))].join(" · ")}
          . Shiply links are optional — enter your quote on each Hunt card.
        </p>
      ) : null}
    </div>
  );
}
