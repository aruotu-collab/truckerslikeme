import type { ProfitResult } from "@/lib/profit";

export type RunMode = "destination" | "profit" | "home";

export type WorkWindow = "today" | "tonight" | "2days" | "flexible";

export type FinishRadius = "anywhere" | "50" | "100" | "home_tonight";

export type FinishBy = "flexible" | "18" | "22" | "custom";

export type JobVerdict = "open" | "maybe" | "skip" | "high";

export type RunJob = {
  id: string;
  origin: string | null;
  destination: string | null;
  miles: number | null;
  rateTotal: number | null;
  item: string | null;
  verdict?: JobVerdict;
  reason?: string;
  notes?: string[];
};

export type RunCombo = {
  id: string;
  label: string;
  jobs: RunJob[];
  finishAt: string | null;
  revenue: number;
  estimatedCost: number;
  estimatedProfit: number;
  emptyMiles: number;
  utilisationPct: number;
  summary: string;
  /** True when one or more legs have no captured pay */
  payMissing?: boolean;
  /** Per-leg money/miles used in the combined total */
  legs?: { label: string; revenue: number; miles: number }[];
};

export type RunPrefs = {
  mode: RunMode;
  start: string;
  home: string;
  destination: string;
  vehicle: string;
  workWindow: WorkWindow;
  finishRadius: FinishRadius;
  finishBy: FinishBy;
  availableFrom: string;
};

export function defaultRunPrefs(): RunPrefs {
  return {
    mode: "profit",
    start: "",
    home: "",
    destination: "",
    vehicle: "Luton van",
    workWindow: "today",
    finishRadius: "anywhere",
    finishBy: "flexible",
    availableFrom: "07:00",
  };
}

export function modeCopy(mode: RunMode): {
  title: string;
  body: string;
} {
  switch (mode) {
    case "destination":
      return {
        title: "I know where I’m going",
        body: "Build the best run toward a destination you already chose.",
      };
    case "home":
      return {
        title: "Get me home profitably",
        body: "Find jobs that pay you toward home instead of running empty.",
      };
    default:
      return {
        title: "I don’t care where I finish",
        body: "Find the most profitable combination from where you are now.",
      };
  }
}

export function workWindowLabel(w: WorkWindow) {
  switch (w) {
    case "tonight":
      return "Until tonight";
    case "2days":
      return "2 days";
    case "flexible":
      return "No preference";
    default:
      return "Today";
  }
}

/** Coach the Shiply search before screenshots. */
export function shiplyHuntBrief(prefs: RunPrefs): {
  headline: string;
  steps: string[];
  screenshotTip: string;
} {
  const start = prefs.start.trim() || "your start area";
  if (prefs.mode === "home") {
    const home = prefs.home.trim() || "home";
    return {
      headline: `Get home to ${home} — hunt jobs that walk you south/toward base`,
      steps: [
        `On Shiply, local search: pickups within ~25–50 miles of ${start}.`,
        `Prefer deliveries that move you toward ${home} — not the opposite way.`,
        "Screenshot the results list first (not every job yet).",
        "We’ll mark which rows are worth opening for full details.",
      ],
      screenshotTip:
        "Upload one Shiply search-results screenshot. We’ll tell you which jobs to open.",
    };
  }
  if (prefs.mode === "destination") {
    const dest = prefs.destination.trim() || "your destination";
    return {
      headline: `Jobs that help you toward ${dest}`,
      steps: [
        `Local search near ${start} (25–50 mile radius).`,
        `Prioritise deliveries heading toward ${dest} or useful midpoints on the way.`,
        "Skip obvious backtracks unless the money is exceptional.",
        "Screenshot the results list — we’ll shortlist what to open.",
      ],
      screenshotTip:
        "One results-page screenshot is enough for Round 1.",
    };
  }
  return {
    headline: `Most money from ${start} — don’t pick a finish yet`,
    steps: [
      `Shiply local search: ${start}, radius 25–50 miles, pickup today/tomorrow.`,
      "Screenshot the job list — paste/upload several overlapping shots if needed.",
      "We’ll flag OPEN / MAYBE / SKIP so you only open the strong ones.",
      "After that, upload full job screenshots for the shortlist and we’ll build combinations.",
    ],
    screenshotTip:
      "Start with the Shiply results page — not individual jobs.",
  };
}

