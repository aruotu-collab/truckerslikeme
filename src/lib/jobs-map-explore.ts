import {
  buildScreenMileGrid,
  separateCircles,
  type MileGrid,
} from "@/lib/map-circle-layout";
import {
  resolveUkPlace,
  type LatLon,
} from "@/lib/uk-places";
import {
  placeKey,
  shortPlace,
  jobMyBid,
  type JobsMapDriver,
  type MapJob,
} from "@/lib/jobs-map";

export type MapViewMode = "explore" | "connections";

export type SortMode = "money" | "jobs" | "rpm" | "distance";

export type DirectionId =
  | "N"
  | "NE"
  | "E"
  | "SE"
  | "S"
  | "SW"
  | "W"
  | "NW";

export const DIRECTION_LABELS: Record<DirectionId, string> = {
  N: "North",
  NE: "North East",
  E: "East",
  SE: "South East",
  S: "South",
  SW: "South West",
  W: "West",
  NW: "North West",
};

/** Jobs we can plot — both ends must geocode. */
export function geocodedJobs(jobs: MapJob[]) {
  return jobs.filter((j) => {
    const o = resolveUkPlace(j.origin);
    const d = resolveUkPlace(j.destination);
    return Boolean(o && d);
  });
}

export function unmappedJobs(jobs: MapJob[]) {
  return jobs.filter((j) => !geocodedJobs([j]).length);
}

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

export function directionFromBearing(deg: number): DirectionId {
  const sectors: DirectionId[] = [
    "N",
    "NE",
    "E",
    "SE",
    "S",
    "SW",
    "W",
    "NW",
  ];
  const idx = Math.round(deg / 45) % 8;
  return sectors[idx]!;
}

export type CityCluster = {
  id: string;
  destKey: string;
  label: string;
  lat: number;
  lon: number;
  direction: DirectionId;
  distanceMi: number;
  jobs: MapJob[];
  jobCount: number;
  totalPay: number;
  avgMiles: number | null;
  avgRpm: number | null;
};

export type DirectionCluster = {
  id: DirectionId;
  label: string;
  jobs: MapJob[];
  jobCount: number;
  totalPay: number;
  avgMiles: number | null;
  cities: CityCluster[];
};

export type RouteConnection = {
  id: string;
  originKey: string;
  originLabel: string;
  destKey: string;
  destLabel: string;
  origin: LatLon;
  dest: LatLon;
  jobs: MapJob[];
  jobCount: number;
  totalPay: number;
  avgMiles: number | null;
};

export type RunStepKind =
  | "start"
  | "pickup"
  | "deliver"
  | "handoff"
  | "finish";

export type RunStep = {
  place: string;
  kind: RunStepKind;
  /** Primary pay line (pickup or deliver amount). */
  pay: number | null;
  /** When handoff: deliver amount from previous leg. */
  deliverPay?: number | null;
  /** When handoff: pickup amount for next leg. */
  pickupPay?: number | null;
  job?: MapJob;
};

export type PossibleRun = {
  id: string;
  label: string;
  jobs: MapJob[];
  totalPay: number;
  extraMiles: number;
  stops: string[];
  steps: RunStep[];
};

export type CorridorBucket = "on_route" | "detour" | "return" | "other";

export type CorridorGroup = {
  id: CorridorBucket;
  label: string;
  jobs: MapJob[];
};

function jobPay(j: MapJob) {
  return jobMyBid(j);
}

function avgMiles(jobs: MapJob[]) {
  const ms = jobs.map((j) => j.miles).filter((m): m is number => m != null && m > 0);
  if (!ms.length) return null;
  return Math.round(ms.reduce((a, b) => a + b, 0) / ms.length);
}

function avgRpm(jobs: MapJob[]) {
  const rpms = jobs
    .map((j) =>
      jobMyBid(j) > 0 && j.miles != null && j.miles > 0
        ? jobMyBid(j) / j.miles
        : null,
    )
    .filter((r): r is number => r != null);
  if (!rpms.length) return null;
  return rpms.reduce((a, b) => a + b, 0) / rpms.length;
}

