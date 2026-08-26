import type { ProfitResult } from "@/lib/profit";

/** Route-building modes + one-off decision tools */
export type RunMode =
  | "destination"
  | "profit"
  | "home"
  | "fill_gaps"
  | "check_worth"
  | "price_job";

export type WorkWindow = "today" | "tonight" | "2days" | "flexible";

export type FinishRadius = "anywhere" | "50" | "100" | "home_tonight";

export type FinishBy = "flexible" | "18" | "22" | "custom";

export type JobVerdict = "open" | "maybe" | "skip" | "high";

/** Re-rank a built run without starting over */
export type RunFollowUp =
  | "best"
  | "more_money"
  | "less_empty"
  | "shorter"
  | "closer_home"
  | "keep_busy";

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
  /** Fill-gaps: job already booked */
  bookedOrigin: string;
  bookedDestination: string;
  bookedWindow: string;
  /** Prefer longer multi-leg days when ranking */
  keepBusy: boolean;
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
    bookedOrigin: "",
    bookedDestination: "",
    bookedWindow: "",
    keepBusy: false,
  };
}

export function isDecisionMode(mode: RunMode): boolean {
  return mode === "check_worth" || mode === "price_job";
}

export function isHuntMode(mode: RunMode): boolean {
  return (
    mode === "destination" ||
    mode === "profit" ||
    mode === "home" ||
    mode === "fill_gaps"
  );
}

export function modeCopy(mode: RunMode): {
  eyebrow: string;
  title: string;
  body: string;
} {
  switch (mode) {
    case "destination":
      return {
        eyebrow: "Destination",
        title: "I know where I’m going",
        body: "Build the best-paying chain that still gets you to a place you’ve already chosen.",
      };
    case "profit":
      return {
        eyebrow: "Max profit",
        title: "I don’t care where I finish",
        body: "Let money pick the day — strongest combination from where you are now.",
      };
    case "home":
      return {
        eyebrow: "Get me home",
        title: "Get me home profitably",
        body: "Walk you toward base with paying legs instead of a deadhead home.",
      };
    case "fill_gaps":
      return {
        eyebrow: "Already booked",
        title: "I’ve already got a job",
        body: "Lock in what you’ve won, then fill empty time before and after with profitable legs.",
      };
    case "check_worth":
      return {
        eyebrow: "Check a job",
        title: "Is this job worth it?",
        body: "Strip the fee, add empty miles, and see true net £ / mile / hour before you bid.",
      };
    case "price_job":
      return {
        eyebrow: "Price my job",
        title: "What should I quote?",
        body: "Suggest a quote that still pays after Shiply’s cut, fuel, and deadhead.",
      };
  }
}

