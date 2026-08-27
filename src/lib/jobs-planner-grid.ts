import {
  directionFromBearing,
  geocodedJobs,
  type DirectionId,
} from "@/lib/jobs-map-explore";
import {
  connectionQuality,
  DEFAULT_RUN_PREFS,
  scoreJobConnection,
  type BidPlan,
  type ConnectionQuality,
  type RunBuilderPrefs,
} from "@/lib/jobs-run-builder";
import { placeKey, shortPlace, jobMyBid, type JobsMapDriver, type MapJob } from "@/lib/jobs-map";
import { resolveUkPlace, type LatLon } from "@/lib/uk-places";

export type PlannerTab = "jobs" | "connections" | "runs";

export type PlannerSort =
  | "default"
  | "job"
  | "pay"
  | "rpm"
  | "miles"
  | "pickup"
  | "drop"
  | "deadhead"
  | "fromMe"
  | "nextPickup"
  | "bestNext"
  | "fit";

export type PlannerSortDir = "asc" | "desc";

/** Preferred first click direction for each column. */
export const PLANNER_SORT_DEFAULT_DIR: Record<PlannerSort, PlannerSortDir> = {
  default: "asc",
  job: "asc",
  pay: "desc",
  rpm: "desc",
  miles: "asc",
  pickup: "asc",
  drop: "asc",
  deadhead: "asc",
  fromMe: "asc",
  nextPickup: "asc",
  bestNext: "asc",
  fit: "asc",
};

const FIT_RANK: Record<string, number> = {
  excellent: 0,
  good: 1,
  possible: 2,
  home: 3,
  poor: 4,
};

export type PlannerFilters = {
  maxFromMe: number | null;
  maxDeadhead: number | null;
  minValue: number | null;
  direction: DirectionId | null;
  endNearHome: boolean;
};

export const DEFAULT_PLANNER_FILTERS: PlannerFilters = {
  maxFromMe: null,
  maxDeadhead: null,
  minValue: null,
  direction: null,
  endNearHome: false,
};

export type FitIndicator = {
  emoji: string;
  label: string;
  tone: "excellent" | "good" | "possible" | "poor" | "home";
};

export type PlannerJobRow = {
  job: MapJob;
  code: string;
  pickup: string;
  drop: string;
  pay: number;
  miles: number;
  rpm: number;
  emptyToPickup: number | null;
  direction: DirectionId | null;
  bestNext: {
    job: MapJob;
    code: string;
    route: string;
    deadhead: number;
    quality: ConnectionQuality;
  } | null;
  endsNearHome: boolean;
  fit: FitIndicator;
};

export type JobConnection = {
  fromJob: MapJob;
  toJob: MapJob;
  fromCode: string;
  toCode: string;
  route: string;
  deadheadMi: number;
  quality: ConnectionQuality;
  pay: number;
  miles: number;
  rpm: number;
  direction: DirectionId | null;
  score: number;
  fit: FitIndicator;
};

export type ChainSummary = {
  jobIds: string[];
  jobs: MapJob[];
  revenue: number;
  loadedMiles: number;
  emptyMiles: number;
  totalMiles: number;
  revenuePerMile: number;
  emptyPct: number;
  endsNearHome: boolean;
  legs: Array<{
    job: MapJob;
    code: string;
    route: string;
    pay: number;
    emptyBefore: number | null;
    label: string;
  }>;
};

type ScoredEntry = {
  job: MapJob;
  pickup: LatLon;
  drop: LatLon;
  code: string;
};