function cityMatch(a: string | null | undefined, b: string | null | undefined) {
  const ca = placeKey(a);
  const cb = placeKey(b);
  if (!ca || !cb) return false;
  return ca === cb || ca.includes(cb) || cb.includes(ca);
}

/** Group geocoded jobs by destination city, tagged with compass direction from driver. */
export function buildCityClusters(
  jobs: MapJob[],
  driver: JobsMapDriver | null,
): CityCluster[] {
  const driverPt =
    driver?.lat != null && driver?.lon != null
      ? { lat: driver.lat, lon: driver.lon }
      : resolveUkPlace(driver?.label);

  const byDest = new Map<string, MapJob[]>();
  for (const j of geocodedJobs(jobs)) {
    const dk = placeKey(j.destination);
    if (!byDest.has(dk)) byDest.set(dk, []);
    byDest.get(dk)!.push(j);
  }

  const clusters: CityCluster[] = [];
  for (const [destKey, list] of byDest) {
    const pt = resolveUkPlace(list[0]?.destination);
    if (!pt) continue;
    const direction =
      driverPt != null
        ? directionFromBearing(bearingDeg(driverPt, pt))
        : ("S" as DirectionId);
    const distanceMi =
      driverPt != null ? Math.round(haversineMi(driverPt, pt)) : 0;
    const totalPay = list.reduce((s, j) => s + jobPay(j), 0);
    clusters.push({
      id: `city-${destKey}`,
      destKey,
      label: shortPlace(list[0]?.destination),
      lat: pt.lat,
      lon: pt.lon,
      direction,
      distanceMi,
      jobs: list,
      jobCount: list.length,
      totalPay,
      avgMiles: avgMiles(list),
      avgRpm: avgRpm(list),
    });
  }

  return clusters;
}

export function buildDirectionClusters(
  jobs: MapJob[],
  driver: JobsMapDriver | null,
): DirectionCluster[] {
  const cities = buildCityClusters(jobs, driver);
  const byDir = new Map<DirectionId, CityCluster[]>();
  for (const c of cities) {
    if (!byDir.has(c.direction)) byDir.set(c.direction, []);
    byDir.get(c.direction)!.push(c);
  }

  const order: DirectionId[] = [
    "N",
    "NE",
    "E",
    "SE",
    "S",
    "SW",
    "W",
    "NW",
  ];

  return order
    .filter((d) => byDir.has(d))
    .map((d) => {
      const list = byDir.get(d)!;
      const allJobs = list.flatMap((c) => c.jobs);
      return {
        id: d,
        label: DIRECTION_LABELS[d],
        jobs: allJobs,
        jobCount: allJobs.length,
        totalPay: allJobs.reduce((s, j) => s + jobPay(j), 0),
        avgMiles: avgMiles(allJobs),
        cities: list.sort((a, b) => b.totalPay - a.totalPay),
      };
    });
}

/** Merge same origin→destination into one connection (multiple jobs on one line). */
export function buildRouteConnections(jobs: MapJob[]): RouteConnection[] {
  const map = new Map<string, RouteConnection>();
  for (const j of geocodedJobs(jobs)) {
    const ok = placeKey(j.origin);
    const dk = placeKey(j.destination);
    const id = `${ok}→${dk}`;
    const oPt = resolveUkPlace(j.origin)!;
    const dPt = resolveUkPlace(j.destination)!;
    const prev = map.get(id);
    if (prev) {
      prev.jobs.push(j);
      prev.jobCount += 1;
      prev.totalPay += jobPay(j);
    } else {
      map.set(id, {
        id,
        originKey: ok,
        originLabel: shortPlace(j.origin),
        destKey: dk,
        destLabel: shortPlace(j.destination),
        origin: oPt,
        dest: dPt,
        jobs: [j],
        jobCount: 1,
        totalPay: jobPay(j),
        avgMiles: null,
      });
    }
  }
  return [...map.values()].map((r) => ({
    ...r,
    avgMiles: avgMiles(r.jobs),
  }));
}

