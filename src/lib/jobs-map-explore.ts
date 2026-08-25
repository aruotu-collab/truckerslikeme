import {
  boundsAround,
  projectLatLon,
  resolveUkPlace,
  type LatLon,
} from "@/lib/uk-places";
import {
  placeKey,
  shortPlace,
  type JobsMapDriver,
  type MapJob,
} from "@/lib/jobs-map";

export type MapViewMode = "explore" | "connections" | "runs";

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

export type PossibleRun = {
  id: string;
  label: string;
  jobs: MapJob[];
  totalPay: number;
  extraMiles: number;
  stops: string[];
};

function jobPay(j: MapJob) {
  return j.rateTotal != null && j.rateTotal > 0 ? j.rateTotal : 0;
}

function avgMiles(jobs: MapJob[]) {
  const ms = jobs.map((j) => j.miles).filter((m): m is number => m != null && m > 0);
  if (!ms.length) return null;
  return Math.round(ms.reduce((a, b) => a + b, 0) / ms.length);
}

function avgRpm(jobs: MapJob[]) {
  const rpms = jobs
    .map((j) =>
      j.rateTotal != null && j.miles != null && j.miles > 0
        ? j.rateTotal / j.miles
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

/** Simple 2–3 job chains where drop city ≈ next collect city. */
export function findPossibleRuns(
  jobs: MapJob[],
  driver: JobsMapDriver | null,
  max = 5,
): PossibleRun[] {
  const usable = geocodedJobs(jobs).filter((j) => j.status !== "skipped");
  if (usable.length < 2) return [];

  const home = placeKey(driver?.label);
  const runs: PossibleRun[] = [];

  for (let i = 0; i < usable.length && runs.length < max * 3; i++) {
    const chain: MapJob[] = [usable[i]!];
    let pay = jobPay(usable[i]!);
    let extra = usable[i]!.miles ?? 80;

    for (let step = 0; step < 2; step++) {
      const last = chain[chain.length - 1]!;
      const next = usable.find(
        (j) =>
          !chain.includes(j) &&
          cityMatch(j.origin, last.destination ?? ""),
      );
      if (!next) break;
      chain.push(next);
      pay += jobPay(next);
      extra += next.miles ?? 80;
    }

    if (chain.length < 2) continue;

    const endsNearHome =
      home &&
      cityMatch(chain[chain.length - 1]!.destination || "", home);
    const label =
      chain.length >= 3
        ? endsNearHome
          ? "Return loop"
          : "Best revenue"
        : extra <= 120
          ? "Least detour"
          : "Two-leg run";

    runs.push({
      id: `run-${chain.map((j) => j.id).join("-")}`,
      label,
      jobs: chain,
      totalPay: pay,
      extraMiles: Math.round(extra),
      stops: chain.flatMap((j, idx) =>
        idx === 0
          ? [shortPlace(j.origin), shortPlace(j.destination)]
          : [shortPlace(j.destination)],
      ),
    });
  }

  const seen = new Set<string>();
  const unique: PossibleRun[] = [];
  for (const r of runs.sort((a, b) => b.totalPay - a.totalPay)) {
    const key = r.jobs.map((j) => j.id).join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
    if (unique.length >= max) break;
  }
  return unique;
}

export type ExploreMapLayout = {
  width: number;
  height: number;
  driver: { x: number; y: number; label: string } | null;
  /** Compass direction bubbles (default zoom). */
  directions: Array<{
    id: DirectionId;
    label: string;
    x: number;
    y: number;
    r: number;
    jobCount: number;
    totalPay: number;
  }>;
  /** City clusters on UK projection when direction/city focused. */
  cities: Array<{
    cluster: CityCluster;
    x: number;
    y: number;
    r: number;
  }>;
  /** Lines to draw (only when focused). */
  lines: Array<{
    id: string;
    path: string;
    jobCount: number;
    totalPay: number;
    originLabel: string;
    destLabel: string;
    jobs: MapJob[];
    highlighted: boolean;
  }>;
};

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

function curvedPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  bend: number,
) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2 + bend;
  return `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;
}

export function layoutExploreMap(input: {
  jobs: MapJob[];
  driver: JobsMapDriver | null;
  selectedDirection: DirectionId | null;
  selectedCityKey: string | null;
  selectedRouteId: string | null;
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
  const cities = buildCityClusters(input.jobs, input.driver);
  const routes = buildRouteConnections(input.jobs);

  const maxDirJobs = Math.max(1, ...directions.map((d) => d.jobCount));

  const dirBubbles = directions.map((d) => {
    const r = 18 + (d.jobCount / maxDirJobs) * 28;
    const pos = compassXY(cx, cy, d.id, Math.min(width, height) * 0.32);
    return {
      id: d.id,
      label: d.label,
      x: pos.x,
      y: pos.y,
      r,
      jobCount: d.jobCount,
      totalPay: d.totalPay,
    };
  });

  let driverScreen: ExploreMapLayout["driver"] = null;
  if (driverPt && input.driver?.label) {
    if (input.selectedDirection || input.selectedCityKey) {
      const bounds = boundsAround([
        driverPt,
        ...cities.map((c) => ({ lat: c.lat, lon: c.lon })),
      ]);
      const p = projectLatLon(
        driverPt.lat,
        driverPt.lon,
        bounds,
        width,
        height,
        pad,
      );
      driverScreen = {
        x: p.x,
        y: p.y,
        label: shortPlace(input.driver.label),
      };
    } else {
      driverScreen = { x: cx, y: cy, label: shortPlace(input.driver.label) };
    }
  }

  const focusCities =
    input.selectedCityKey != null
      ? cities.filter((c) => c.destKey === input.selectedCityKey)
      : input.selectedDirection != null
        ? cities.filter((c) => c.direction === input.selectedDirection)
        : [];

  const bounds =
    driverPt && focusCities.length
      ? boundsAround([
          driverPt,
          ...focusCities.map((c) => ({ lat: c.lat, lon: c.lon })),
        ])
      : null;

  const cityBubbles = focusCities.map((c) => {
    let x: number;
    let y: number;
    if (bounds && driverPt) {
      const p = projectLatLon(c.lat, c.lon, bounds, width, height, pad);
      x = p.x;
      y = p.y;
    } else {
      const pos = compassXY(cx, cy, c.direction, 120);
      x = pos.x;
      y = pos.y;
    }
    const r = 12 + Math.min(c.jobCount, 12) * 2;
    return { cluster: c, x, y, r };
  });

  const lines: ExploreMapLayout["lines"] = [];

  const appendRouteLine = (
    r: RouteConnection,
    idx: number,
    highlighted: boolean,
  ) => {
    let fromPt = { x: cx, y: cy };
    let toPt = { x: width - pad, y: height / 2 };
    if (bounds && driverPt) {
      fromPt = projectLatLon(
        r.origin.lat,
        r.origin.lon,
        bounds,
        width,
        height,
        pad,
      );
      toPt = projectLatLon(
        r.dest.lat,
        r.dest.lon,
        bounds,
        width,
        height,
        pad,
      );
    } else {
      const routeBounds = boundsAround([r.origin, r.dest]);
      fromPt = projectLatLon(
        r.origin.lat,
        r.origin.lon,
        routeBounds,
        width,
        height,
        pad,
      );
      toPt = projectLatLon(
        r.dest.lat,
        r.dest.lon,
        routeBounds,
        width,
        height,
        pad,
      );
    }
    lines.push({
      id: r.id,
      path: curvedPath(fromPt, toPt, ((idx % 5) - 2) * 14),
      jobCount: r.jobCount,
      totalPay: r.totalPay,
      originLabel: r.originLabel,
      destLabel: r.destLabel,
      jobs: r.jobs,
      highlighted,
    });
  };

  if (input.selectedRouteId && !input.selectedCityKey && !input.selectedDirection) {
    const r = routes.find((x) => x.id === input.selectedRouteId);
    if (r) appendRouteLine(r, 0, true);
  } else if (input.selectedCityKey && driverScreen) {
    const city = cities.find((c) => c.destKey === input.selectedCityKey);
    const destBubble = cityBubbles[0];
    if (city && destBubble) {
      const conn = routes.filter((r) => r.destKey === input.selectedCityKey);
      conn.forEach((r, idx) => {
        appendRouteLine(r, idx, input.selectedRouteId === r.id);
      });
    }
  } else if (input.selectedDirection && driverScreen) {
    cityBubbles.forEach((b, idx) => {
      lines.push({
        id: `you-${b.cluster.destKey}`,
        path: curvedPath(driverScreen!, { x: b.x, y: b.y }, ((idx % 5) - 2) * 10),
        jobCount: b.cluster.jobCount,
        totalPay: b.cluster.totalPay,
        originLabel: driverScreen!.label,
        destLabel: b.cluster.label,
        jobs: b.cluster.jobs,
        highlighted: false,
      });
    });
  }

  return {
    width,
    height,
    driver: driverScreen,
    directions: input.selectedDirection || input.selectedCityKey ? [] : dirBubbles,
    cities: input.selectedDirection || input.selectedCityKey ? cityBubbles : [],
    lines,
  };
}
