import { placeKey, shortPlace, type JobsMapDriver, type MapJob } from "@/lib/jobs-map";
import { resolveUkPlace, type LatLon } from "@/lib/uk-places";

export type LanePlace = {
  key: string;
  label: string;
  total: number;
  lat: number | null;
  lon: number | null;
};

export type LaneCell = {
  pickupKey: string;
  dropKey: string;
  pickupLabel: string;
  dropLabel: string;
  count: number;
  jobs: MapJob[];
  totalPay: number;
};

export type LaneMatrix = {
  pickups: LanePlace[];
  drops: LanePlace[];
  cells: Map<string, LaneCell>;
  maxCount: number;
  totalJobs: number;
  unmappedCount: number;
};

function jobPay(j: MapJob) {
  return j.rateTotal != null && j.rateTotal > 0 ? j.rateTotal : 0;
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

function centroid(points: LatLon[]): LatLon | null {
  if (!points.length) return null;
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lon: acc.lon + p.lon }),
    { lat: 0, lon: 0 },
  );
  return { lat: sum.lat / points.length, lon: sum.lon / points.length };
}

function driverPoint(driver: JobsMapDriver | null): LatLon | null {
  if (driver?.lat != null && driver?.lon != null) {
    return { lat: driver.lat, lon: driver.lon };
  }
  return resolveUkPlace(driver?.label);
}

function sortPlacesGeographically(
  keys: string[],
  coords: Map<string, LatLon>,
  counts: Map<string, number>,
  sortOrigin: LatLon | null,
): string[] {
  return [...keys].sort((a, b) => {
    const ca = coords.get(a);
    const cb = coords.get(b);
    if (ca && cb && sortOrigin) {
      return bearingDeg(sortOrigin, ca) - bearingDeg(sortOrigin, cb);
    }
    const diff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });
}

/** Origin–destination matrix: rows = pickup, cols = drop, cell = job count on that lane. */
export function buildLaneMatrix(
  jobs: MapJob[],
  driver: JobsMapDriver | null,
): LaneMatrix {
  const active = jobs.filter((j) => j.status !== "skipped");
  const cells = new Map<string, LaneCell>();
  const pickupCounts = new Map<string, number>();
  const dropCounts = new Map<string, number>();
  const pickupLabels = new Map<string, string>();
  const dropLabels = new Map<string, string>();
  const pickupCoords = new Map<string, LatLon>();
  const dropCoords = new Map<string, LatLon>();
  let mapped = 0;

  for (const job of active) {
    const pk = placeKey(job.origin);
    const dk = placeKey(job.destination);
    if (!pk || !dk) continue;

    mapped++;
    pickupLabels.set(pk, shortPlace(job.origin));
    dropLabels.set(dk, shortPlace(job.destination));

    const o = resolveUkPlace(job.origin);
    const d = resolveUkPlace(job.destination);
    if (o) pickupCoords.set(pk, o);
    if (d) dropCoords.set(dk, d);

    const key = `${pk}|${dk}`;
    const existing = cells.get(key);
    if (existing) {
      existing.count += 1;
      existing.jobs.push(job);
      existing.totalPay += jobPay(job);
    } else {
      cells.set(key, {
        pickupKey: pk,
        dropKey: dk,
        pickupLabel: shortPlace(job.origin),
        dropLabel: shortPlace(job.destination),
        count: 1,
        jobs: [job],
        totalPay: jobPay(job),
      });
    }

    pickupCounts.set(pk, (pickupCounts.get(pk) ?? 0) + 1);
    dropCounts.set(dk, (dropCounts.get(dk) ?? 0) + 1);
  }

  const allCoords = [
    ...pickupCoords.values(),
    ...dropCoords.values(),
  ];
  const sortOrigin =
    driverPoint(driver) ?? centroid(allCoords);

  const pickupKeys = sortPlacesGeographically(
    [...pickupCounts.keys()],
    pickupCoords,
    pickupCounts,
    sortOrigin,
  );
  const dropKeys = sortPlacesGeographically(
    [...dropCounts.keys()],
    dropCoords,
    dropCounts,
    sortOrigin,
  );

  let maxCount = 0;
  for (const cell of cells.values()) {
    if (cell.count > maxCount) maxCount = cell.count;
  }

  const toPlace = (
    key: string,
    labels: Map<string, string>,
    counts: Map<string, number>,
    coords: Map<string, LatLon>,
  ): LanePlace => {
    const c = coords.get(key);
    return {
      key,
      label: labels.get(key) ?? key,
      total: counts.get(key) ?? 0,
      lat: c?.lat ?? null,
      lon: c?.lon ?? null,
    };
  };

  return {
    pickups: pickupKeys.map((k) =>
      toPlace(k, pickupLabels, pickupCounts, pickupCoords),
    ),
    drops: dropKeys.map((d) =>
      toPlace(d, dropLabels, dropCounts, dropCoords),
    ),
    cells,
    maxCount,
    totalJobs: mapped,
    unmappedCount: active.length - mapped,
  };
}

export function laneCellKey(pickupKey: string, dropKey: string) {
  return `${pickupKey}|${dropKey}`;
}

/** Heat intensity — light for 1 job, stronger as count rises. */
export function laneHeatStyle(
  count: number,
  maxCount: number,
): { backgroundColor: string; fontWeight?: number } {
  if (count <= 0) return { backgroundColor: "#ffffff" };
  const t = Math.min(count / Math.max(maxCount, 1), 1);
  const alpha = 0.18 + t * 0.72;
  return {
    backgroundColor: `rgba(196, 160, 53, ${alpha})`,
    fontWeight: count >= 2 ? 700 : 600,
  };
}

export function filterMatrixByPickup(
  matrix: LaneMatrix,
  pickupKey: string | null,
): LaneMatrix {
  if (!pickupKey) return matrix;
  const pickups = matrix.pickups.filter((p) => p.key === pickupKey);
  const cells = new Map<string, LaneCell>();
  for (const cell of matrix.cells.values()) {
    if (cell.pickupKey === pickupKey) {
      cells.set(laneCellKey(cell.pickupKey, cell.dropKey), cell);
    }
  }
  return { ...matrix, pickups, cells };
}

export function topLanes(matrix: LaneMatrix, limit = 8): LaneCell[] {
  return [...matrix.cells.values()]
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || b.totalPay - a.totalPay)
    .slice(0, limit);
}

export function filterMatrixByDrop(
  matrix: LaneMatrix,
  dropKey: string | null,
): LaneMatrix {
  if (!dropKey) return matrix;
  const drops = matrix.drops.filter((d) => d.key === dropKey);
  const cells = new Map<string, LaneCell>();
  for (const cell of matrix.cells.values()) {
    if (cell.dropKey === dropKey) {
      cells.set(laneCellKey(cell.pickupKey, cell.dropKey), cell);
    }
  }
  return { ...matrix, drops, cells };
}