export function sortConnections(
  routes: RouteConnection[],
  mode: SortMode,
): RouteConnection[] {
  const next = [...routes];
  if (mode === "money") {
    next.sort((a, b) => b.totalPay - a.totalPay);
  } else if (mode === "jobs") {
    next.sort((a, b) => b.jobCount - a.jobCount);
  } else if (mode === "rpm") {
    next.sort((a, b) => {
      const ra =
        a.avgMiles && a.avgMiles > 0 ? a.totalPay / a.avgMiles / a.jobCount : 0;
      const rb =
        b.avgMiles && b.avgMiles > 0 ? b.totalPay / b.avgMiles / b.jobCount : 0;
      return rb - ra;
    });
  } else {
    next.sort((a, b) => (a.avgMiles ?? 9999) - (b.avgMiles ?? 9999));
  }
  return next;
}

function angleDiff(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Classify jobs relative to driver → heading corridor. */
export function classifyJobsByCorridor(
  jobs: MapJob[],
  driver: JobsMapDriver | null,
  headingToward: string | null,
): CorridorGroup[] {
  const driverPt =
    driver?.lat != null && driver?.lon != null
      ? { lat: driver.lat, lon: driver.lon }
      : resolveUkPlace(driver?.label);
  const headingPt = resolveUkPlace(headingToward);

  const buckets: Record<CorridorBucket, MapJob[]> = {
    on_route: [],
    detour: [],
    return: [],
    other: [],
  };

  if (!driverPt || !headingPt) {
    return [
      {
        id: "other",
        label: "All jobs",
        jobs: [...jobs],
      },
    ];
  }

  const corridorBearing = bearingDeg(driverPt, headingPt);
  const homeKey = placeKey(driver?.label);

  for (const j of jobs) {
    const destPt = resolveUkPlace(j.destination);
    if (!destPt) {
      buckets.other.push(j);
      continue;
    }
    const jobBearing = bearingDeg(driverPt, destPt);
    const diff = angleDiff(corridorBearing, jobBearing);
    const destKey = placeKey(j.destination);
    const originKey = placeKey(j.origin);

    if (homeKey && (destKey === homeKey || cityMatch(j.destination, driver?.label))) {
      buckets.return.push(j);
    } else if (diff <= 35) {
      buckets.on_route.push(j);
    } else if (diff >= 140 && originKey !== homeKey) {
      buckets.return.push(j);
    } else if (diff <= 70) {
      buckets.detour.push(j);
    } else {
      buckets.other.push(j);
    }
  }

  return (
    [
      { id: "on_route" as const, label: "On my route", jobs: buckets.on_route },
      { id: "detour" as const, label: "Small detour", jobs: buckets.detour },
      { id: "return" as const, label: "Return loads", jobs: buckets.return },
      { id: "other" as const, label: "Other jobs", jobs: buckets.other },
    ] as CorridorGroup[]
  ).filter((g) => g.jobs.length > 0);
}

export function buildRunSteps(
  driver: JobsMapDriver | null,
  jobs: MapJob[],
): RunStep[] {
  if (!jobs.length) return [];
  const steps: RunStep[] = [
    {
      place: shortPlace(driver?.label) || "Start",
      kind: "start",
      pay: null,
    },
  ];

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]!;
    const prev = jobs[i - 1];
    const next = jobs[i + 1];
    const pay = jobPay(job) || null;
    const chainsFromPrev =
      i > 0 && cityMatch(prev?.destination, job.origin);
    const chainsToNext =
      Boolean(next) && cityMatch(job.destination, next?.origin);

    if (!chainsFromPrev) {
      steps.push({
        place: shortPlace(job.origin),
        kind: "pickup",
        pay,
        job,
      });
    } else {
      steps.push({
        place: shortPlace(job.origin),
        kind: "handoff",
        pay: null,
        deliverPay: jobPay(prev!) || null,
        pickupPay: pay,
        job,
      });
    }

    if (!chainsToNext) {
      steps.push({
        place: shortPlace(job.destination),
        kind: i === jobs.length - 1 ? "finish" : "deliver",
        pay,
        job,
      });
    }
  }

  return steps;
}

