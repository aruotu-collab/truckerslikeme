import { resolveUkPlace } from "@/lib/uk-places";

export type MapJobStatus = "hunting" | "bidding" | "won" | "delivered" | "skipped";

export type MapJob = {
  id: string;
  origin: string | null;
  destination: string | null;
  miles: number | null;
  /** Scraped Shiply figure — often wrong (quote counts etc). Do not show as the driver's pay. */
  rateTotal: number | null;
  /** Driver's intended bid / quote for this job. Used for run revenue. */
  myBid: number | null;
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
  /** Current position for empty-mile calcs (moves after wins). */
  driver: JobsMapDriver | null;
  /** Day start / home base — set when the driver chooses start. */
  home: JobsMapDriver | null;
  /** Ordered job ids in today's run chain. */
  todayRunIds: string[];
};

const STORAGE_KEY = "tlm_jobs_map_v1";
export const DRIVER_STATION_KEY = "__driver__";

export const mapStatusMeta: Record<
  MapJobStatus,
  { label: string; line: string; fill: string; soft: string }
> = {
  hunting: {
    label: "On board",
    line: "#6b7280",
    fill: "#6b7280",
    soft: "border-asphalt/20 bg-concrete/50 text-asphalt",
  },
  bidding: {
    label: "Bidding",
    line: "#c4a035",
    fill: "#c4a035",
    soft: "border-amber/40 bg-amber/10 text-asphalt",
  },
  won: {
    label: "Won",
    line: "#2f6b4f",
    fill: "#2f6b4f",
    soft: "border-emerald-300 bg-emerald-50 text-emerald-950",
  },
  delivered: {
    label: "Delivered",
    line: "#4a6f86",
    fill: "#4a6f86",
    soft: "border-sky-300 bg-sky-50 text-sky-950",
  },
  skipped: {
    label: "Hidden",
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

/** Driver's quote only — never scraped Shiply amounts. */
export function jobMyBid(job: MapJob): number {
  return job.myBid != null && job.myBid > 0 ? job.myBid : 0;
}

export function hasMyBid(job: MapJob): boolean {
  return jobMyBid(job) > 0;
}

function migrateStatus(raw: string | undefined): MapJobStatus {
  if (
    raw === "won" ||
    raw === "bidding" ||
    raw === "skipped" ||
    raw === "delivered"
  ) {
    return raw;
  }
  return "hunting";
}

export function readJobsMapState(): JobsMapState {
  if (typeof window === "undefined") return { jobs: [], driver: null, home: null, todayRunIds: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { jobs: [], driver: null, home: null, todayRunIds: [] };
    const parsed = JSON.parse(raw) as {
      jobs?: Array<MapJob & { status?: string }>;
      driver?: JobsMapDriver | null;
      home?: JobsMapDriver | null;
      todayRunIds?: string[];
      start?: string;
    };
    const jobs = (Array.isArray(parsed.jobs) ? parsed.jobs : []).map((j) => ({
      ...j,
      status: migrateStatus(j.status),
      myBid:
        typeof (j as MapJob).myBid === "number" &&
        Number.isFinite((j as MapJob).myBid)
          ? (j as MapJob).myBid
          : null,
      // Drop scraped amounts — they are not the driver's bid
      rateTotal: null as number | null,
    }));
    let driver = parsed.driver ?? null;
    if (!driver && typeof parsed.start === "string" && parsed.start.trim()) {
      driver = { label: parsed.start.trim(), lat: null, lon: null };
    }
    let home = parsed.home ?? null;
    if (!home && driver) home = { ...driver };
    const todayRunIds = Array.isArray(parsed.todayRunIds)
      ? parsed.todayRunIds.filter((id) => typeof id === "string")
      : [];
    return { jobs, driver, home, todayRunIds };
  } catch {
    return { jobs: [], driver: null, home: null, todayRunIds: [] };
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
      home: state.home ?? null,
      todayRunIds: state.todayRunIds ?? [],
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
  if (filter === "hunting") {
    return jobs.filter((j) => j.status === "hunting" || j.status === "bidding");
  }
  if (filter === "won") return jobs.filter((j) => j.status === "won");
  return jobs.filter((j) => j.status !== "skipped" && j.status !== "delivered");
}

/** Jobs shown on the Map Jobs hunt board (not won / delivered / skipped). */
export function huntBoardJobs(jobs: MapJob[]) {
  return jobs.filter(
    (j) =>
      j.status !== "won" &&
      j.status !== "delivered" &&
      j.status !== "skipped",
  );
}

export type MyJobsFilter =
  | "bidding"
  | "won"
  | "considering"
  | "delivered"
  | "skipped";

export function filterMyJobs(jobs: MapJob[], filter: MyJobsFilter) {
  if (filter === "won") return jobs.filter((j) => j.status === "won");
  if (filter === "delivered")
    return jobs.filter((j) => j.status === "delivered");
  if (filter === "skipped") return jobs.filter((j) => j.status === "skipped");
  if (filter === "bidding") {
    return jobs.filter((j) => j.status === "bidding");
  }
  // On board (considering) — status hunting only (quote may still be set)
  return jobs.filter((j) => j.status === "hunting");
}

export function countMyJobs(jobs: MapJob[]) {
  return {
    bidding: filterMyJobs(jobs, "bidding").length,
    won: filterMyJobs(jobs, "won").length,
    considering: filterMyJobs(jobs, "considering").length,
    delivered: filterMyJobs(jobs, "delivered").length,
    skipped: filterMyJobs(jobs, "skipped").length,
  };
}

/** Persist today's run order (shared by Map Jobs + My Jobs). */
export function writeTodayRunIds(todayRunIds: string[]) {
  const prev = readJobsMapState();
  writeJobsMapState({ ...prev, todayRunIds });
}

export function addJobsToTodayRun(jobIds: string[]) {
  const prev = readJobsMapState();
  let ids = [...(prev.todayRunIds ?? [])];
  for (const id of jobIds) {
    if (!ids.includes(id)) ids.push(id);
  }
  writeJobsMapState({ ...prev, todayRunIds: ids });
  return ids;
}

export function replaceTodayRunWithJobs(jobIds: string[]) {
  const prev = readJobsMapState();
  const ids = [...new Set(jobIds)];
  writeJobsMapState({ ...prev, todayRunIds: ids });
  return ids;
}

export type TubeStation = {
  key: string;
  label: string;
  x: number;
  y: number;
  kind: "place" | "driver";
  role: "collect" | "hub" | "deliver" | "you";
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

function curvedPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  bend: number,
) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2 + bend;
  return `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;
}

type Col = "left" | "mid" | "right";

/**
 * Underground-style schematic: collect (left) → hub → deliver (right).
 * Stations within each column are stacked north→south using UK lat when known.
 */
export function layoutTubeMap(
  jobs: MapJob[],
  options?: {
    width?: number;
    height?: number;
    driver?: JobsMapDriver | null;
    selectedJobId?: string | null;
  },
): {
  stations: TubeStation[];
  lines: TubeLine[];
  deadheads: TubeDeadhead[];
  width: number;
  height: number;
} {
  const width = options?.width ?? 920;
  const height = options?.height ?? 480;
  const padX = 72;
  const padY = 56;

  const usable = jobs.filter(
    (j) => placeKey(j.origin) && placeKey(j.destination),
  );

  if (!usable.length && !options?.driver?.label?.trim()) {
    return { stations: [], lines: [], deadheads: [], width, height };
  }

  const labels = new Map<string, string>();
  const asOrigin = new Map<string, number>();
  const asDest = new Map<string, number>();

  for (const j of usable) {
    const o = placeKey(j.origin);
    const d = placeKey(j.destination);
    labels.set(o, shortPlace(j.origin));
    labels.set(d, shortPlace(j.destination));
    asOrigin.set(o, (asOrigin.get(o) || 0) + 1);
    asDest.set(d, (asDest.get(d) || 0) + 1);
  }

  const colOf = (k: string): Col => {
    const o = asOrigin.get(k) || 0;
    const d = asDest.get(k) || 0;
    if (o && !d) return "left";
    if (d && !o) return "right";
    return "mid";
  };

  const xFor: Record<Col, number> = {
    left: padX,
    mid: width / 2,
    right: width - padX,
  };

  const buckets: Record<Col, string[]> = { left: [], mid: [], right: [] };
  for (const k of labels.keys()) buckets[colOf(k)].push(k);

  // Sort within column: higher latitude (north) toward top
  const sortKeys = (keys: string[]) =>
    [...keys].sort((a, b) => {
      const la = resolveUkPlace(labels.get(a) || a)?.lat ?? 52.5;
      const lb = resolveUkPlace(labels.get(b) || b)?.lat ?? 52.5;
      if (la !== lb) return lb - la;
      return (labels.get(a) || "").localeCompare(labels.get(b) || "");
    });

  const stations: TubeStation[] = [];
  const stationByKey = new Map<string, TubeStation>();

  (["left", "mid", "right"] as Col[]).forEach((col) => {
    const list = sortKeys(buckets[col]);
    list.forEach((k, i) => {
      const n = Math.max(list.length, 1);
      const y =
        n === 1 ? height / 2 : padY + ((height - padY * 2) * i) / (n - 1);
      const role: TubeStation["role"] =
        col === "left" ? "collect" : col === "right" ? "deliver" : "hub";
      const st: TubeStation = {
        key: k,
        label: labels.get(k) || k,
        x: xFor[col],
        y,
        kind: "place",
        role,
      };
      stations.push(st);
      stationByKey.set(k, st);
    });
  });

  let driverStation: TubeStation | null = null;
  const driver = options?.driver;
  if (driver?.label.trim()) {
    const dk = placeKey(driver.label);
    const existing = stationByKey.get(dk);
    if (existing) {
      driverStation = { ...existing, kind: "driver", role: "you" };
    } else {
      const leftList = sortKeys([...buckets.left, dk]);
      const slot = Math.max(0, leftList.indexOf(dk));
      const n = Math.max(leftList.length, 1);
      const y =
        n === 1 ? height / 2 : padY + ((height - padY * 2) * slot) / (n - 1);
      driverStation = {
        key: DRIVER_STATION_KEY,
        label: shortPlace(driver.label) || "You",
        x: padX - 40,
        y,
        kind: "driver",
        role: "you",
      };
      stations.push(driverStation);
    }
  }

  const lines: TubeLine[] = [];
  usable.forEach((job, idx) => {
    const from = stationByKey.get(placeKey(job.origin));
    const to = stationByKey.get(placeKey(job.destination));
    if (!from || !to) return;
    const bend = ((idx % 7) - 3) * 22;
    lines.push({
      job,
      from,
      to,
      path: curvedPath(from, to, bend),
    });
  });

  const deadheads: TubeDeadhead[] = [];
  if (driverStation && options?.selectedJobId) {
    const focus = usable.find((j) => j.id === options.selectedJobId);
    if (focus) {
      const to = stationByKey.get(placeKey(focus.origin));
      if (to && placeKey(focus.origin) !== placeKey(driver?.label)) {
        deadheads.push({
          from: driverStation,
          to,
          path: curvedPath(driverStation, to, -16),
          jobId: focus.id,
        });
      }
    }
  }

  return { stations, lines, deadheads, width, height };
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
        // Never import scraped Shiply £ as the driver's quote
        rateTotal: null,
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
      rateTotal: null,
      myBid: null,
      item: s.item,
      href: s.href ?? null,
      status: "hunting",
      updatedAt: now,
    });
  }

  return next;
}