/** Modes shown on the Build my run picker (order matters). */
export const RUN_MODE_ORDER: RunMode[] = [
  "destination",
  "profit",
  "home",
  "fill_gaps",
  "check_worth",
  "price_job",
];

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
      headline: `Get home to ${home} — hunt jobs that walk you toward base`,
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
  if (prefs.mode === "fill_gaps") {
    const bookedFrom = prefs.bookedOrigin.trim() || "your booked pickup";
    const bookedTo =
      prefs.bookedDestination.trim() || "your booked delivery";
    return {
      headline: `Fill around ${bookedFrom} → ${bookedTo}`,
      steps: [
        `You’ve got ${bookedFrom} → ${bookedTo} locked${prefs.bookedWindow.trim() ? ` (${prefs.bookedWindow.trim()})` : ""}.`,
        `Hunt pickups near ${start} that finish close to ${bookedFrom} before that job.`,
        `After delivery, hunt collections within ~30 miles of ${bookedTo}.`,
        "Screenshot both result lists if you can — we’ll shortlist fillers only.",
      ],
      screenshotTip:
        "Upload results near the booked pickup and/or after the booked drop.",
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
  if (prefs.mode === "fill_gaps") {
    const bookedTo =
      prefs.bookedDestination.trim() || "your booked delivery";
    return [
      `Filler landed near ${dest}.`,
      `If this is before your booked job, next search should still land you at ${prefs.bookedOrigin.trim() || "the booked pickup"}.`,
      `If this is after, hunt onwards from ${bookedTo} or call the day.`,
      "Upload another results list when you’re ready.",
    ];
  }
  return [
    `Anchor job: ${anchor.origin || "?"} → ${dest}.`,
    `Now look for collections near ${dest} (within ~30 miles).`,
    "Any strong onward direction is fine — money decides the finish.",
    "Screenshot that results list or upload the best full jobs.",
  ];
}

export function followUpCopy(id: RunFollowUp): { label: string; hint: string } {
  switch (id) {
    case "more_money":
      return { label: "More money", hint: "Highest estimated profit" };
    case "less_empty":
      return { label: "Less empty", hint: "Cut deadhead miles" };
    case "shorter":
      return { label: "Shorter day", hint: "Fewer legs / tighter day" };
    case "closer_home":
      return { label: "Closer to home", hint: "Finish nearer base" };
    case "keep_busy":
      return { label: "Keep me busy", hint: "More paying legs" };
    default:
      return { label: "Best overall", hint: "Balanced for your goal" };
  }
}

/** Client-side re-order of already-built combos. */
export function applyRunFollowUp(
  combos: RunCombo[],
  followUp: RunFollowUp,
  prefs: RunPrefs,
): RunCombo[] {
  const list = [...combos];
  const homeKey = cityKey(prefs.home);
  list.sort((a, b) => {
    switch (followUp) {
      case "more_money":
        return b.estimatedProfit - a.estimatedProfit;
      case "less_empty":
        return a.emptyMiles - b.emptyMiles || b.estimatedProfit - a.estimatedProfit;
      case "shorter":
        return (
          a.jobs.length - b.jobs.length ||
          a.emptyMiles - b.emptyMiles ||
          b.estimatedProfit - a.estimatedProfit
        );
      case "closer_home": {
        if (!homeKey) return b.estimatedProfit - a.estimatedProfit;
        const aNear = (a.finishAt || "").toLowerCase().includes(homeKey) ? 1 : 0;
        const bNear = (b.finishAt || "").toLowerCase().includes(homeKey) ? 1 : 0;
        if (aNear !== bNear) return bNear - aNear;
        return b.estimatedProfit - a.estimatedProfit;
      }
      case "keep_busy":
        return (
          b.jobs.length - a.jobs.length ||
          b.utilisationPct - a.utilisationPct ||
          b.estimatedProfit - a.estimatedProfit
        );
      default:
        return 0;
    }
  });
  return list;
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
      const fillBias =
        prefs.mode === "fill_gaps" &&
        (placesLink(candidate.destination, prefs.bookedOrigin) ||
          placesLink(candidate.origin, prefs.bookedDestination) ||
          placesLink(first.destination, prefs.bookedOrigin));
      if (linked || homeBias || destBias || fillBias || chain.length === 1) {
        if (
          (prefs.mode === "profit" || prefs.mode === "fill_gaps") &&
          chain.length >= 1 &&
          !linked &&
          !fillBias
        ) {
          if (candidate.verdict !== "open" && candidate.verdict !== "high") {
            continue;
          }
        }
        chain.push(candidate);
        tip = (candidate.destination || tip).toLowerCase();
        const maxLegs = prefs.keepBusy || prefs.mode === "fill_gaps" ? 4 : 3;
        if (chain.length >= maxLegs) break;
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
    if (prefs.mode === "fill_gaps") {
      const bookedPu = cityKey(prefs.bookedOrigin);
      const bookedDo = cityKey(prefs.bookedDestination);
      const touches = (c: RunCombo) =>
        c.jobs.some(
          (j) =>
            placesLink(j.destination, prefs.bookedOrigin) ||
            placesLink(j.origin, prefs.bookedDestination) ||
            (bookedPu &&
              (j.destination || "").toLowerCase().includes(bookedPu)) ||
            (bookedDo && (j.origin || "").toLowerCase().includes(bookedDo)),
        );
      if (touches(a)) scoreA += 90;
      if (touches(b)) scoreB += 90;
    }
    // Slightly prefer longer chains when pay is known / keep busy
    const legBonus = prefs.keepBusy ? 12 : 5;
    if (!a.payMissing) scoreA += a.jobs.length * legBonus;
    if (!b.payMissing) scoreB += b.jobs.length * legBonus;
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
