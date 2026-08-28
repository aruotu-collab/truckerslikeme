"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMarket } from "@/lib/market-context";
import { formatMoney } from "@/lib/market";
import {
  applyRunFollowUp,
  defaultRunPrefs,
  followUpCopy,
  isDecisionMode,
  modeCopy,
  nextHuntAfterAnchor,
  RUN_MODE_ORDER,
  shiplyHuntBrief,
  type JobVerdict,
  type RunCombo,
  type RunFollowUp,
  type RunJob,
  type RunMode,
  type RunPrefs,
  type WorkWindow,
} from "@/lib/run-builder";
import { ShiplyConnect } from "@/components/shiply-connect";
import { RunCorridorStrip } from "@/components/run-corridor-strip";
import { JobDecisionPanel } from "@/components/job-decision-panel";
import {
  appendManualJobs,
  JobManualEntryForm,
} from "@/components/job-manual-entry-form";
import { JobIngestPreview } from "@/components/job-ingest-preview";
import { jobFingerprint } from "@/lib/shiply-scan-snapshot";
import {
  draftsToRunJobs,
  sourceLabel,
  type IngestJobDraft,
} from "@/lib/job-ingest";
import { typeEyebrow, typePageLead, typePageTitle } from "@/lib/typography";
import { outlineBtnClass } from "@/lib/ui-buttons";
import {
  EMPTY_SHIPLY_DRAFT,
  readRunBuilderDraft,
  RUN_BUILDER_HOME_EVENT,
  writeRunBuilderDraft,
  type HuntPath,
  type ShiplyTabDraft,
} from "@/lib/run-builder-draft";

type Step = "mode" | "setup" | "hunt" | "shortlist" | "build" | "decision";

const FOLLOW_UPS: RunFollowUp[] = [
  "best",
  "more_money",
  "less_empty",
  "shorter",
  "closer_home",
  "keep_busy",
];

const vehicles = [
  "Luton van",
  "LWB van",
  "3.5t",
  "7.5t",
  "Artic / trailer",
  "Other",
];

const workWindows: { id: WorkWindow; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "tonight", label: "Until tonight" },
  { id: "2days", label: "2 days" },
  { id: "flexible", label: "No preference" },
];

const verdictTone: Record<JobVerdict, string> = {
  high: "border-emerald-300 bg-emerald-50 text-emerald-900",
  open: "border-amber/40 bg-amber/10 text-asphalt",
  maybe: "border-asphalt/15 bg-white text-muted",
  skip: "border-asphalt/10 bg-concrete/40 text-muted line-through decoration-asphalt/30",
};

const verdictLabel: Record<JobVerdict, string> = {
  high: "Open this",
  open: "Worth opening",
  maybe: "Maybe",
  skip: "Skip",
};

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

function filesFromList(list: FileList | null): File[] {
  return list ? Array.from(list) : [];
}

function imagesFromPaste(e: React.ClipboardEvent): File[] {
  const items = e.clipboardData?.items;
  if (!items) return [];
  const files: File[] = [];
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
}

const MAX_RESULTS_SHOTS = 4;

type PendingShot = { id: string; preview: string; dataUrl: string };

function TabStartAgainButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={outlineBtnClass("muted", "sm")}
    >
      Start again
    </button>
  );
}

