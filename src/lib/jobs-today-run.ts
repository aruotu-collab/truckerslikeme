import {
  boardJobSnapshot,
  deadheadToJob,
  loadedMilesForJob,
} from "@/lib/board-job-decision";
import { evaluateJob, type JobDecision } from "@/lib/job-decision";
import {
  jobMyBid,
  placeKey,
  shortPlace,
  type JobsMapDriver,
  type MapJob,
} from "@/lib/jobs-map";
import {
  connectionsFromJob,
  type FitIndicator,
  type JobConnection,
} from "@/lib/jobs-planner-grid";
import { operatingDefaultsForMarket } from "@/lib/market-defaults";
import type { DriverMarket } from "@/lib/market";
import { resolveUkPlace } from "@/lib/uk-places";

const SHIPLY_FEE_PCT = 0.13;

export type RunChainNet = {
  jobCount: number;
  revenue: number;
  afterFee: number;
  shiplyFee: number;
  loadedMiles: number;
  emptyMiles: number;
  totalMiles: number;
  totalCost: number;
  estimatedNet: number;
  netPerMile: number;
  revenuePerMile: number;
};

function opsFor(market: Pick<DriverMarket, "countryCode"> | null | undefined) {
  const ops = operatingDefaultsForMarket(market);
  return {
    dieselPrice: ops.dieselPrice,
    economy: ops.economy,
    costPerMile: ops.costPerMile,
    fuelUnit: ops.fuelUnit,
    economyUnit: ops.economyUnit,
    shiplyFeePct: SHIPLY_FEE_PCT,
  };
}

function driverAtPlace(label: string | null | undefined): JobsMapDriver | null {
  const trimmed = label?.trim();
  if (!trimmed) return null;
  const pt = resolveUkPlace(trimmed);
  return {
    label: shortPlace(trimmed) || trimmed,
    lat: pt?.lat ?? null,
    lon: pt?.lon ?? null,
  };
}

/** Position at a job's drop — used after marking won. */
export function driverAtJobDrop(job: MapJob): JobsMapDriver | null {
  return driverAtPlace(job.destination);
}

export function positionsDiffer(
  a: JobsMapDriver | null,
  b: JobsMapDriver | null,
): boolean {
  if (!a?.label?.trim() || !b?.label?.trim()) return false;
  return placeKey(a.label) !== placeKey(b.label);
}

