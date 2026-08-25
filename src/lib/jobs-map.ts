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

const STORAGE_KEY = "tlm_jobs_map_v1";

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

export function readJobsMap(): MapJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { jobs?: MapJob[] };
    return Array.isArray(parsed.jobs) ? parsed.jobs : [];
  } catch {
    return [];
  }
}

export function writeJobsMap(jobs: MapJob[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ jobs, savedAt: new Date().toISOString() }));
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
};

export type TubeLine = {
  job: MapJob;
  from: TubeStation;
  to: TubeStation;
  path: string;
};

/** Schematic tube layout: origins left, destinations right, shared places as interchanges. */
export function layoutTubeMap(
  jobs: MapJob[],
  width = 920,
  height = 420,
): { stations: TubeStation[]; lines: TubeLine[] } {
  const padX = 70;
  const padY = 48;
  const usable = jobs.filter(
    (j) => placeKey(j.origin) && placeKey(j.destination),
  );
  if (!usable.length) return { stations: [], lines: [] };

  const asOrigin = new Map<string, number>();
  const asDest = new Map<string, number>();
  const labels = new Map<string, string>();

  for (const j of usable) {
    const o = placeKey(j.origin);
    const d = placeKey(j.destination);
    labels.set(o, shortPlace(j.origin));
    labels.set(d, shortPlace(j.destination));
    asOrigin.set(o, (asOrigin.get(o) || 0) + 1);
    asDest.set(d, (asDest.get(d) || 0) + 1);
  }

  const keys = [...labels.keys()];
  keys.sort((a, b) => {
    const score = (k: string) =>
      (asOrigin.get(k) || 0) - (asDest.get(k) || 0);
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sb - sa;
    return (labels.get(a) || "").localeCompare(labels.get(b) || "");
  });

  // Column by role, row stacked within column
  type Col = "left" | "mid" | "right";
  const colOf = (k: string): Col => {
    const o = asOrigin.get(k) || 0;
    const d = asDest.get(k) || 0;
    if (o && !d) return "left";
    if (d && !o) return "right";
    return "mid";
  };

  const buckets: Record<Col, string[]> = { left: [], mid: [], right: [] };
  for (const k of keys) buckets[colOf(k)].push(k);

  const xFor: Record<Col, number> = {
    left: padX,
    mid: width / 2,
    right: width - padX,
  };

  const stations: TubeStation[] = [];
  const stationByKey = new Map<string, TubeStation>();

  (["left", "mid", "right"] as Col[]).forEach((col) => {
    const list = buckets[col];
    list.forEach((k, i) => {
      const n = Math.max(list.length, 1);
      const y =
        n === 1
          ? height / 2
          : padY + ((height - padY * 2) * i) / (n - 1);
      const st: TubeStation = {
        key: k,
        label: labels.get(k) || k,
        x: xFor[col],
        y,
      };
      stations.push(st);
      stationByKey.set(k, st);
    });
  });

  const lines: TubeLine[] = [];
  usable.forEach((job, idx) => {
    const from = stationByKey.get(placeKey(job.origin));
    const to = stationByKey.get(placeKey(job.destination));
    if (!from || !to) return;
    const bend = ((idx % 5) - 2) * 28;
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2 + bend;
    const path = `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;
    lines.push({ job, from, to, path });
  });

  return { stations, lines };
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
      // Keep won/skipped status; refresh details
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