function haversineMi(a: LatLon, b: LatLon) {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function bearingDeg(from: LatLon, to: LatLon) {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLon = ((to.lon - from.lon) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function jobPay(j: MapJob) {
  return jobMyBid(j);
}

function driverPoint(driver: JobsMapDriver | null): LatLon | null {
  if (driver?.lat != null && driver?.lon != null) {
    return { lat: driver.lat, lon: driver.lon };
  }
  return resolveUkPlace(driver?.label);
}

function cityMatch(a: string | null | undefined, b: string | null | undefined) {
  const ca = placeKey(a);
  const cb = placeKey(b);
  if (!ca || !cb) return false;
  return ca === cb || ca.includes(cb) || cb.includes(ca);
}

function entryLoadedMiles(entry: ScoredEntry) {
  if (entry.job.miles != null && entry.job.miles > 0) return entry.job.miles;
  return Math.round(haversineMi(entry.pickup, entry.drop));
}

function jobCode(job: MapJob, index: number) {
  const n = index + 1;
  return n < 100 ? `J${n}` : `J${String(job.id).slice(-3)}`;
}

export function fitIndicator(
  quality: ConnectionQuality,
  endsNearHome = false,
): FitIndicator {
  if (endsNearHome) {
    return { emoji: "🏠", label: "Near home", tone: "home" };
  }
  switch (quality) {
    case "excellent":
      return { emoji: "🟢", label: "Excellent", tone: "excellent" };
    case "good":
      return { emoji: "🟢", label: "Good", tone: "good" };
    case "acceptable":
      return { emoji: "🟠", label: "Possible", tone: "possible" };
    case "poor":
      return { emoji: "🔴", label: "Poor", tone: "poor" };
    default:
      return { emoji: "🔴", label: "Reject", tone: "poor" };
  }
}

function toScoredEntries(jobs: MapJob[]): ScoredEntry[] {
  const mapped = geocodedJobs(
    jobs.filter((j) => j.status !== "skipped" && j.status !== "delivered"),
  );
  return mapped.map((job, i) => {
    const pickup = resolveUkPlace(job.origin)!;
    const drop = resolveUkPlace(job.destination)!;
    return { job, pickup, drop, code: jobCode(job, i) };
  });
}

function codeMap(entries: ScoredEntry[]) {
  return new Map(entries.map((e) => [e.job.id, e.code]));
}

function routeLabel(job: MapJob) {
  return `${shortPlace(job.origin)} → ${shortPlace(job.destination)}`;
}

function directionBetween(from: LatLon, to: LatLon): DirectionId {
  return directionFromBearing(bearingDeg(from, to));
}

export function connectionsFromJob(
  from: MapJob,
  pool: MapJob[],
  driver: JobsMapDriver | null,
  prefs: RunBuilderPrefs = DEFAULT_RUN_PREFS,
  limit = 10,
): JobConnection[] {
  const entries = toScoredEntries(pool);
  const codes = codeMap(entries);
  const fromEntry = entries.find((e) => e.job.id === from.id);
  if (!fromEntry) return [];

  const out: JobConnection[] = [];
  for (const to of entries) {
    if (to.job.id === from.id) continue;
    const deadheadMi = Math.round(haversineMi(fromEntry.drop, to.pickup));
    const quality = connectionQuality(deadheadMi);
    const score = scoreJobConnection(fromEntry.drop, to, prefs, driver);
    if (score <= -Infinity && quality === "reject") continue;

    const pay = jobPay(to.job);
    const miles = entryLoadedMiles(to);
    const rpm = miles + deadheadMi > 0 ? pay / (miles + deadheadMi) : 0;

    out.push({
      fromJob: from,
      toJob: to.job,
      fromCode: fromEntry.code,
      toCode: codes.get(to.job.id) ?? "?",
      route: routeLabel(to.job),
      deadheadMi,
      quality,
      pay,
      miles,
      rpm,
      direction: directionBetween(fromEntry.drop, to.pickup),
      score,
      fit: fitIndicator(quality),
    });
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

export function buildPlannerRows(
  jobs: MapJob[],
  driver: JobsMapDriver | null,
  prefs: RunBuilderPrefs = DEFAULT_RUN_PREFS,
): PlannerJobRow[] {
  const entries = toScoredEntries(jobs);
  const codes = codeMap(entries);
  const dpt = driverPoint(driver);

  return entries.map((entry) => {
    const pay = jobPay(entry.job);
    const miles = entryLoadedMiles(entry);
    const rpm = miles > 0 ? pay / miles : 0;
    const emptyToPickup = dpt
      ? Math.round(haversineMi(dpt, entry.pickup))
      : null;

    const direction = dpt
      ? directionBetween(dpt, entry.pickup)
      : directionBetween(entry.pickup, entry.drop);

    const endsNearHome =
      Boolean(dpt) && cityMatch(entry.job.destination, driver?.label);

    const nextOptions = connectionsFromJob(
      entry.job,
      jobs,
      driver,
      prefs,
      1,
    );
    const best = nextOptions[0];
    const bestNext = best
      ? {
          job: best.toJob,
          code: best.toCode,
          route: best.route,
          deadhead: best.deadheadMi,
          quality: best.quality,
        }
      : null;

    const rowFit = endsNearHome
      ? fitIndicator("good", true)
      : bestNext
        ? fitIndicator(bestNext.quality)
        : fitIndicator(
            emptyToPickup != null
              ? connectionQuality(emptyToPickup)
              : "acceptable",
          );

    return {
      job: entry.job,
      code: codes.get(entry.job.id) ?? "?",
      pickup: shortPlace(entry.job.origin),
      drop: shortPlace(entry.job.destination),
      pay,
      miles,
      rpm,
      emptyToPickup,
      direction,
      bestNext,
      endsNearHome,
      fit: rowFit,
    };
  });
}

export function filterPlannerRows(
  rows: PlannerJobRow[],
  filters: PlannerFilters,
): PlannerJobRow[] {
  return rows.filter((r) => {
    if (filters.maxFromMe != null && r.emptyToPickup != null) {
      if (r.emptyToPickup > filters.maxFromMe) return false;
    }
    if (filters.maxDeadhead != null) {
      const dh = r.bestNext?.deadhead ?? r.emptyToPickup;
      if (dh != null && dh > filters.maxDeadhead) return false;
    }
    if (filters.minValue != null && r.pay < filters.minValue) return false;
    if (filters.direction && r.direction !== filters.direction) return false;
    if (filters.endNearHome && !r.endsNearHome) return false;
    return true;
  });
}

export function sortPlannerRows(
  rows: PlannerJobRow[],
  sort: PlannerSort,
  dir: PlannerSortDir = "asc",
): PlannerJobRow[] {
  if (sort === "default") return [...rows];

  const mul = dir === "asc" ? 1 : -1;
  const copy = [...rows];
  copy.sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case "job":
        cmp = a.code.localeCompare(b.code, undefined, { numeric: true });
        break;
      case "pay":
        cmp = a.pay - b.pay;
        break;
      case "rpm":
        cmp = a.rpm - b.rpm;
        break;
      case "miles":
        cmp = a.miles - b.miles;
        break;
      case "pickup":
        cmp = a.pickup.localeCompare(b.pickup);
        break;
      case "drop":
        cmp = a.drop.localeCompare(b.drop);
        break;
      case "deadhead":
        cmp =
          (a.bestNext?.deadhead ?? 9999) - (b.bestNext?.deadhead ?? 9999);
        break;
      case "fromMe":
        cmp = (a.emptyToPickup ?? 9999) - (b.emptyToPickup ?? 9999);
        break;
      case "nextPickup":
        cmp = (a.bestNext?.route ?? "").localeCompare(b.bestNext?.route ?? "");
        break;
      case "bestNext":
        cmp = (a.bestNext?.code ?? "zzz").localeCompare(
          b.bestNext?.code ?? "zzz",
          undefined,
          { numeric: true },
        );
        break;
      case "fit":
        cmp =
          (FIT_RANK[a.fit.tone] ?? 9) - (FIT_RANK[b.fit.tone] ?? 9);
        break;
      default:
        cmp = 0;
    }
    if (cmp !== 0) return cmp * mul;
    return a.code.localeCompare(b.code, undefined, { numeric: true });
  });
  return copy;
}

export function buildManualChain(
  chainJobIds: string[],
  jobs: MapJob[],
  driver: JobsMapDriver | null,
): ChainSummary | null {
  if (!chainJobIds.length) return null;

  const entries = toScoredEntries(jobs);
  const codes = codeMap(entries);
  const chain = chainJobIds
    .map((id) => entries.find((e) => e.job.id === id))
    .filter(Boolean) as ScoredEntry[];

  if (!chain.length) return null;

  const dpt = driverPoint(driver);
  let emptyMiles = 0;
  let loadedMiles = 0;
  let revenue = 0;
  const legs: ChainSummary["legs"] = [];

  chain.forEach((entry, i) => {
    const pay = jobPay(entry.job);
    revenue += pay;
    loadedMiles += entryLoadedMiles(entry);

    let emptyBefore: number | null = null;
    if (i === 0 && dpt) {
      emptyBefore = Math.round(haversineMi(dpt, entry.pickup));
      emptyMiles += emptyBefore;
    } else if (i > 0) {
      const prev = chain[i - 1]!;
      emptyBefore = Math.round(haversineMi(prev.drop, entry.pickup));
      emptyMiles += emptyBefore;
    }

    legs.push({
      job: entry.job,
      code: codes.get(entry.job.id) ?? "?",
      route: routeLabel(entry.job),
      pay,
      emptyBefore,
      label:
        emptyBefore != null && emptyBefore > 0
          ? `${routeLabel(entry.job)} (${emptyBefore} mi empty)`
          : routeLabel(entry.job),
    });
  });

  const totalMiles = loadedMiles + emptyMiles;
  const last = chain[chain.length - 1]!;
  const endsNearHome =
    Boolean(dpt) && cityMatch(last.job.destination, driver?.label);

  return {
    jobIds: chainJobIds,
    jobs: chain.map((c) => c.job),
    revenue,
    loadedMiles,
    emptyMiles,
    totalMiles,
    revenuePerMile: totalMiles > 0 ? revenue / totalMiles : 0,
    emptyPct: totalMiles > 0 ? (emptyMiles / totalMiles) * 100 : 0,
    endsNearHome,
    legs,
  };
}

/** Compact matrix cells for a focused set of jobs (contextual, not full 59×59). */
export function buildConnectionMatrix(
  focusJobs: MapJob[],
  pool: MapJob[],
  driver: JobsMapDriver | null,
  maxDeadhead = 80,
  prefs: RunBuilderPrefs = DEFAULT_RUN_PREFS,
): {
  rows: Array<{ job: MapJob; code: string; route: string }>;
  cols: Array<{ job: MapJob; code: string; route: string }>;
  cells: Array<Array<{ deadhead: number | null; quality: ConnectionQuality | null; fit: FitIndicator | null }>>;
} {
  const entries = toScoredEntries(focusJobs.slice(0, 12));
  const targets = toScoredEntries(
    pool
      .filter((j) => j.status !== "skipped" && j.status !== "delivered")
      .slice(0, 12),
  );
  const codes = codeMap([...entries, ...targets]);

  const rows = entries.map((e) => ({
    job: e.job,
    code: codes.get(e.job.id) ?? "?",
    route: routeLabel(e.job),
  }));

  const cols = targets.map((e) => ({
    job: e.job,
    code: codes.get(e.job.id) ?? "?",
    route: routeLabel(e.job),
  }));

  const cells = entries.map((from) =>
    targets.map((to) => {
      if (from.job.id === to.job.id) {
        return { deadhead: null, quality: null, fit: null };
      }
      const deadhead = Math.round(haversineMi(from.drop, to.pickup));
      if (deadhead > maxDeadhead) {
        return {
          deadhead,
          quality: "reject" as ConnectionQuality,
          fit: fitIndicator("reject"),
        };
      }
      const quality = connectionQuality(deadhead);
      const score = scoreJobConnection(from.drop, to, prefs, driver);
      if (score <= -Infinity) {
        return { deadhead, quality: "reject" as ConnectionQuality, fit: fitIndicator("reject") };
      }
      return { deadhead, quality, fit: fitIndicator(quality) };
    }),
  );

  return { rows, cols, cells };
}

export type PlannerRunRow = {
  plan: BidPlan;
  runLabel: string;
  jobsCount: number;
  revenue: number;
  totalMiles: number;
  emptyMiles: number;
  rpm: number;
  ends: string;
};

export function bidPlansToRunRows(plans: BidPlan[]): PlannerRunRow[] {
  return plans.map((plan, i) => ({
    plan,
    runLabel: String.fromCharCode(65 + i),
    jobsCount: plan.jobs.length,
    revenue: plan.revenue,
    totalMiles: plan.totalMiles,
    emptyMiles: plan.emptyMiles,
    rpm: plan.revenuePerMile,
    ends: plan.endsNearHome
      ? shortPlace(plan.jobs[plan.jobs.length - 1]?.destination)
      : shortPlace(plan.jobs[plan.jobs.length - 1]?.destination),
  }));
}