export function orderTodayRun(ids: string[], jobs: MapJob[]): MapJob[] {
  const byId = new Map(jobs.map((j) => [j.id, j]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as MapJob[];
}

export function appendTodayRunId(ids: string[], jobId: string): string[] {
  if (ids.includes(jobId)) return ids;
  return [...ids, jobId];
}

/** Append new ids to the end — keeps existing queue order. */
export function mergeTodayRunIds(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing);
  const merged = [...existing];
  for (const id of incoming) {
    if (!seen.has(id)) {
      merged.push(id);
      seen.add(id);
    }
  }
  return merged;
}

/** Replace the whole queue with a new ordered list. */
export function replaceTodayRunIds(incoming: string[]): string[] {
  return [...new Set(incoming)];
}

/** Same origin/destination as a job already in today's run (duplicate Shiply listings). */
export function jobRouteKey(job: Pick<MapJob, "origin" | "destination">): string {
  const o = placeKey(job.origin);
  const d = placeKey(job.destination);
  return o && d ? `${o}|${d}` : "";
}

export function isInTodayRun(jobId: string, todayRunIds: string[]): boolean {
  return todayRunIds.includes(jobId);
}

/** Id match, or same route already in the chain (different listing id). */
export function isJobOrRouteInTodayRun(
  job: MapJob,
  todayRunIds: string[],
  jobs: MapJob[],
): boolean {
  if (todayRunIds.includes(job.id)) return true;
  const key = jobRouteKey(job);
  if (!key) return false;
  return orderTodayRun(todayRunIds, jobs).some((j) => jobRouteKey(j) === key);
}

export function pruneTodayRunIds(todayRunIds: string[], jobs: MapJob[]): string[] {
  const byId = new Map(jobs.map((j) => [j.id, j]));
  return todayRunIds.filter((id) => {
    const job = byId.get(id);
    if (!job) return false;
    return job.status === "won";
  });
}

/** Full-chain economics from start through ordered jobs. */
export function evaluateRunChain(
  jobs: MapJob[],
  start: JobsMapDriver | null,
  market: Pick<DriverMarket, "countryCode"> | null | undefined,
): RunChainNet | null {
  if (!jobs.length) return null;
  const ops = opsFor(market);
  let cursor: JobsMapDriver | null = start;
  let loaded = 0;
  let empty = 0;
  let revenue = 0;
  let afterFee = 0;
  let totalCost = 0;
  let counted = 0;

  for (const job of jobs) {
    const loadMi = loadedMilesForJob(job);
    const bid = jobMyBid(job);
    if (loadMi == null || loadMi <= 0) continue;

    const deadhead = deadheadToJob(job, cursor) ?? 0;
    const decision = evaluateJob({
      loadedMiles: loadMi,
      deadheadMiles: deadhead,
      quote: bid,
      ...ops,
    });

    counted += 1;
    revenue += bid;
    afterFee += decision.netToDriver;
    loaded += loadMi;
    empty += deadhead;
    totalCost += decision.totalCost;

    const next = driverAtJobDrop(job);
    if (next) cursor = next;
  }

  if (!counted) return null;

  const totalMiles = loaded + empty;
  const estimatedNet = afterFee - totalCost;
  return {
    jobCount: counted,
    revenue: Math.round(revenue * 100) / 100,
    afterFee: Math.round(afterFee * 100) / 100,
    shiplyFee: Math.round((revenue - afterFee) * 100) / 100,
    loadedMiles: Math.round(loaded),
    emptyMiles: Math.round(empty),
    totalMiles: Math.round(totalMiles),
    totalCost: Math.round(totalCost * 100) / 100,
    estimatedNet: Math.round(estimatedNet * 100) / 100,
    netPerMile:
      totalMiles > 0
        ? Math.round((estimatedNet / totalMiles) * 1000) / 1000
        : 0,
    revenuePerMile:
      totalMiles > 0 ? Math.round((revenue / totalMiles) * 100) / 100 : 0,
  };
}

export type BestNextHint = {
  job: MapJob;
  route: string;
  deadheadMi: number;
  quality: JobConnection["quality"];
  fit: FitIndicator;
};

export function bestNextAfterJob(
  job: MapJob,
  pool: MapJob[],
  driver: JobsMapDriver | null,
): BestNextHint | null {
  const next = connectionsFromJob(job, pool, driver, undefined, 1)[0];
  if (!next) return null;
  return {
    job: next.toJob,
    route: next.route,
    deadheadMi: next.deadheadMi,
    quality: next.quality,
    fit: next.fit,
  };
}

export type ChainAddHint = {
  alone: JobDecision;
  addsNet: number | null;
  runNetWith: number | null;
  runNetWithout: number | null;
  fromLabel: string;
};

/**
 * Alone = this job from current position (this leg only).
 * Adds = marginal net if appended to today's run (from home).
 */
export function chainAddHint(
  job: MapJob,
  todayRunJobs: MapJob[],
  currentPos: JobsMapDriver | null,
  home: JobsMapDriver | null,
  market: Pick<DriverMarket, "countryCode"> | null | undefined,
): ChainAddHint | null {
  const snap = boardJobSnapshot(job, currentPos, market);
  if (!snap.decision) return null;

  const alreadyInRun = todayRunJobs.some((j) => j.id === job.id);
  const baseJobs = alreadyInRun
    ? todayRunJobs.filter((j) => j.id !== job.id)
    : todayRunJobs;
  const start = home ?? currentPos;

  let addsNet: number | null = null;
  let runNetWith: number | null = null;
  let runNetWithout: number | null = null;

  if (baseJobs.length > 0 && start) {
    const without = evaluateRunChain(baseJobs, start, market);
    const withJob = evaluateRunChain([...baseJobs, job], start, market);
    if (without && withJob) {
      runNetWithout = without.estimatedNet;
      runNetWith = withJob.estimatedNet;
      addsNet =
        Math.round((withJob.estimatedNet - without.estimatedNet) * 100) / 100;
    }
  }

  return {
    alone: snap.decision,
    addsNet,
    runNetWith,
    runNetWithout,
    fromLabel: shortPlace(currentPos?.label) || "your start",
  };
}

export function fitToneClass(tone: FitIndicator["tone"]): string {
  switch (tone) {
    case "excellent":
    case "good":
      return "text-emerald-700";
    case "possible":
      return "text-amber-700";
    case "home":
      return "text-sky-700";
    default:
      return "text-red-700";
  }
}