function buildChain(
  startJob: MapJob,
  pool: MapJob[],
  maxLegs: number,
): MapJob[] {
  const chain: MapJob[] = [startJob];
  let pay = jobPay(startJob);
  let extra = startJob.miles ?? 80;

  for (let step = 0; step < maxLegs - 1; step++) {
    const last = chain[chain.length - 1]!;
    const next = pool.find(
      (j) =>
        !chain.includes(j) &&
        cityMatch(j.origin, last.destination ?? ""),
    );
    if (!next) break;
    chain.push(next);
    pay += jobPay(next);
    extra += next.miles ?? 80;
  }

  return chain;
}

function runFromChain(
  chain: MapJob[],
  label: string,
  driver: JobsMapDriver | null,
): PossibleRun {
  const totalPay = chain.reduce((s, j) => s + jobPay(j), 0);
  const extraMiles = chain.reduce(
    (s, j) => s + (j.miles != null && j.miles > 0 ? j.miles : 80),
    0,
  );
  return {
    id: `run-${chain.map((j) => j.id).join("-")}`,
    label,
    jobs: chain,
    totalPay,
    extraMiles: Math.round(extraMiles),
    stops: chain.flatMap((j, idx) =>
      idx === 0
        ? [shortPlace(j.origin), shortPlace(j.destination)]
        : [shortPlace(j.destination)],
    ),
    steps: buildRunSteps(driver, chain),
  };
}