export function nextHuntAfterAnchor(
  prefs: RunPrefs,
  anchor: RunJob,
): string[] {
  const dest = anchor.destination || "the delivery area";
  if (prefs.mode === "home") {
    return [
      `Great first leg. Now search pickups within ~30 miles of ${dest}.`,
      `Prefer deliveries still progressing toward ${prefs.home.trim() || "home"}.`,
      "Collection after this job’s likely delivery window.",
      "Screenshot the new results list, or upload 2–3 full jobs that fit.",
    ];
  }
  if (prefs.mode === "destination") {
    return [
      `Anchor set: ${anchor.origin || "?"} → ${dest}.`,
      `Search around ${dest} and midpoints still useful for ${prefs.destination.trim() || "your destination"}.`,
      "Upload the next results list or full jobs that continue the haul.",
    ];
  }
  return [
    `Anchor job: ${anchor.origin || "?"} → ${dest}.`,
    `Now look for collections near ${dest} (within ~30 miles).`,
    "Any strong onward direction is fine — money decides the finish.",
    "Screenshot that results list or upload the best full jobs.",
  ];
}

function money(n: number | null | undefined) {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function hasPay(j: RunJob) {
  return typeof j.rateTotal === "number" && Number.isFinite(j.rateTotal) && j.rateTotal > 0;
}

function miles(n: number | null | undefined) {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 80;
}

function cityKey(place: string | null | undefined) {
  return (place || "").split(",")[0]?.trim().toLowerCase() || "";
}

function placesLink(a: string | null | undefined, b: string | null | undefined) {
  const ca = cityKey(a);
  const cb = cityKey(b);
  if (!ca || !cb) return false;
  return ca.includes(cb) || cb.includes(ca);
}

function comboFromJobs(
  jobs: RunJob[],
  id: string,
  label: string,
  costPerMile: number,
): RunCombo {
  const legs = jobs.map((j) => ({
    label: `${j.origin || "?"} → ${j.destination || "?"}`,
    revenue: money(j.rateTotal),
    miles: miles(j.miles),
  }));
  const revenue = legs.reduce((s, l) => s + l.revenue, 0);
  const loaded = legs.reduce((s, l) => s + l.miles, 0);

  // Empty between consecutive legs: small if delivery≈next pickup, larger if not.
  let empty = 0;
  for (let i = 0; i < jobs.length - 1; i++) {
    const linked = placesLink(jobs[i]?.destination, jobs[i + 1]?.origin);
    const hop = linked
      ? Math.max(8, Math.round(miles(jobs[i + 1]?.miles) * 0.06))
      : Math.max(
          35,
          Math.round((miles(jobs[i]?.miles) + miles(jobs[i + 1]?.miles)) * 0.1),
        );
    empty += hop;
  }

  const cost = (loaded + empty) * costPerMile;
  const payMissing = jobs.some((j) => !hasPay(j));
  return {
    id,
    label,
    jobs,
    finishAt: jobs[jobs.length - 1]?.destination ?? null,
    revenue: Math.round(revenue * 100) / 100,
    estimatedCost: Math.round(cost * 100) / 100,
    estimatedProfit: Math.round((revenue - cost) * 100) / 100,
    emptyMiles: empty,
    utilisationPct:
      loaded + empty > 0 ? Math.round((loaded / (loaded + empty)) * 100) : 0,
    summary: legs.map((l) => l.label).join(" · "),
    payMissing,
    legs,
  };
}

/** Build solo + multi-leg runs; combo profit = sum(leg pay) − cost(all loaded + empty between). */
export function rankRunCombos(
  jobs: RunJob[],
  prefs: RunPrefs,
  costPerMile = 0.9,
): RunCombo[] {
  const usable = jobs.filter(
    (j) =>
      j.origin &&
      j.destination &&
      (j.verdict === "open" ||
        j.verdict === "high" ||
        j.verdict === "maybe" ||
        !j.verdict),
  );
  if (usable.length === 0) return [];

  const scored = [...usable].sort((a, b) => {
    // Known pay first, then revenue density
    const payA = hasPay(a) ? 1 : 0;
    const payB = hasPay(b) ? 1 : 0;
    if (payA !== payB) return payB - payA;
    const da = money(a.rateTotal) / miles(a.miles);
    const db = money(b.rateTotal) / miles(b.miles);
    return db - da;
  });

  const combos: RunCombo[] = [];

  for (const j of scored.slice(0, 5)) {
    combos.push(
      comboFromJobs(
        [j],
        `solo-${j.id}`,
        `Solo · finish ${j.destination}`,
        costPerMile,
      ),
    );
  }

  for (const first of scored.slice(0, 4)) {
    const chain: RunJob[] = [first];
    let tip = (first.destination || "").toLowerCase();
    for (const candidate of scored) {
      if (chain.some((c) => c.id === candidate.id)) continue;
      const pu = (candidate.origin || "").toLowerCase();
      const linked =
        tip &&
        (pu.includes(tip.split(",")[0]?.trim() || tip) ||
          tip.includes(pu.split(",")[0]?.trim() || pu));
      const homeBias =
        prefs.mode === "home" &&
        prefs.home &&
        (candidate.destination || "")
          .toLowerCase()
          .includes(prefs.home.split(",")[0].trim().toLowerCase());
      const destBias =
        prefs.mode === "destination" &&
        prefs.destination &&
        (candidate.destination || "")
          .toLowerCase()
          .includes(prefs.destination.split(",")[0].trim().toLowerCase());
      if (linked || homeBias || destBias || chain.length === 1) {
        if (prefs.mode === "profit" && chain.length >= 1 && !linked) {
          if (candidate.verdict !== "open" && candidate.verdict !== "high") {
            continue;
          }
        }
        chain.push(candidate);
        tip = (candidate.destination || tip).toLowerCase();
        if (chain.length >= 3) break;
      }
    }
    if (chain.length < 2) continue;
    const finish = chain[chain.length - 1]?.destination ?? null;
    combos.push(
      comboFromJobs(
        chain,
        `chain-${chain.map((c) => c.id).join("-")}`,
        `Run · ${chain.length} jobs · finish ${finish}`,
        costPerMile,
      ),
    );
  }

  const ranked = combos.sort((a, b) => {
    // Prefer runs where we actually know the pay
    const payA = a.payMissing ? 0 : 1;
    const payB = b.payMissing ? 0 : 1;
    if (payA !== payB) return payB - payA;

    let scoreA = a.estimatedProfit;
    let scoreB = b.estimatedProfit;
    if (prefs.mode === "home" && prefs.home) {
      const h = prefs.home.split(",")[0].trim().toLowerCase();
      if ((a.finishAt || "").toLowerCase().includes(h)) scoreA += 80;
      if ((b.finishAt || "").toLowerCase().includes(h)) scoreB += 80;
    }
    if (prefs.mode === "destination" && prefs.destination) {
      const d = prefs.destination.split(",")[0].trim().toLowerCase();
      if ((a.finishAt || "").toLowerCase().includes(d)) scoreA += 80;
      if ((b.finishAt || "").toLowerCase().includes(d)) scoreB += 80;
    }
    // Slightly prefer longer chains when pay is known
    if (!a.payMissing) scoreA += a.jobs.length * 5;
    if (!b.payMissing) scoreB += b.jobs.length * 5;
    return scoreB - scoreA;
  });

  const seen = new Set<string>();
  return ranked
    .filter((c) => {
      const key = c.summary.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

export type { ProfitResult };
