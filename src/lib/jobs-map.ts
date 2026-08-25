import {
  boundsAround,
  projectLatLon,
  resolveUkPlace,
  type LatLon,
} from "@/lib/uk-places";

export type MapJobStatus = "hunting" | "won" | "skipped";

export type MapJob = {
  id: string;
  origin: string | null;
  destination: string | null;
  miles: number | null;
  rateTotal: number | null;
  item: string | null;
  href: string | null;
  status: MapJobStatus;
  updatedAt: string;
};

export type JobsMapFilter = "all" | "hunting" | "won";

export type JobsMapDriver = {
  label: string;
  lat: number | null;
  lon: number | null;
};

export type JobsMapState = {
  jobs: MapJob[];
  driver: JobsMapDriver | null;
};

const STORAGE_KEY = "tlm_jobs_map_v1";
export const DRIVER_STATION_KEY = "__driver__";

export const mapStatusMeta: Record<
  MapJobStatus,
  { label: string; line: string; fill: string; soft: string }
> = {
  hunting: {
    label: "Hunting",
    line: "#3d6b8a",
    fill: "#3d6b8a",
    soft: "border-sky-300 bg-sky-50 text-sky-950",
  },
  won: {
    label: "Won",
    line: "#2f6b4f",
    fill: "#2f6b4f",
    soft: "border-emerald-300 bg-emerald-50 text-emerald-950",
  },
  skipped: {
    label: "Skipped",
    line: "#9a958c",
    fill: "#9a958c",
    soft: "border-asphalt/15 bg-concrete/40 text-muted",
  },
};

export function placeKey(place: string | null | undefined) {
  return (place || "").split(",")[0]?.trim().toLowerCase() || "";
}

export function shortPlace(place: string | null | undefined) {
  if (!place?.trim()) return "?";
  return place.split(",")[0]?.trim() || place.trim();
}

export function readJobsMapState(): JobsMapState {
  if (typeof window === "undefined") return { jobs: [], driver: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { jobs: [], driver: null };
    const parsed = JSON.parse(raw) as {
      jobs?: MapJob[];
      driver?: JobsMapDriver | null;
      start?: string;
    };
    const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
    let driver = parsed.driver ?? null;
    // Migrate older start-only saves
    if (!driver && typeof parsed.start === "string" && parsed.start.trim()) {
      driver = { label: parsed.start.trim(), lat: null, lon: null };
    }
    return { jobs, driver };
  } catch {
    return { jobs: [], driver: null };
  }
}

/** @deprecated use readJobsMapState */
export function readJobsMap(): MapJob[] {
  return readJobsMapState().jobs;
}

export function writeJobsMapState(state: JobsMapState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      jobs: state.jobs,
      driver: state.driver,
      savedAt: new Date().toISOString(),
    }),
  );
}

export function writeJobsMap(jobs: MapJob[]) {
  if (typeof window === "undefined") return;
  const prev = readJobsMapState();
  writeJobsMapState({ ...prev, jobs });
}

export function filterMapJobs(jobs: MapJob[], filter: JobsMapFilter) {
  if (filter === "hunting") return jobs.filter((j) => j.status === "hunting");
  if (filter === "won") return jobs.filter((j) => j.status === "won");
  return jobs.filter((j) => j.status !== "skipped");
}

export type TubeStation = {
  key: string;
  label: string;
  x: number;
  y: number;
  kind: "place" | "driver";
  lat: number | null;
  lon: number | null;
  placed: boolean;
};

export type TubeLine = {
  job: MapJob;
  from: TubeStation;
  to: TubeStation;
  path: string;
};

export type TubeDeadhead = {
  from: TubeStation;
  to: TubeStation;
  path: string;
  jobId: string;
};