/** Find chained runs — multiple suggestions like the mockup. */
export function findPossibleRuns(
  jobs: MapJob[],
  driver: JobsMapDriver | null,
  max = 4,
): PossibleRun[] {
  const usable = geocodedJobs(jobs).filter(
    (j) => j.status !== "skipped" && j.status !== "delivered",
  );
  if (usable.length < 2) return [];

  const home = placeKey(driver?.label);
  const candidates: PossibleRun[] = [];

  for (const start of usable) {
    for (const legs of [2, 3, 4]) {
      const chain = buildChain(start, usable, legs);
      if (chain.length < 2) continue;

      const endsNearHome =
        home &&
        cityMatch(chain[chain.length - 1]!.destination, driver?.label);
      const totalPay = chain.reduce((s, j) => s + jobPay(j), 0);
      const extraMiles = chain.reduce(
        (s, j) => s + (j.miles ?? 80),
        0,
      );

      let label = "Two-leg run";
      if (chain.length >= 3 && endsNearHome) label = "Return loop";
      else if (chain.length >= 3) label = "Best revenue";
      else if (extraMiles <= 120) label = "Least detour";

      candidates.push(runFromChain(chain, label, driver));
    }
  }

  const seen = new Set<string>();
  const unique = candidates.filter((r) => {
    const key = r.jobs.map((j) => j.id).join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const picks: PossibleRun[] = [];
  const pickBest = (label: string, sort: (a: PossibleRun, b: PossibleRun) => number) => {
    const match = [...unique]
      .filter((r) => r.label === label)
      .sort(sort)[0];
    if (match && !picks.some((p) => p.id === match.id)) picks.push(match);
  };

  pickBest("Best revenue", (a, b) => b.totalPay - a.totalPay);
  pickBest("Return loop", (a, b) => b.totalPay - a.totalPay);
  pickBest("Least detour", (a, b) => a.extraMiles - b.extraMiles);
  pickBest("Two-leg run", (a, b) => b.totalPay - a.totalPay);

  for (const r of unique.sort((a, b) => b.totalPay - a.totalPay)) {
    if (picks.length >= max) break;
    if (!picks.some((p) => p.id === r.id)) picks.push(r);
  }

  return picks.slice(0, max);
}

export type ExploreMapLayout = {
  width: number;
  height: number;
  driver: { x: number; y: number; label: string } | null;
  /** Cartesian mile grid from driver. */
  grid: MileGrid | null;
  /** Compass direction bubbles. */
  directions: Array<{
    id: DirectionId;
    label: string;
    x: number;
    y: number;
    r: number;
    jobCount: number;
    totalPay: number;
    jobs: MapJob[];
  }>;
};

export const HUNT_MAP_GRID_STEPS = [5, 10, 20, 50, 100] as const;
export type HuntMapGridStep = (typeof HUNT_MAP_GRID_STEPS)[number];
export const DEFAULT_HUNT_MAP_GRID_STEP: HuntMapGridStep = 50;

export const HUNT_MAP_GRID_STORAGE_KEY = "tlm-hunt-map-grid-step";

export function parseHuntMapGridStep(value: unknown): HuntMapGridStep {
  const n = typeof value === "number" ? value : Number(value);
  return (HUNT_MAP_GRID_STEPS as readonly number[]).includes(n)
    ? (n as HuntMapGridStep)
    : DEFAULT_HUNT_MAP_GRID_STEP;
}

/** Jobs for a selected direction bubble — map layout stays unchanged. */
export function jobsForExploreSelection(
  jobs: MapJob[],
  driver: JobsMapDriver | null,
  direction: DirectionId | null,
): { title: string; jobs: MapJob[]; totalPay: number } | null {
  if (!direction) return null;
  const cluster = buildDirectionClusters(jobs, driver).find(
    (d) => d.id === direction,
  );
  if (!cluster) return null;
  return {
    title: DIRECTION_LABELS[direction],
    jobs: cluster.jobs,
    totalPay: cluster.totalPay,
  };
}

function compassXY(
  cx: number,
  cy: number,
  dir: DirectionId,
  radius: number,
) {
  const angles: Record<DirectionId, number> = {
    N: 0,
    NE: 45,
    E: 90,
    SE: 135,
    S: 180,
    SW: 225,
    W: 270,
    NW: 315,
  };
  const rad = ((angles[dir] - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

export function layoutExploreMap(input: {
  jobs: MapJob[];
  driver: JobsMapDriver | null;
  gridStepMi?: HuntMapGridStep;
  width?: number;
  height?: number;
}): ExploreMapLayout {
  const width = input.width ?? 640;
  const height = input.height ?? 420;
  const pad = 52;
  const cx = width / 2;
  const cy = height / 2;

  const driverPt =
    input.driver?.lat != null && input.driver?.lon != null
      ? { lat: input.driver.lat, lon: input.driver.lon }
      : resolveUkPlace(input.driver?.label);

  const directions = buildDirectionClusters(input.jobs, input.driver);
  const gridStepMi = input.gridStepMi ?? DEFAULT_HUNT_MAP_GRID_STEP;

  const maxDirJobs = Math.max(1, ...directions.map((d) => d.jobCount));

  const compassRadius = Math.min(width, height) * 0.34;
  const dirSeparated = separateCircles(
    directions.map((d) => {
      const r = 18 + (d.jobCount / maxDirJobs) * 28;
      const pos = compassXY(cx, cy, d.id, compassRadius);
      return {
        id: d.id,
        x: pos.x,
        y: pos.y,
        r,
        anchorX: pos.x,
        anchorY: pos.y,
      };
    }),
    {
      gap: 14,
      labelPad: 38,
      anchorWeight: 0.08,
      iterations: 64,
      minX: pad,
      minY: pad,
      maxX: width - pad,
      maxY: height - pad,
      block: { x: cx, y: cy, r: 18 },
    },
  );

  const dirById = new Map(dirSeparated.map((d) => [d.id, d]));
  const dirBubbles = directions.map((d) => {
    const laid = dirById.get(d.id)!;
    return {
      id: d.id,
      label: d.label,
      x: laid.x,
      y: laid.y,
      r: laid.r,
      jobCount: d.jobCount,
      totalPay: d.totalPay,
      jobs: d.jobs,
    };
  });

  let driverScreen: ExploreMapLayout["driver"] = null;
  if (driverPt && input.driver?.label) {
    driverScreen = { x: cx, y: cy, label: shortPlace(input.driver.label) };
  }

  let grid: MileGrid | null = null;
  if (driverScreen && driverPt) {
    const milesPerPx = (Math.min(width, height) * 0.38) / 100;
    grid = buildScreenMileGrid({
      cx: driverScreen.x,
      cy: driverScreen.y,
      milesPerPx,
      maxMi: 100,
      stepMi: gridStepMi,
      width,
      height,
      pad,
    });
  }

  return {
    width,
    height,
    driver: driverScreen,
    grid,
    directions: dirBubbles,
  };
}