export function RunBuilder() {
  const { market, money } = useMarket();
  const [step, setStep] = useState<Step>("mode");
  const [prefs, setPrefs] = useState<RunPrefs>(defaultRunPrefs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coach, setCoach] = useState<string | null>(null);
  const [jobs, setJobs] = useState<RunJob[]>([]);
  const [combos, setCombos] = useState<RunCombo[]>([]);
  const [best, setBest] = useState<RunCombo | null>(null);
  const [pendingResults, setPendingResults] = useState<PendingShot[]>([]);
  const [huntPath, setHuntPath] = useState<HuntPath>("shiply");
  const [shiplySessionId, setShiplySessionId] = useState<string | null>(null);
  const [detailsFromShiply, setDetailsFromShiply] = useState(false);
  const [followUp, setFollowUp] = useState<RunFollowUp>("best");
  const [geoBusy, setGeoBusy] = useState(false);
  const [manualPending, setManualPending] = useState<IngestJobDraft[]>([]);
  const [manualSelected, setManualSelected] = useState<Record<string, boolean>>(
    {},
  );
  const [manualCoach, setManualCoach] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [shiplyDraft, setShiplyDraft] = useState<ShiplyTabDraft>(
    EMPTY_SHIPLY_DRAFT,
  );
  const [shiplyTabKey, setShiplyTabKey] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const brief = useMemo(() => shiplyHuntBrief(prefs), [prefs]);

  const rankedCombos = useMemo(() => {
    if (followUp === "best") return combos;
    return applyRunFollowUp(combos, followUp, prefs);
  }, [combos, followUp, prefs]);

  const shownBest = rankedCombos[0] ?? best;

  const handleShiplyDraftChange = useCallback((draft: ShiplyTabDraft) => {
    setShiplyDraft(draft);
  }, []);

  useEffect(() => {
    const saved = readRunBuilderDraft();
    if (saved) {
      setPrefs(saved.prefs);
      setHuntPath(saved.huntPath);
      setShiplyDraft(saved.shiply);
      setPendingResults(
        saved.screenshots.shots.map((s) => ({
          id: s.id,
          preview: s.dataUrl,
          dataUrl: s.dataUrl,
        })),
      );
      setManualPending(saved.manual.pending);
      setManualSelected(saved.manual.selected);
      setManualCoach(saved.manual.coach);
      setJobs(saved.jobs);
      setShiplySessionId(saved.shiplySessionId);
      setCoach(saved.coach);
      setFollowUp(saved.followUp);
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    const goHome = () => setStep("mode");
    window.addEventListener(RUN_BUILDER_HOME_EVENT, goHome);
    return () => window.removeEventListener(RUN_BUILDER_HOME_EVENT, goHome);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      writeRunBuilderDraft({
        prefs,
        huntPath,
        shiply: shiplyDraft,
        screenshots: {
          shots: pendingResults.map((s) => ({
            id: s.id,
            dataUrl: s.dataUrl,
          })),
        },
        manual: {
          pending: manualPending,
          selected: manualSelected,
          coach: manualCoach,
        },
        jobs,
        shiplySessionId,
        coach,
        followUp,
      });
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    draftReady,
    prefs,
    huntPath,
    shiplyDraft,
    pendingResults,
    manualPending,
    manualSelected,
    manualCoach,
    jobs,
    shiplySessionId,
    coach,
    followUp,
  ]);

  function clearShiplyTab() {
    setShiplyDraft(EMPTY_SHIPLY_DRAFT());
    setShiplySessionId(null);
    setShiplyTabKey((k) => k + 1);
    setError(null);
  }

  function clearScreenshotsTab() {
    setPendingResults([]);
    setError(null);
  }

  function clearManualTab() {
    setManualPending([]);
    setManualSelected({});
    setManualCoach(null);
    setError(null);
  }

  function pickMode(mode: RunMode) {
    setPrefs((p) => ({ ...p, mode }));
    setFollowUp("best");
    if (isDecisionMode(mode)) {
      setStep("decision");
      return;
    }
    setStep("setup");
  }

  function update<K extends keyof RunPrefs>(key: K, value: RunPrefs[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  async function useCurrentLocation() {
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
          maximumAge: 60_000,
        });
      });
      const { reverseGeocodePlace } = await import("@/lib/reverse-geocode");
      const place = await reverseGeocodePlace(
        pos.coords.latitude,
        pos.coords.longitude,
      );
      update("start", place.label);
    } catch {
      setError("Couldn’t read your location. Type a town instead.");
    } finally {
      setGeoBusy(false);
    }
  }

  function clearPendingResults() {
    setPendingResults([]);
  }

  async function queueResultsScreenshots(files: File[] | FileList | null) {
    const list = (Array.isArray(files) ? files : filesFromList(files)).filter(
      (f) => f.type.startsWith("image/"),
    );
    if (!list.length) return;

    const room = MAX_RESULTS_SHOTS - pendingResults.length;
    if (room <= 0) {
      setError(`You can add up to ${MAX_RESULTS_SHOTS} results screenshots.`);
      return;
    }
    if (list.length > room) {
      setError(`Only ${MAX_RESULTS_SHOTS} screenshots kept — extras dropped.`);
    } else {
      setError(null);
    }

    const next: PendingShot[] = [];
    for (const file of list.slice(0, room)) {
      const dataUrl = await fileToDataUrl(file);
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        preview: dataUrl,
        dataUrl,
      });
    }
    setPendingResults((prev) => [...prev, ...next].slice(0, MAX_RESULTS_SHOTS));
  }

  function removePendingResult(id: string) {
    setPendingResults((prev) => prev.filter((s) => s.id !== id));
  }

  function goHunt() {
    setError(null);
    if (!prefs.start.trim()) {
      setError("Tell us where you’re starting.");
      return;
    }
    if (prefs.mode === "home" && !prefs.home.trim()) {
      setError("Add your home / base for Get Me Home.");
      return;
    }
    if (prefs.mode === "destination" && !prefs.destination.trim()) {
      setError("Add the destination you’re heading to.");
      return;
    }
    if (prefs.mode === "fill_gaps") {
      if (!prefs.bookedOrigin.trim() || !prefs.bookedDestination.trim()) {
        setError("Add the booked job’s pickup and drop-off.");
        return;
      }
    }
    setStep("hunt");
  }

  async function shortlistFromResults() {
    if (!pendingResults.length) {
      setError("Add at least one Shiply results screenshot first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const images: string[] = [];
      for (const shot of pendingResults.slice(0, MAX_RESULTS_SHOTS)) {
        images.push(shot.dataUrl);
      }
      const res = await fetch("/api/run/shortlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          start: prefs.start,
          mode: prefs.mode,
          home: prefs.home,
          destination: prefs.destination,
          vehicle: prefs.vehicle,
          bookedOrigin: prefs.bookedOrigin,
          bookedDestination: prefs.bookedDestination,
          bookedWindow: prefs.bookedWindow,
        }),
      });
      const data = (await res.json()) as {
        jobs?: RunJob[];
        coach?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not read that results list.");
        return;
      }
      clearPendingResults();
      setJobs(data.jobs ?? []);
      setCoach(data.coach ?? null);
      setStep("shortlist");
    } catch {
      setError("Network error reading the results screenshot.");
    } finally {
      setBusy(false);
    }
  }

  function addManualPending(incoming: IngestJobDraft[]) {
    setManualPending((prev) => appendManualJobs(prev, incoming));
    setManualSelected((s) => {
      const next = { ...s };
      for (const j of incoming) next[j.id] = true;
      return next;
    });
    setError(null);
  }

  function commitManualToShortlist(all: boolean) {
    const picked = all
      ? manualPending
      : manualPending.filter((j) => manualSelected[j.id]);
    if (!picked.length) {
      setError(
        all ? "No jobs in the list." : "Tick at least one job to shortlist.",
      );
      return;
    }
    const incoming = draftsToRunJobs(picked);
    setJobs((prev) => {
      const merged = [...prev];
      for (const j of incoming) {
        const key = `${j.origin}|${j.destination}|${j.miles ?? ""}`;
        if (
          !merged.some(
            (m) => `${m.origin}|${m.destination}|${m.miles ?? ""}` === key,
          )
        ) {
          merged.push(j);
        }
      }
      return merged;
    });
    setCoach(
      `Shortlisted ${picked.length} job${picked.length === 1 ? "" : "s"} from manual entry.`,
    );
    setManualPending([]);
    setManualSelected({});
    setManualCoach(null);
    setError(null);
    setStep("shortlist");
  }

  async function addFullJobScreenshots(files: File[] | FileList | null) {
    const list = Array.isArray(files) ? files : filesFromList(files);
    if (!list.length) return;
    setBusy(true);
    setError(null);
    try {
      const images: string[] = [];
      for (const file of list.slice(0, 6)) {
        images.push(await fileToDataUrl(file));
      }
      // Reuse load extract — one job merged; for multiple files call per image
      const extracted: RunJob[] = [];
      for (let i = 0; i < images.length; i++) {
        const res = await fetch("/api/loads/extract-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: [images[i]] }),
        });
        const data = (await res.json()) as {
          extracted?: {
            origin: string | null;
            destination: string | null;
            miles: number | null;
            rateTotal: number | null;
            item: string | null;
            lowestQuote?: number | null;
            notes?: string[];
          };
          error?: string;
        };
        if (!res.ok || !data.extracted) continue;
        const ex = data.extracted;
        extracted.push({
          id: `full-${Date.now()}-${i}`,
          origin: ex.origin,
          destination: ex.destination,
          miles: ex.miles,
          rateTotal:
            ex.rateTotal ??
            (ex.lowestQuote != null ? ex.lowestQuote : null),
          item: ex.item,
          verdict: "open",
          reason: "Full job screenshot",
          notes: ex.notes,
        });
      }
      if (extracted.length === 0) {
        setError("Could not read job details from those screenshots.");
        return;
      }
      let merged: RunJob[] = [];
      setJobs((prev) => {
        merged = [...prev];
        for (const j of extracted) {
          const key = `${j.origin}|${j.destination}|${j.miles}`;
          if (
            merged.some(
              (m) => `${m.origin}|${m.destination}|${m.miles}` === key,
            )
          ) {
            continue;
          }
          merged.push(j);
        }
        return merged;
      });
      setStep("build");
      await buildRun(merged.length ? merged : extracted);
    } catch {
      setError("Could not process job screenshots.");
    } finally {
      setBusy(false);
    }
  }

  async function autoOpenStrongJobs() {
    if (!shiplySessionId) {
      setError("Connect Shiply first (Phase 1) so we can open jobs for you.");
      return;
    }
    const strong = jobs
      .filter(
        (j) =>
          j.verdict === "high" ||
          j.verdict === "open" ||
          j.verdict === "maybe",
      )
      .slice(0, 4);
    if (!strong.length) {
      setError("No OPEN / MAYBE jobs to open.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/run/shiply/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: shiplySessionId, jobs: strong }),
      });
      const data = (await res.json()) as {
        jobs?: RunJob[];
        error?: string;
        errors?: string[];
      };
      if (!res.ok) {
        setError(data.error || "Could not auto-open those jobs.");
        return;
      }
      const next = data.jobs ?? [];
      setJobs(next);
      setDetailsFromShiply(true);
      setCoach(
        "We opened the strong jobs in your Shiply session and pulled full details. Build the run when ready.",
      );
      if (data.errors?.length) {
        setError(data.errors.join(" · "));
      }
    } catch {
      setError("Network error auto-opening Shiply jobs.");
    } finally {
      setBusy(false);
    }
  }

  async function buildRun(jobList?: RunJob[]) {
    const list = jobList ?? jobs;
    const usable = list.filter((j) => j.verdict !== "skip");
    if (usable.length === 0) {
      setError("Mark or upload at least one non-skip job first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/run/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobs: usable,
          prefs,
          countryCode: market.countryCode,
        }),
      });
      const data = (await res.json()) as {
        combos?: RunCombo[];
        best?: RunCombo | null;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not build a run.");
        return;
      }
      setCombos(data.combos ?? []);
      setBest(data.best ?? null);
      setFollowUp("best");
      setStep("build");
    } catch {
      setError("Network error building the run.");
    } finally {
      setBusy(false);
    }
  }

  const openJobs = jobs.filter(
    (j) => j.verdict === "high" || j.verdict === "open",
  );

  return (
    <div className="space-y-10">
      <section>
        <p className={typeEyebrow}>
          Build Run
        </p>
        <h1 className={`mt-2 ${typePageTitle}`}>
          Let the money choose the day
        </h1>
        <p className={typePageLead}>
          Shiply shows what&apos;s on the board. Pick a goal — we&apos;ll
          shortlist what to open, fill gaps around booked work, or check whether
          a quote is actually worth it. For live Shiply scans, use{" "}
          <Link href="/map" className="font-semibold text-asphalt hover:text-amber">
            Job Board
          </Link>
          .
        </p>
      </section>

      {step === "mode" && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RUN_MODE_ORDER.map((mode) => {
            const copy = modeCopy(mode);
            return (
              <button
                key={mode}
                type="button"
                onClick={() => pickMode(mode)}
                className="border border-asphalt/15 bg-white px-5 py-5 text-left transition hover:border-amber hover:bg-amber/5"
              >
                <p className="font-display text-xs tracking-[0.16em] text-amber uppercase">
                  {copy.eyebrow}
                </p>
                <p className="mt-3 font-display text-lg tracking-wide text-asphalt uppercase sm:text-xl">
                  {copy.title}
                </p>
                <p className="mt-2 text-sm leading-snug text-muted">
                  {copy.body}
                </p>
              </button>
            );
          })}
        </section>
      )}

      {step === "decision" && isDecisionMode(prefs.mode) && (
        <JobDecisionPanel
          kind={prefs.mode === "price_job" ? "price" : "check"}
          onBack={() => setStep("mode")}
        />
      )}

      {step === "setup" && (
        <section className="space-y-6 border border-asphalt/10 bg-white px-5 py-6 sm:px-6">
          <button
            type="button"
            onClick={() => setStep("mode")}
            className="text-sm font-medium text-amber transition hover:text-asphalt"
          >
            ← Change goal
          </button>
          <p className="font-display text-xs tracking-[0.16em] text-amber uppercase">
            {modeCopy(prefs.mode).eyebrow}
          </p>
          <p className="font-display text-2xl tracking-wide text-asphalt uppercase">
            {modeCopy(prefs.mode).title}
          </p>
          <p className="max-w-xl text-sm text-muted">
            {modeCopy(prefs.mode).body}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="block">
              <span className="text-xs tracking-wide text-muted uppercase">
                Starting from
              </span>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={prefs.start}
                  onChange={(e) => update("start", e.target.value)}
                  placeholder="Birmingham"
                  className="w-full flex-1 rounded-sm border border-asphalt/15 px-3 py-2.5"
                />
                <button
                  type="button"
                  disabled={geoBusy}
                  onClick={() => void useCurrentLocation()}
                  title="Use current location"
                  className={`${outlineBtnClass("amber")} shrink-0 disabled:opacity-60`}
                >
                  {geoBusy ? "Locating…" : "Use my location"}
                </button>
              </div>
            </div>
            <label className="block">
              <span className="text-xs tracking-wide text-muted uppercase">
                Available from
              </span>
              <input
                type="time"
                value={prefs.availableFrom}
                onChange={(e) => update("availableFrom", e.target.value)}
                className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
              />
            </label>
            <label className="block">
              <span className="text-xs tracking-wide text-muted uppercase">
                Vehicle
              </span>
              <select
                value={prefs.vehicle}
                onChange={(e) => update("vehicle", e.target.value)}
                className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
              >
                {vehicles.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="text-xs tracking-wide text-muted uppercase">
                How long do you want to work?
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {workWindows.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => update("workWindow", w.id)}
                    className={`rounded-sm px-3 py-2 text-xs font-semibold tracking-wide uppercase ${
                      prefs.workWindow === w.id
                        ? "bg-amber text-asphalt"
                        : "border border-asphalt/15 bg-white text-asphalt"
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
            {prefs.mode === "home" && (
              <label className="block sm:col-span-2">
                <span className="text-xs tracking-wide text-muted uppercase">
                  Home / base
                </span>
                <input
                  value={prefs.home}
                  onChange={(e) => update("home", e.target.value)}
                  placeholder="Birmingham"
                  className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
                />
              </label>
            )}
            {prefs.mode === "destination" && (
              <label className="block sm:col-span-2">
                <span className="text-xs tracking-wide text-muted uppercase">
                  Destination
                </span>
                <input
                  value={prefs.destination}
                  onChange={(e) => update("destination", e.target.value)}
                  placeholder="Manchester"
                  className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
                />
              </label>
            )}
            {prefs.mode === "fill_gaps" && (
              <>
                <label className="block">
                  <span className="text-xs tracking-wide text-muted uppercase">
                    Booked pickup
                  </span>
                  <input
                    value={prefs.bookedOrigin}
                    onChange={(e) => update("bookedOrigin", e.target.value)}
                    placeholder="Leeds"
                    className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
                  />
                </label>
                <label className="block">
                  <span className="text-xs tracking-wide text-muted uppercase">
                    Booked drop-off
                  </span>
                  <input
                    value={prefs.bookedDestination}
                    onChange={(e) =>
                      update("bookedDestination", e.target.value)
                    }
                    placeholder="Bristol"
                    className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs tracking-wide text-muted uppercase">
                    Booked window (optional)
                  </span>
                  <input
                    value={prefs.bookedWindow}
                    onChange={(e) => update("bookedWindow", e.target.value)}
                    placeholder="Collect 10:00–12:00 · deliver by 18:00"
                    className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
                  />
                </label>
              </>
            )}
            {prefs.mode === "profit" && (
              <div className="sm:col-span-2">
                <span className="text-xs tracking-wide text-muted uppercase">
                  How far are you willing to finish from home? (optional)
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      ["anywhere", "Anywhere"],
                      ["50", "Within 50 mi"],
                      ["100", "Within 100 mi"],
                      ["home_tonight", "Home tonight"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => update("finishRadius", id)}
                      className={`rounded-sm px-3 py-2 text-xs font-semibold tracking-wide uppercase ${
                        prefs.finishRadius === id
                          ? "bg-amber text-asphalt"
                          : "border border-asphalt/15 bg-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {(prefs.finishRadius === "50" ||
                  prefs.finishRadius === "100" ||
                  prefs.finishRadius === "home_tonight") && (
                  <label className="mt-3 block">
                    <span className="text-xs tracking-wide text-muted uppercase">
                      Home / base (for finish radius)
                    </span>
                    <input
                      value={prefs.home}
                      onChange={(e) => update("home", e.target.value)}
                      placeholder="Birmingham"
                      className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
                    />
                  </label>
                )}
              </div>
            )}
            {(prefs.mode === "profit" ||
              prefs.mode === "fill_gaps" ||
              prefs.mode === "destination") && (
              <label className="flex items-start gap-3 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={prefs.keepBusy}
                  onChange={(e) => update("keepBusy", e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-asphalt">
                    Keep me busy
                  </span>
                  <span className="text-sm text-muted">
                    Prefer longer multi-leg days over a single strong job.
                  </span>
                </span>
              </label>
            )}
          </div>
          {error && <p className="text-sm text-alert">{error}</p>}
          <button
            type="button"
            onClick={goHunt}
            className="rounded-sm bg-amber px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase"
          >
            {prefs.mode === "fill_gaps"
              ? "Find fillers for my booked job →"
              : "Find jobs for my run →"}
          </button>
        </section>
      )}

      {step === "hunt" && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setStep("mode")}
              className="text-sm font-medium text-amber transition hover:text-asphalt"
            >
              ← All goals
            </button>
            <button
              type="button"
              onClick={() => setStep("setup")}
              className="text-sm font-medium text-muted transition hover:text-asphalt"
            >
              Edit setup
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setHuntPath("shiply")}
              className={`rounded-sm px-4 py-2.5 text-xs font-semibold tracking-wide uppercase ${
                huntPath === "shiply"
                  ? "bg-amber text-asphalt"
                  : "border border-asphalt/15 bg-white text-asphalt"
              }`}
            >
              Phase 1 · Connect Shiply
            </button>
            <button
              type="button"
              onClick={() => setHuntPath("screenshots")}
              className={`rounded-sm px-4 py-2.5 text-xs font-semibold tracking-wide uppercase ${
                huntPath === "screenshots"
                  ? "bg-amber text-asphalt"
                  : "border border-asphalt/15 bg-white text-asphalt"
              }`}
            >
              Phase 2 · Screenshots
            </button>
            <button
              type="button"
              onClick={() => setHuntPath("manual")}
              className={`rounded-sm px-4 py-2.5 text-xs font-semibold tracking-wide uppercase ${
                huntPath === "manual"
                  ? "bg-amber text-asphalt"
                  : "border border-asphalt/15 bg-white text-asphalt"
              }`}
            >
              Phase 3 · Manual
            </button>
          </div>

          {huntPath === "shiply" ? (
            <ShiplyConnect
              key={shiplyTabKey}
              prefs={prefs}
              busy={busy}
              setBusy={setBusy}
              initialDraft={shiplyDraft}
              onDraftChange={handleShiplyDraftChange}
              onStartAgain={clearShiplyTab}
              onSession={(id) => setShiplySessionId(id)}
              onImported={(imported, tip, meta) => {
                setJobs(imported);
                if (meta?.sessionId) setShiplySessionId(meta.sessionId);
                setDetailsFromShiply(Boolean(meta?.detailsLoaded));
                setCoach(
                  tip ||
                    "Jobs opened from your Shiply session. Build the run when ready.",
                );
                setStep("shortlist");
              }}
            />
          ) : huntPath === "manual" ? (
            <div className="space-y-4 border border-asphalt/10 bg-white px-5 py-6 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xs tracking-[0.16em] text-amber uppercase">
                    Phase 3 · Manual entry
                  </p>
                  <h2 className="mt-2 font-display text-2xl tracking-wide text-asphalt uppercase">
                    Type or paste your jobs
                  </h2>
                  <p className="mt-2 max-w-xl text-sm text-muted">
                    Add jobs one at a time or paste a list from Shiply, WhatsApp,
                    or your notes. Same fields as the Job Board — no AI or Shiply
                    login required.
                  </p>
                </div>
                <TabStartAgainButton onClick={clearManualTab} />
              </div>

              <JobManualEntryForm
                onJobsAdded={addManualPending}
                onCoach={setManualCoach}
                onError={setError}
              />

              {manualCoach ? (
                <p className="text-sm text-asphalt">{manualCoach}</p>
              ) : null}

              <JobIngestPreview
                jobs={manualPending}
                selected={manualSelected}
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
                  setManualSelected((s) => ({ ...s, [id]: checked }))
                }
                onSelectAll={(checked) => {
                  const next: Record<string, boolean> = {};
                  for (const j of manualPending) next[j.id] = checked;
                  setManualSelected(next);
                }}
                onAddAll={() => commitManualToShortlist(true)}
                onAddSelected={() => commitManualToShortlist(false)}
                reviewLabel="Review before shortlisting"
                addAllLabel={
                  manualPending.length
                    ? `Shortlist all ${manualPending.length} jobs →`
                    : undefined
                }
                addSelectedLabel="Shortlist selected only"
              />

              {manualPending.length > 0 ? (
                <p className="text-[11px] text-muted">
                  Sources:{" "}
                  {[...new Set(manualPending.map((j) => sourceLabel(j.source)))].join(
                    " · ",
                  )}
                  . Enter your quote on each job when building the run.
                </p>
              ) : null}

              {error ? <p className="text-sm text-alert">{error}</p> : null}
            </div>
          ) : (
          <div
            className="border border-asphalt/10 bg-white px-5 py-6 outline-none focus-within:border-amber/50"
            tabIndex={0}
            onPaste={(e) => {
              const imgs = imagesFromPaste(e);
              if (!imgs.length) return;
              e.preventDefault();
              void queueResultsScreenshots(imgs);
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="font-display text-xs tracking-[0.16em] text-amber uppercase">
                Phase 2 · Search Shiply like this
              </p>
              <TabStartAgainButton onClick={clearScreenshotsTab} />
            </div>
            <h2 className="mt-2 font-display text-2xl tracking-wide text-asphalt uppercase">
              {brief.headline}
            </h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted">
              {brief.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="mt-4 text-sm font-medium text-asphalt">
              {brief.screenshotTip} Paste or upload several overlapping list
              shots (up to {MAX_RESULTS_SHOTS}), then shortlist when ready.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer rounded-sm border border-asphalt/20 bg-white px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase">
                Add results screenshot
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={busy || pendingResults.length >= MAX_RESULTS_SHOTS}
                  onChange={(e) => {
                    void queueResultsScreenshots(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="text-sm text-muted">
                Or paste here (Ctrl+V / ⌘V) — as many as you need
              </p>
            </div>
            {pendingResults.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-xs font-semibold tracking-wide text-asphalt uppercase">
                  Queued ({pendingResults.length}/{MAX_RESULTS_SHOTS}) — not
                  analysed yet
                </p>
                <ul className="flex flex-wrap gap-3">
                  {pendingResults.map((shot, i) => (
                    <li
                      key={shot.id}
                      className="relative w-28 overflow-hidden border border-asphalt/10 bg-concrete/30"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shot.preview}
                        alt={`Results screenshot ${i + 1}`}
                        className="h-20 w-full object-cover object-top"
                      />
                      <button
                        type="button"
                        onClick={() => removePendingResult(shot.id)}
                        className="absolute top-1 right-1 bg-asphalt/80 px-1.5 text-[10px] font-semibold text-white uppercase"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void shortlistFromResults()}
                  className="rounded-sm bg-asphalt px-5 py-3 text-sm font-semibold tracking-wide text-white uppercase disabled:opacity-60"
                >
                  {busy
                    ? "Reading lists…"
                    : `Shortlist from ${pendingResults.length} screenshot${pendingResults.length === 1 ? "" : "s"} →`}
                </button>
              </div>
            )}
            {error && <p className="mt-3 text-sm text-alert">{error}</p>}
          </div>
          )}
        </section>
      )}

      {step === "shortlist" && (
        <section className="space-y-6">
          <button
            type="button"
            onClick={() => setStep("hunt")}
            className="text-sm font-medium text-amber transition hover:text-asphalt"
          >
            ← Upload another list
          </button>
          {coach && (
            <p className="border-l-2 border-amber bg-white px-4 py-3 text-muted">
              {coach}
            </p>
          )}
          <ul className="divide-y divide-asphalt/10 border-y border-asphalt/10">
            {jobs.map((job) => (
              <li
                key={job.id}
                className={`flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between ${
                  verdictTone[job.verdict || "maybe"]
                } border-x px-4`}
              >
                <div>
                  <p className="text-xs font-semibold tracking-wide uppercase">
                    {verdictLabel[job.verdict || "maybe"]}
                  </p>
                  <p className="mt-1 text-lg text-asphalt">
                    {[job.origin, job.destination].filter(Boolean).join(" → ") ||
                      job.item ||
                      "Job"}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {job.item ? `${job.item} · ` : ""}
                    {job.miles != null ? `${job.miles} mi · ` : ""}
                    {job.rateTotal != null
                      ? formatMoney(job.rateTotal, market.currency)
                      : "Pay TBD"}
                  </p>
                  {job.reason && (
                    <p className="mt-1 text-sm text-muted">{job.reason}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div
            className="border border-asphalt/10 bg-white px-5 py-5 outline-none focus-within:border-amber/50"
            tabIndex={0}
            onPaste={(e) => {
              const imgs = imagesFromPaste(e);
              if (!imgs.length) return;
              e.preventDefault();
              void addFullJobScreenshots(imgs);
            }}
          >
            <p className="font-display text-sm tracking-wide text-asphalt uppercase">
              Round 2 — full job details
            </p>
            {detailsFromShiply ? (
              <>
                <p className="mt-2 text-sm text-muted">
                  Full details were pulled from your Shiply session. Build the
                  run, or upload extra screenshots if something looks incomplete.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void buildRun()}
                    className="rounded-sm bg-amber px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase disabled:opacity-60"
                  >
                    {busy ? "Building…" : "Build Run →"}
                  </button>
                  <label className="inline-flex cursor-pointer rounded-sm border border-asphalt/20 px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase">
                    Add screenshots
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => {
                        void addFullJobScreenshots(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted">
                  {shiplySessionId
                    ? "We’ll open the strong jobs in your live Shiply browser and read the full pages — no hunting the list yourself."
                    : `Open ${openJobs.length || "the OPEN/HIGH"} job${openJobs.length === 1 ? "" : "s"} on Shiply, take full screenshots, then upload or paste them here.`}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {shiplySessionId ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void autoOpenStrongJobs()}
                      className="rounded-sm bg-amber px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase disabled:opacity-60"
                    >
                      {busy
                        ? "Opening jobs in Shiply…"
                        : "Auto-open strong jobs →"}
                    </button>
                  ) : (
                    <label className="inline-flex cursor-pointer rounded-sm bg-amber px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase">
                      {busy ? "Reading jobs…" : "Upload full job screenshots →"}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={busy}
                        onChange={(e) => {
                          void addFullJobScreenshots(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                  {!shiplySessionId && (
                    <p className="text-sm text-muted">Or paste (Ctrl+V / ⌘V)</p>
                  )}
                  <button
                    type="button"
                    disabled={
                      busy ||
                      jobs.filter((j) => j.verdict !== "skip").length === 0
                    }
                    onClick={() => void buildRun()}
                    className="rounded-sm border border-asphalt/20 px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase disabled:opacity-40"
                  >
                    Build with shortlist only
                  </button>
                </div>
                {shiplySessionId && (
                  <p className="mt-3 text-xs text-muted">
                    Keep the Shiply results list open in the connected browser.
                    Prefer Phase 1 · Connect Shiply if you started from
                    screenshots.
                  </p>
                )}
              </>
            )}
            {error && <p className="mt-3 text-sm text-alert">{error}</p>}
          </div>
        </section>
      )}

      {step === "build" && (
        <section className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep("shortlist")}
              className="text-sm font-medium text-amber transition hover:text-asphalt"
            >
              ← Back to shortlist
            </button>
            <button
              type="button"
              onClick={() => setStep("mode")}
              className="text-sm font-medium text-muted transition hover:text-asphalt"
            >
              New run
            </button>
          </div>

          {shownBest ? (
            <div className="space-y-4">
              {rankedCombos.length > 0 && (
                <div className="border border-asphalt/10 bg-white px-4 py-4 sm:px-5">
                  <p className="font-display text-xs tracking-[0.14em] text-amber uppercase">
                    Tweak this run
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Same shortlist — re-rank without starting over.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {FOLLOW_UPS.map((id) => {
                      const copy = followUpCopy(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setFollowUp(id)}
                          title={copy.hint}
                          className={`rounded-sm px-3 py-2 text-xs font-semibold tracking-wide uppercase ${
                            followUp === id
                              ? "bg-amber text-asphalt"
                              : "border border-asphalt/15 bg-concrete/20 text-asphalt hover:border-amber"
                          }`}
                        >
                          {copy.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="border border-amber/40 bg-amber/5 px-5 py-6 text-asphalt">
              <p className="font-display text-xs tracking-[0.18em] text-amber uppercase">
                {followUp === "best" ? "Best run" : followUpCopy(followUp).label}
              </p>
              <p className="mt-2 font-display text-3xl tracking-wide uppercase">
                Finish {shownBest.finishAt || "TBD"}
              </p>
              <p className="mt-1 text-sm font-medium text-asphalt/80">
                {shownBest.jobs.length > 1
                  ? `Combined run · ${shownBest.jobs.length} jobs`
                  : "Single job"}
              </p>
              <p className="mt-2 text-muted">{shownBest.summary}</p>
              {shownBest.payMissing && (
                <p className="mt-3 border border-alert/30 bg-red-50 px-3 py-2 text-sm text-alert">
                  Pay wasn’t captured on one or more legs (showing £0 revenue).
                  Profit is cost-only until we read the customer budget from the
                  full Shiply job page — re-open those jobs or paste screenshots.
                </p>
              )}
              {shownBest.legs && shownBest.legs.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-sm text-muted">
                  {shownBest.legs.map((leg, i) => (
                    <li key={`${leg.label}-${i}`}>
                      Leg {i + 1}: {leg.label} · {leg.miles} mi ·{" "}
                      {leg.revenue > 0 ? money(leg.revenue) : "pay missing"}
                    </li>
                  ))}
                  {shownBest.jobs.length > 1 && (
                    <li className="font-medium text-asphalt">
                      Combined revenue {money(shownBest.revenue)} − costs{" "}
                      {money(shownBest.estimatedCost)} (incl.{" "}
                      {shownBest.emptyMiles} empty mi between legs) ={" "}
                      {money(shownBest.estimatedProfit)}
                    </li>
                  )}
                </ul>
              )}

              <RunCorridorStrip combo={shownBest} />

              <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase text-muted">
                    {shownBest.jobs.length > 1 ? "Combined revenue" : "Revenue"}
                  </dt>
                  <dd className="text-xl font-medium">
                    {money(shownBest.revenue)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted">Est. costs</dt>
                  <dd className="text-xl font-medium">
                    {money(shownBest.estimatedCost)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted">Est. profit</dt>
                  <dd className="text-xl font-medium text-emerald-800">
                    {money(shownBest.estimatedProfit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted">Empty mi</dt>
                  <dd className="text-xl font-medium">{shownBest.emptyMiles}</dd>
                </div>
              </dl>
              {shownBest.jobs[0] && (
                <div className="mt-6 border-t border-amber/30 pt-4">
                  <p className="font-display text-xs tracking-wide text-amber uppercase">
                    Next hunt
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                    {nextHuntAfterAnchor(
                      prefs,
                      shownBest.jobs[shownBest.jobs.length - 1],
                    ).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div
                className="mt-5 flex flex-wrap items-center gap-3 outline-none"
                tabIndex={0}
                onPaste={(e) => {
                  const imgs = imagesFromPaste(e);
                  if (!imgs.length) return;
                  e.preventDefault();
                  void addFullJobScreenshots(imgs);
                }}
              >
                <Link
                  href={`/find?need=along&from=${encodeURIComponent(
                    shownBest.jobs[0]?.origin || prefs.start,
                  )}&to=${encodeURIComponent(shownBest.finishAt || "")}`}
                  className="rounded-sm bg-asphalt px-4 py-2.5 text-xs font-semibold tracking-wide text-white uppercase"
                >
                  Services along corridor
                </Link>
                <Link
                  href="/map"
                  className="rounded-sm border border-asphalt/20 bg-white px-4 py-2.5 text-xs font-semibold tracking-wide uppercase"
                >
                  Open Job Board
                </Link>
                <label className="cursor-pointer rounded-sm border border-asphalt/20 bg-white px-4 py-2.5 text-xs font-semibold tracking-wide uppercase">
                  {busy ? "Adding…" : "Add more job screenshots"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => {
                      void addFullJobScreenshots(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="text-xs text-muted">or paste (Ctrl+V / ⌘V)</span>
              </div>
            </div>
            </div>
          ) : (
            <p className="text-muted">
              Upload full job screenshots or build from the shortlist to see
              ranked runs.
            </p>
          )}

          {rankedCombos.length > 1 && (
            <div>
              <p className="font-display text-sm tracking-wide text-asphalt uppercase">
                Alternatives
              </p>
              <ul className="mt-3 divide-y divide-asphalt/10 border-y border-asphalt/10">
                {rankedCombos.slice(1).map((c, i) => (
                  <li key={c.id} className="py-4">
                    <p className="font-medium text-asphalt">
                      Alternative {i + 2} — Finish {c.finishAt}
                    </p>
                    <p className="mt-1 text-sm text-muted">{c.summary}</p>
                    <p className="mt-1 text-sm text-muted">
                      {c.jobs.length > 1
                        ? `${c.jobs.length}-job combo · `
                        : "Solo · "}
                      Profit {money(c.estimatedProfit)} · Revenue{" "}
                      {money(c.revenue)}
                      {c.payMissing ? " · pay missing" : ""}
                      {" · "}
                      {c.emptyMiles} empty mi
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <p className="text-sm text-alert">{error}</p>}
        </section>
      )}
    </div>
  );
}