function resolvePoint(
  place: string | null | undefined,
  overrides?: Record<string, LatLon>,
): LatLon | null {
  return resolveUkPlace(place, overrides);
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

function spreadCollisions(stations: TubeStation[]) {
  for (let i = 0; i < stations.length; i++) {
    for (let j = i + 1; j < stations.length; j++) {
      const a = stations[i]!;
      const b = stations[j]!;
      if (!a.placed || !b.placed) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 22 && dist > 0.01) {
        const push = (22 - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}

/**
 * Geographic tube layout: stations placed by UK lat/lon, zoomed to the job cluster.
 * Driver start is a distinct station when provided.
 */
export function layoutTubeMap(
  jobs: MapJob[],
  options?: {
    width?: number;
    height?: number;
    driver?: JobsMapDriver | null;
    coordOverrides?: Record<string, LatLon>;
    selectedJobId?: string | null;
  },
): {
  stations: TubeStation[];
  lines: TubeLine[];
  deadheads: TubeDeadhead[];
  unresolved: string[];
  width: number;
  height: number;
} {
  const width = options?.width ?? 640;
  const height = options?.height ?? 780;
  const pad = 48;
  const overrides = options?.coordOverrides;
  const usable = jobs.filter(
    (j) => placeKey(j.origin) && placeKey(j.destination),
  );

  const labels = new Map<string, string>();
  const points = new Map<string, LatLon | null>();
  const unresolved: string[] = [];

  for (const j of usable) {
    const o = placeKey(j.origin);
    const d = placeKey(j.destination);
    labels.set(o, shortPlace(j.origin));
    labels.set(d, shortPlace(j.destination));
    if (!points.has(o)) {
      const p = resolvePoint(j.origin, overrides);
      points.set(o, p);
      if (!p) unresolved.push(shortPlace(j.origin));
    }
    if (!points.has(d)) {
      const p = resolvePoint(j.destination, overrides);
      points.set(d, p);
      if (!p) unresolved.push(shortPlace(j.destination));
    }
  }

  let driverPoint: LatLon | null = null;
  const driver = options?.driver;
  if (driver?.label.trim()) {
    if (
      typeof driver.lat === "number" &&
      typeof driver.lon === "number" &&
      Number.isFinite(driver.lat) &&
      Number.isFinite(driver.lon)
    ) {
      driverPoint = { lat: driver.lat, lon: driver.lon };
    } else {
      driverPoint = resolvePoint(driver.label, overrides);
      if (!driverPoint) unresolved.push(driver.label);
    }
  }

  const known: LatLon[] = [...points.values()].filter(
    (p): p is LatLon => Boolean(p),
  );
  if (driverPoint) known.push(driverPoint);

  if (!usable.length && !driverPoint) {
    return {
      stations: [],
      lines: [],
      deadheads: [],
      unresolved: [],
      width,
      height,
    };
  }

  const bounds = boundsAround(known.length ? known : [{ lat: 52.5, lon: -1.5 }]);

  // Unplaced stations: park in a legend strip at bottom-left
  let unplacedSlot = 0;

  const stations: TubeStation[] = [];
  const stationByKey = new Map<string, TubeStation>();

  for (const [key, label] of labels) {
    const ll = points.get(key);
    let x: number;
    let y: number;
    let placed = false;
    if (ll) {
      const proj = projectLatLon(ll.lat, ll.lon, bounds, width, height, pad);
      x = proj.x;
      y = proj.y;
      placed = true;
    } else {
      x = pad + 10 + (unplacedSlot % 3) * 90;
      y = height - pad + 8 + Math.floor(unplacedSlot / 3) * 18;
      // Keep inside viewBox — actually put above bottom pad inside map
      y = height - 36 - Math.floor(unplacedSlot / 4) * 20;
      x = pad + (unplacedSlot % 4) * 100;
      unplacedSlot += 1;
    }
    const st: TubeStation = {
      key,
      label,
      x,
      y,
      kind: "place",
      lat: ll?.lat ?? null,
      lon: ll?.lon ?? null,
      placed,
    };
    stations.push(st);
    stationByKey.set(key, st);
  }

  let driverStation: TubeStation | null = null;
  if (driver?.label.trim()) {
    let x = width / 2;
    let y = height / 2;
    let placed = false;
    if (driverPoint) {
      const proj = projectLatLon(
        driverPoint.lat,
        driverPoint.lon,
        bounds,
        width,
        height,
        pad,
      );
      x = proj.x;
      y = proj.y;
      placed = true;
    }
    driverStation = {
      key: DRIVER_STATION_KEY,
      label: shortPlace(driver.label) || "You",
      x,
      y,
      kind: "driver",
      lat: driverPoint?.lat ?? null,
      lon: driverPoint?.lon ?? null,
      placed,
    };
    stations.push(driverStation);
  }

  spreadCollisions(stations.filter((s) => s.placed));

  const lines: TubeLine[] = [];
  usable.forEach((job, idx) => {
    const from = stationByKey.get(placeKey(job.origin));
    const to = stationByKey.get(placeKey(job.destination));
    if (!from || !to) return;
    const bend = ((idx % 7) - 3) * 12;
    lines.push({
      job,
      from,
      to,
      path: curvedPath(from, to, bend),
    });
  });

  const deadheads: TubeDeadhead[] = [];
  if (driverStation?.placed && options?.selectedJobId) {
    const focus = usable.find((j) => j.id === options.selectedJobId);
    if (focus) {
      const to = stationByKey.get(placeKey(focus.origin));
      if (
        to?.placed &&
        placeKey(focus.origin) !== placeKey(driver?.label)
      ) {
        deadheads.push({
          from: driverStation,
          to,
          path: curvedPath(driverStation, to, -18),
          jobId: focus.id,
        });
      }
    }
  }

  return {
    stations,
    lines,
    deadheads,
    unresolved: [...new Set(unresolved)],
    width,
    height,
  };
}

export function mergeScannedJobs(
  existing: MapJob[],
  scanned: Array<{
    id: string;
    origin: string | null;
    destination: string | null;
    miles: number | null;
    rateTotal: number | null;
    item: string | null;
    href?: string | null;
  }>,
): MapJob[] {
  const next = [...existing];
  const now = new Date().toISOString();

  for (const s of scanned) {
    const o = placeKey(s.origin);
    const d = placeKey(s.destination);
    if (!o || !d) continue;

    const matchIdx = next.findIndex(
      (j) =>
        placeKey(j.origin) === o &&
        placeKey(j.destination) === d &&
        (j.item || "").toLowerCase() === (s.item || "").toLowerCase(),
    );

    if (matchIdx >= 0) {
      const prev = next[matchIdx]!;
      next[matchIdx] = {
        ...prev,
        miles: s.miles ?? prev.miles,
        rateTotal: s.rateTotal ?? prev.rateTotal,
        item: s.item ?? prev.item,
        href: s.href ?? prev.href,
        updatedAt: now,
      };
      continue;
    }

    next.push({
      id: s.id || `map-${o}-${d}-${now}`,
      origin: s.origin,
      destination: s.destination,
      miles: s.miles,
      rateTotal: s.rateTotal,
      item: s.item,
      href: s.href ?? null,
      status: "hunting",
      updatedAt: now,
    });
  }

  return next;
}
