import {
  evaluateJob,
  suggestQuote,
  verdictCopy,
  type JobDecision,
} from "@/lib/job-decision";
import {
  placeKey,
  type JobsMapDriver,
  type MapJob,
} from "@/lib/jobs-map";
import { operatingDefaultsForMarket } from "@/lib/market-defaults";
import type { DriverMarket } from "@/lib/market";
import { resolveUkPlace, type LatLon } from "@/lib/uk-places";

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
  if (driver?.label?.trim()) return resolveUkPlace(driver.label);
  return null;
}

/** Empty miles from where you are to the job pickup (approx). */
export function deadheadToJob(
  job: MapJob,
  driver: JobsMapDriver | null,
): number | null {
  const from = driverPoint(driver);
  const pickup = resolveUkPlace(job.origin);
  if (!from || !pickup) return null;
  if (placeKey(driver?.label) && placeKey(driver?.label) === placeKey(job.origin)) {
    return 0;
  }
  return Math.round(haversineMi(from, pickup));
}

export function loadedMilesForJob(job: MapJob): number | null {
  if (job.miles != null && job.miles > 0) return job.miles;
  const o = resolveUkPlace(job.origin);
  const d = resolveUkPlace(job.destination);
  if (!o || !d) return null;
  return Math.max(1, Math.round(haversineMi(o, d)));
}

export type BoardJobSnapshot = {
  loadedMiles: number | null;
  deadheadMiles: number | null;
  /** True when start town couldn't be resolved for deadhead. */
  deadheadUnknown: boolean;
  decision: JobDecision | null;
  suggestion: ReturnType<typeof suggestQuote> | null;
  verdict: ReturnType<typeof verdictCopy> | null;
};

export function boardJobSnapshot(
  job: MapJob,
  driver: JobsMapDriver | null,
  market: Pick<DriverMarket, "countryCode"> | null | undefined,
): BoardJobSnapshot {
  const ops = operatingDefaultsForMarket(market);
  const loadedMiles = loadedMilesForJob(job);
  const deadheadMiles = deadheadToJob(job, driver);
  const deadheadUnknown = deadheadMiles == null;

  if (loadedMiles == null) {
    return {
      loadedMiles: null,
      deadheadMiles,
      deadheadUnknown,
      decision: null,
      suggestion: null,
      verdict: null,
    };
  }

  const base = {
    loadedMiles,
    deadheadMiles: deadheadMiles ?? 0,
    dieselPrice: ops.dieselPrice,
    economy: ops.economy,
    costPerMile: ops.costPerMile,
    fuelUnit: ops.fuelUnit,
    economyUnit: ops.economyUnit,
    shiplyFeePct: 0.13,
  };

  const quote = job.myBid != null && job.myBid > 0 ? job.myBid : null;
  const decision = quote != null ? evaluateJob({ ...base, quote }) : null;
  const suggestion = quote == null ? suggestQuote(base) : null;
  const verdict = decision ? verdictCopy(decision.verdict) : null;

  return {
    loadedMiles,
    deadheadMiles,
    deadheadUnknown,
    decision,
    suggestion,
    verdict,
  };
}
