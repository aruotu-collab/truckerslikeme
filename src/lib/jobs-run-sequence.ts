import { placeKey, shortPlace, type JobsMapDriver, type MapJob } from "@/lib/jobs-map";
import type { BidPlan, RunGoal } from "@/lib/jobs-run-builder";
import { resolveUkPlace, type LatLon } from "@/lib/uk-places";

export type SequenceTown = {
  key: string;
  label: string;
};

/** One physical stop in the run (matches mockup rows 1…n). */
export type SequenceStop = {
  index: number;
  placeKey: string;
  placeLabel: string;
  col: number;
  /** start | pickup | deliver | handoff */
  role: "start" | "pickup" | "deliver" | "handoff";
  /** How we arrived here from the previous stop. */
  arriveBy: "none" | "loaded" | "deadhead";
  milesFromPrev: number;
  note: string | null;
  pay: number | null;
  deliverPay: number | null;
  pickupPay: number | null;
  job: MapJob | null;
};

export type RunSequence = {
  towns: SequenceTown[];
  stops: SequenceStop[];
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
  home: { title: "Best return load", badge: "Best return load" },
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
 * Build stop-per-row sequence matching the mockup chart:
 * columns = towns in journey order; rows = stops; edges = loaded (blue) or deadhead (red).
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

  const stops: SequenceStop[] = [];
  let prevKey = startTown.key;
  let prevPoint = driverPoint(driver);
  let stepIndex = 1;

  stops.push({
    index: stepIndex++,
    placeKey: startTown.key,
    placeLabel: startLabel,
    col: colIndex.get(startTown.key)!,
    role: "start",
    arriveBy: "none",
    milesFromPrev: 0,
    note: null,
    pay: null,
    deliverPay: null,
    pickupPay: null,
    job: null,
  });

  plan.jobs.forEach((job, jobIdx) => {
    const pickup = townOf(job.origin);
    const drop = townOf(job.destination);
    if (!pickup || !drop) return;

    const pickupPt = resolveUkPlace(job.origin);
    const dropPt = resolveUkPlace(job.destination);
    const pay = jobPay(job) || null;
    const loaded = jobLoadedMiles(job);

    let deadhead = 0;
    if (prevPoint && pickupPt) {
      deadhead = Math.round(haversineMi(prevPoint, pickupPt));
    }

    const sameAsPrev = prevKey === pickup.key;

    // Arrive at pickup (skip new stop if already there from previous deliver → handoff)
    if (!sameAsPrev) {
      stops.push({
        index: stepIndex++,
        placeKey: pickup.key,
        placeLabel: pickup.label,
        col: colIndex.get(pickup.key)!,
        role: "pickup",
        arriveBy: "deadhead",
        milesFromPrev: deadhead,
        note: pay != null ? `Pickup ${formatPay(pay)}` : "Pickup",
        pay,
        deliverPay: null,
        pickupPay: pay,
        job,
      });
    } else {
      // Already at this town (start here, or deliver→pickup handoff)
      const last = stops[stops.length - 1];
      if (last && last.placeKey === pickup.key) {
        if (last.role === "start") {
          last.note = pay != null ? `Pickup ${formatPay(pay)}` : "Pickup";
          last.pickupPay = pay;
          last.pay = pay;
          last.job = job;
        } else {
          last.role = "handoff";
          last.pickupPay = pay;
          last.note =
            last.deliverPay != null && pay != null
              ? `Deliver ${formatPay(last.deliverPay)} / Pickup ${formatPay(pay)}`
              : pay != null
                ? `Pickup ${formatPay(pay)}`
                : last.note;
          last.job = job;
        }
      }
    }

    // Deliver at drop (or local job stays as one stop)
    if (pickup.key === drop.key) {
      const last = stops[stops.length - 1]!;
      last.role = last.role === "start" ? "deliver" : last.role;
      last.note =
        pay != null ? `Local job · ${formatPay(pay)}` : "Local job";
      last.pay = pay;
      last.job = job;
    } else {
      stops.push({
        index: stepIndex++,
        placeKey: drop.key,
        placeLabel: drop.label,
        col: colIndex.get(drop.key)!,
        role: "deliver",
        arriveBy: "loaded",
        milesFromPrev: loaded,
        note: pay != null ? `Deliver ${formatPay(pay)}` : "Deliver",
        pay,
        deliverPay: pay,
        pickupPay: null,
        job,
      });
    }

    prevKey = drop.key;
    prevPoint = dropPt;
    void jobIdx;
  });

  return {
    towns,
    stops,
    startLabel,
    jobCount: plan.jobs.length,
    revenue: plan.revenue,
    loadedMiles: plan.loadedMiles,
    emptyMiles: plan.emptyMiles,
    totalMiles: plan.totalMiles,
    revenuePerMile: plan.revenuePerMile,
  };
}

function formatPay(n: number) {
  return `£${Math.round(n)}`;
}

/** Legacy step shape kept for any callers expecting segment rows. */
export type SequenceStepKind = "start" | "loaded" | "deadhead";
export type SequenceStep = {
  index: number;
  kind: SequenceStepKind;
  label: string;
  fromKey: string;
  toKey: string;
  fromCol: number;
  toCol: number;
  miles: number;
  pay: number | null;
  job: MapJob | null;
  isLocal: boolean;
};

/** Convert stops → segment steps (for older chart API). Prefer stops + new chart. */
export function stopsToSteps(sequence: RunSequence): SequenceStep[] {
  const out: SequenceStep[] = [];
  sequence.stops.forEach((stop, i) => {
    if (i === 0) {
      out.push({
        index: 1,
        kind: "start",
        label: stop.placeLabel,
        fromKey: stop.placeKey,
        toKey: stop.placeKey,
        fromCol: stop.col,
        toCol: stop.col,
        miles: 0,
        pay: null,
        job: null,
        isLocal: true,
      });
      return;
    }
    const prev = sequence.stops[i - 1]!;
    out.push({
      index: stop.index,
      kind: stop.arriveBy === "deadhead" ? "deadhead" : "loaded",
      label:
        stop.arriveBy === "deadhead"
          ? `${prev.placeLabel} → ${stop.placeLabel}`
          : `${prev.placeLabel} → ${stop.placeLabel}`,
      fromKey: prev.placeKey,
      toKey: stop.placeKey,
      fromCol: prev.col,
      toCol: stop.col,
      miles: stop.milesFromPrev,
      pay: stop.pay,
      job: stop.job,
      isLocal: prev.placeKey === stop.placeKey,
    });
  });
  return out;
}
