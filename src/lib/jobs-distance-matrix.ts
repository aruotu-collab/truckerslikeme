import { placeKey, shortPlace, type JobsMapDriver, type MapJob } from "@/lib/jobs-map";
import { resolveUkPlace, type LatLon } from "@/lib/uk-places";

export type DistPlace = {
  key: string;
  label: string;
  lat: number;
  lon: number;
  /** Jobs with pickup here. */
  pickupCount: number;
  /** Jobs with drop here. */
  dropCount: number;
};

export type DistCell = {
  fromKey: string;
  toKey: string;
  fromLabel: string;
  toLabel: string;
  miles: number;
};

export type DistanceMatrix = {
  places: DistPlace[];
  /** Key: `${fromKey}→${toKey}` */
  cells: Map<string, DistCell>;
  maxMiles: number;
  unmappedCount: number;
};

export function distCellKey(fromKey: string, toKey: string) {
  return `${fromKey}→${toKey}`;
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

function driverPoint(driver: JobsMapDriver | null): LatLon | null {
  if (driver?.lat != null && driver?.lon != null) {
    return { lat: driver.lat, lon: driver.lon };
  }
  return resolveUkPlace(driver?.label);
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

/** Heat: shorter = warmer amber (easier deadhead). */
export function distHeatStyle(
  miles: number,
  maxMiles: number,
): { backgroundColor: string; color: string } {
  if (miles <= 0 || maxMiles <= 0) {
    return { backgroundColor: "#f3f4f6", color: "#6b7280" };
  }
  const t = Math.min(1, miles / Math.max(maxMiles * 0.65, 1));
  const closeness = 1 - t;
  const alpha = 0.08 + closeness * 0.42;
  return {
    backgroundColor: `rgba(196, 160, 53, ${alpha})`,
    color: closeness > 0.55 ? "#1a1a1a" : "#374151",
  };
}

/**
 * Symmetric place×place distance matrix from all mapped job towns
 * (plus driver start if known). Used for deadhead / chaining insight.
 */
export function buildDistanceMatrix(
  jobs: MapJob[],
  driver: JobsMapDriver | null,
): DistanceMatrix {
  const placeMeta = new Map<
    string,
    { label: string; pickup: number; drop: number }
  >();
  let unmappedCount = 0;

  for (const job of jobs) {
    const oKey = placeKey(job.origin);
    const dKey = placeKey(job.destination);
    const oOk = oKey && resolveUkPlace(job.origin);
    const dOk = dKey && resolveUkPlace(job.destination);
    if (!oOk || !dOk) {
      unmappedCount += 1;
      continue;
    }
    const o = placeMeta.get(oKey) ?? {
      label: shortPlace(job.origin),
      pickup: 0,
      drop: 0,
    };
    o.pickup += 1;
    placeMeta.set(oKey, o);

    const d = placeMeta.get(dKey) ?? {
      label: shortPlace(job.destination),
      pickup: 0,
      drop: 0,
    };
    d.drop += 1;
    placeMeta.set(dKey, d);
  }

  const dpt = driverPoint(driver);
  const driverKey = driver?.label ? placeKey(driver.label) : "";
  if (dpt && driverKey && !placeMeta.has(driverKey)) {
    placeMeta.set(driverKey, {
      label: shortPlace(driver!.label),
      pickup: 0,
      drop: 0,
    });
  }

  const coords = new Map<string, LatLon>();
  for (const key of placeMeta.keys()) {
    const meta = placeMeta.get(key)!;
    const resolved =
      key === driverKey && dpt
        ? dpt
        : resolveUkPlace(meta.label) ??
          // try original key as place name
          resolveUkPlace(key);
    if (resolved) coords.set(key, resolved);
  }

  const sortOrigin =
    dpt ??
    (coords.size
      ? {
          lat:
            [...coords.values()].reduce((s, p) => s + p.lat, 0) / coords.size,
          lon:
            [...coords.values()].reduce((s, p) => s + p.lon, 0) / coords.size,
        }
      : null);

  const keys = [...placeMeta.keys()]
    .filter((k) => coords.has(k))
    .sort((a, b) => {
      const ca = coords.get(a)!;
      const cb = coords.get(b)!;
      if (sortOrigin) {
        const ba = bearingDeg(sortOrigin, ca);
        const bb = bearingDeg(sortOrigin, cb);
        if (Math.abs(ba - bb) > 0.5) return ba - bb;
      }
      const na =
        (placeMeta.get(a)?.pickup ?? 0) + (placeMeta.get(a)?.drop ?? 0);
      const nb =
        (placeMeta.get(b)?.pickup ?? 0) + (placeMeta.get(b)?.drop ?? 0);
      if (nb !== na) return nb - na;
      return a.localeCompare(b);
    });

  const places: DistPlace[] = keys.map((key) => {
    const meta = placeMeta.get(key)!;
    const c = coords.get(key)!;
    return {
      key,
      label: meta.label,
      lat: c.lat,
      lon: c.lon,
      pickupCount: meta.pickup,
      dropCount: meta.drop,
    };
  });

  const cells = new Map<string, DistCell>();
  let maxMiles = 0;

  for (const from of places) {
    for (const to of places) {
      const miles =
        from.key === to.key
          ? 0
          : Math.round(
              haversineMi(
                { lat: from.lat, lon: from.lon },
                { lat: to.lat, lon: to.lon },
              ),
            );
      if (miles > maxMiles) maxMiles = miles;
      cells.set(distCellKey(from.key, to.key), {
        fromKey: from.key,
        toKey: to.key,
        fromLabel: from.label,
        toLabel: to.label,
        miles,
      });
    }
  }

  return { places, cells, maxMiles, unmappedCount };
}

/** Jobs that drop at `from` then could deadhead to a pickup at `to`. */
export function chainingCandidates(
  jobs: MapJob[],
  fromKey: string,
  toKey: string,
): { afterDrop: MapJob[]; nextPickup: MapJob[] } {
  const afterDrop = jobs.filter((j) => placeKey(j.destination) === fromKey);
  const nextPickup = jobs.filter((j) => placeKey(j.origin) === toKey);
  return { afterDrop, nextPickup };
}
