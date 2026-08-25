"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMarket } from "@/lib/market-context";
import { formatMoney } from "@/lib/market";
import {
  defaultRunPrefs,
  modeCopy,
  nextHuntAfterAnchor,
  shiplyHuntBrief,
  type JobVerdict,
  type RunCombo,
  type RunJob,
  type RunMode,
  type RunPrefs,
  type WorkWindow,
} from "@/lib/run-builder";

type Step = "mode" | "setup" | "hunt" | "shortlist" | "build";

const vehicles = [
  "Luton van",
  "LWB van",
  "3.5t",
  "7.5t",
  "Artic / trailer",
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

type PendingShot = { id: string; file: File; preview: string };

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

  const brief = useMemo(() => shiplyHuntBrief(prefs), [prefs]);

  function pickMode(mode: RunMode) {
    setPrefs((p) => ({ ...p, mode }));
    setStep("setup");
  }

  function update<K extends keyof RunPrefs>(key: K, value: RunPrefs[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  function clearPendingResults() {
    setPendingResults((prev) => {
      for (const shot of prev) URL.revokeObjectURL(shot.preview);
      return [];
    });
  }

  function queueResultsScreenshots(files: File[] | FileList | null) {
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

    const next = list.slice(0, room).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setPendingResults((prev) => [...prev, ...next].slice(0, MAX_RESULTS_SHOTS));
  }

  function removePendingResult(id: string) {
    setPendingResults((prev) => {
      const shot = prev.find((s) => s.id === id);
      if (shot) URL.revokeObjectURL(shot.preview);
      return prev.filter((s) => s.id !== id);
    });
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
        images.push(await fileToDataUrl(shot.file));
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
        <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
          Build my run
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-wide text-asphalt uppercase sm:text-5xl">
          Let the money choose the day
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Don’t guess which Shiply jobs to chase. Shortlist what to open, upload
          the winners, and we’ll build the most profitable combination from
          where you are.
        </p>
      </section>

      {step === "mode" && (
        <section className="grid gap-4 md:grid-cols-3">
          {(
            [
              "destination",
              "profit",
              "home",
            ] as RunMode[]
          ).map((mode) => {
            const copy = modeCopy(mode);
            return (
              <button
                key={mode}
                type="button"
                onClick={() => pickMode(mode)}
                className="border border-asphalt/15 bg-white px-5 py-6 text-left transition hover:border-amber"
              >
                <p className="font-display text-xs tracking-[0.16em] text-amber uppercase">
                  {mode === "destination"
                    ? "Destination"
                    : mode === "home"
                      ? "Get me home"
                      : "Max profit"}
                </p>
                <p className="mt-3 font-display text-xl tracking-wide text-asphalt uppercase">
                  {copy.title}
                </p>
                <p className="mt-2 text-sm text-muted">{copy.body}</p>
              </button>
            );
          })}
        </section>
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
          <p className="font-display text-2xl tracking-wide text-asphalt uppercase">
            {modeCopy(prefs.mode).title}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs tracking-wide text-muted uppercase">
                Starting from
              </span>
              <input
                value={prefs.start}
                onChange={(e) => update("start", e.target.value)}
                placeholder="Birmingham"
                className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
              />
            </label>
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
              </div>
            )}
          </div>
          {error && <p className="text-sm text-alert">{error}</p>}
          <button
            type="button"
            onClick={goHunt}
            className="rounded-sm bg-amber px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase"
          >
            Find jobs for my run →
          </button>
        </section>
      )}

      {step === "hunt" && (
        <section className="space-y-6">
          <button
            type="button"
            onClick={() => {
              clearPendingResults();
              setStep("setup");
            }}
            className="text-sm font-medium text-amber transition hover:text-asphalt"
          >
            ← Edit setup
          </button>
          <div
            className="border border-asphalt/10 bg-white px-5 py-6 outline-none focus-within:border-amber/50"
            tabIndex={0}
            onPaste={(e) => {
              const imgs = imagesFromPaste(e);
              if (!imgs.length) return;
              e.preventDefault();
              queueResultsScreenshots(imgs);
            }}
          >
            <p className="font-display text-xs tracking-[0.16em] text-amber uppercase">
              Search Shiply like this
            </p>
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
                    queueResultsScreenshots(e.target.files);
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
              Round 2 — open only the strong ones
            </p>
            <p className="mt-2 text-sm text-muted">
              Open {openJobs.length || "the OPEN/HIGH"} job
              {openJobs.length === 1 ? "" : "s"} on Shiply, take full
              screenshots (scroll if needed), then upload or paste them here.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
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
              <p className="text-sm text-muted">Or paste (Ctrl+V / ⌘V)</p>
              <button
                type="button"
                disabled={
                  busy || jobs.filter((j) => j.verdict !== "skip").length === 0
                }
                onClick={() => void buildRun()}
                className="rounded-sm border border-asphalt/20 px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase disabled:opacity-40"
              >
                Build with shortlist only
              </button>
            </div>
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

          {best ? (
            <div className="border border-emerald-200 bg-emerald-50 px-5 py-6 text-asphalt">
              <p className="font-display text-xs tracking-[0.18em] text-emerald-800 uppercase">
                Best run
              </p>
              <p className="mt-2 font-display text-3xl tracking-wide uppercase">
                Finish {best.finishAt || "TBD"}
              </p>
              <p className="mt-2 text-muted">{best.summary}</p>
              <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase text-muted">Revenue</dt>
                  <dd className="text-xl font-medium">{money(best.revenue)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted">Est. costs</dt>
                  <dd className="text-xl font-medium">
                    {money(best.estimatedCost)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted">Est. profit</dt>
                  <dd className="text-xl font-medium text-emerald-800">
                    {money(best.estimatedProfit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted">Empty mi</dt>
                  <dd className="text-xl font-medium">{best.emptyMiles}</dd>
                </div>
              </dl>
              {best.jobs[0] && (
                <div className="mt-6 border-t border-emerald-200/80 pt-4">
                  <p className="font-display text-xs tracking-wide uppercase text-emerald-900">
                    Next hunt
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                    {nextHuntAfterAnchor(prefs, best.jobs[best.jobs.length - 1]).map(
                      (line) => (
                        <li key={line}>{line}</li>
                      ),
                    )}
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
                  href={`/plan?from=${encodeURIComponent(
                    best.jobs[0]?.origin || prefs.start,
                  )}&to=${encodeURIComponent(best.finishAt || "")}`}
                  className="rounded-sm bg-asphalt px-4 py-2.5 text-xs font-semibold tracking-wide text-white uppercase"
                >
                  Plan this corridor
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
          ) : (
            <p className="text-muted">
              Upload full job screenshots or build from the shortlist to see
              ranked runs.
            </p>
          )}

          {combos.length > 1 && (
            <div>
              <p className="font-display text-sm tracking-wide text-asphalt uppercase">
                Alternatives
              </p>
              <ul className="mt-3 divide-y divide-asphalt/10 border-y border-asphalt/10">
                {combos.slice(1).map((c, i) => (
                  <li key={c.id} className="py-4">
                    <p className="font-medium text-asphalt">
                      Alternative {i + 2} — Finish {c.finishAt}
                    </p>
                    <p className="mt-1 text-sm text-muted">{c.summary}</p>
                    <p className="mt-1 text-sm text-muted">
                      Profit {money(c.estimatedProfit)} · Revenue{" "}
                      {money(c.revenue)}
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
