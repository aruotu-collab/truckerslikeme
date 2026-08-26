import { placeKey, shortPlace, type JobsMapDriver, type MapJob } from "@/lib/jobs-map";
import type { BidPlan, RunGoal } from "@/lib/jobs-run-builder";
import { resolveUkPlace, type LatLon } from "@/lib/uk-places";

export type SequenceTown = {
  key: string;
  label: string;
};

export type SequenceStepKind = "start" | "loaded" | "deadhead";

export type SequenceStep = {
  index: number;
  kind: SequenceStepKind;
  /** Plain-English row label, e.g. "Deadhead to Stoke" / "Stoke → Birmingham". */
  label: string;
  fromKey: string;
  toKey: string;
  fromCol: number;
  toCol: number;
  miles: number;
  pay: number | null;
  job: MapJob | null;
  /** Pickup and drop in the same town (local loop mark). */
  isLocal: boolean;
};

export type RunSequence = {
  towns: SequenceTown[];
  steps: SequenceStep[];
  startLabel: string;
  jobCount: number;
  revenue: number;
  loadedMiles: number;
  emptyMiles: number;
  totalMiles: number;
  revenuePerMile: number;
};

export const RUN_GOAL_BADGE: Record<
  RunGoal,
  { title: string; badge: string }
> = {
  revenue: { title: "Best revenue", badge: "Best revenue" },
  rpm: { title: "Best £ / mile", badge: "Best £/mi" },
  empty: { title: "Least detour", badge: "Least detour" },
  home: { title: "Best return load", badge: "Best return" },
  short: { title: "Short day", badge: "Short day" },
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

function driverPoint(driver: JobsMapDriver | null): LatLon | null {
  if (driver?.lat != null && driver?.lon != null) {
    return { lat: driver.lat, lon: driver.lon };
  }
  return resolveUkPlace(driver?.label);
}

function townOf(place: string | null | undefined): SequenceTown | null {
  const key = placeKey(place);
  if (!key) return null;
  return { key, label: shortPlace(place) };
}

function jobPay(j: MapJob) {
  return j.rateTotal != null && j.rateTotal > 0 ? j.rateTotal : 0;
}

function jobLoadedMiles(job: MapJob) {
  if (job.miles != null && job.miles > 0) return job.miles;
  const o = resolveUkPlace(job.origin);
  const d = resolveUkPlace(job.destination);
  if (o && d) return Math.round(haversineMi(o, d));
  return 0;
}

/**
 * Build a run-sequence lane chart from a bid plan.
 * Columns = towns in journey order only (not the full dataset).
 * Blue steps = loaded jobs; red steps = deadhead to next pickup.
 */
export function buildRunSequence(
  plan: BidPlan,
  driver: JobsMapDriver | null,
): RunSequence {
  const towns: SequenceTown[] = [];
  const colIndex = new Map<string, number>();

  function ensureTown(t: SequenceTown) {
    if (colIndex.has(t.key)) return colIndex.get(t.key)!;
    const idx = towns.length;
    towns.push(t);
    colIndex.set(t.key, idx);
    return idx;
  }

  const startLabel = shortPlace(driver?.label) || "Start";
  const startTown: SequenceTown = {
    key: placeKey(driver?.label) || "__start__",
    label: startLabel,
  };
  ensureTown(startTown);

  for (const job of plan.jobs) {
    const pickup = townOf(job.origin);
    const drop = townOf(job.destination);
    if (pickup) ensureTown(pickup);
    if (drop) ensureTown(drop);
  }

  const steps: SequenceStep[] = [];
  let prevKey = startTown.key;
  let prevPoint = driverPoint(driver);
  let stepIndex = 1;

  steps.push({
    index: stepIndex++,
    kind: "start",
    label: startLabel,
    fromKey: startTown.key,
    toKey: startTown.key,
    fromCol: colIndex.get(startTown.key)!,
    toCol: colIndex.get(startTown.key)!,
    miles: 0,
    pay: null,
    job: null,
    isLocal: true,
  });

  plan.jobs.forEach((job) => {
    const pickup = townOf(job.origin);
    const drop = townOf(job.destination);
    if (!pickup || !drop) return;

    const pickupPt = resolveUkPlace(job.origin);
    const dropPt = resolveUkPlace(job.destination);

    let deadhead = 0;
    if (prevPoint && pickupPt) {
      deadhead = Math.round(haversineMi(prevPoint, pickupPt));
    }

    if (deadhead > 0 || prevKey !== pickup.key) {
      steps.push({
        index: stepIndex++,
        kind: "deadhead",
        label: `Deadhead to ${pickup.label}`,
        fromKey: prevKey,
        toKey: pickup.key,
        fromCol: colIndex.get(prevKey) ?? 0,
        toCol: colIndex.get(pickup.key)!,
        miles: deadhead,
        pay: null,
        job: null,
        isLocal: prevKey === pickup.key && deadhead === 0,
      });
    }

    const loaded = jobLoadedMiles(job);
    const pay = jobPay(job) || null;
    const isLocal = pickup.key === drop.key;

    steps.push({
      index: stepIndex++,
      kind: "loaded",
      label: isLocal
        ? `${pickup.label} (local)`
        : `${pickup.label} → ${drop.label}`,
      fromKey: pickup.key,
      toKey: drop.key,
      fromCol: colIndex.get(pickup.key)!,
      toCol: colIndex.get(drop.key)!,
      miles: loaded,
      pay,
      job,
      isLocal,
    });

    prevKey = drop.key;
    prevPoint = dropPt;
  });

  return {
    towns,
    steps,
    startLabel,
    jobCount: plan.jobs.length,
    revenue: plan.revenue,
    loadedMiles: plan.loadedMiles,
    emptyMiles: plan.emptyMiles,
    totalMiles: plan.totalMiles,
    revenuePerMile: plan.revenuePerMile,
  };
}
