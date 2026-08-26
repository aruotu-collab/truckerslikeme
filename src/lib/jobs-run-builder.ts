import { boundsAround, projectLatLon, resolveUkPlace, type LatLon } from "@/lib/uk-places";
import {
  jobMyBid,
  placeKey,
  shortPlace,
  type JobsMapDriver,
  type MapJob,
} from "@/lib/jobs-map";

export type RunGoal =
  | "revenue"
  | "rpm"
  | "empty"
  | "home"
  | "short";

export type RunBuilderPrefs = {
  goal: RunGoal;
  maxEmptyMi: number;
  maxJobs: number;
  /** Deadhead cost multiplier (£ per empty mile). */
  deadheadCostPerMi: number;
};

export const DEFAULT_RUN_PREFS: RunBuilderPrefs = {
  goal: "rpm",
  maxEmptyMi: 50,
  maxJobs: 4,
  deadheadCostPerMi: 1.5,
};

export const RUN_GOAL_LABELS: Record<RunGoal, string> = {
  revenue: "Highest earnings",
  rpm: "Best £ / mile",
  empty: "Least empty mileage",
  home: "Finish near home",
  short: "Short day",
};

type ScoredJob = {
  job: MapJob;
  pickup: LatLon;
  drop: LatLon;
};

export type ConnectionQuality =
  | "excellent"
  | "good"
  | "acceptable"
  | "poor"
  | "reject";

export type BidPlanLeg = {
  kind: "start" | "empty" | "pickup" | "loaded" | "deliver" | "handoff";
  place: string;
  miles?: number;
  job?: MapJob;
  pay?: number | null;
  deliverPay?: number | null;
  pickupPay?: number | null;
  jobIndex?: number;
};

export type BidPlan = {
  id: string;
  label: string;
  goal: RunGoal;
  jobs: MapJob[];
  legs: BidPlanLeg[];
  revenue: number;
  loadedMiles: number;
  emptyMiles: number;
  totalMiles: number;
  revenuePerMile: number;
  emptyPct: number;
  endsNearHome: boolean;
  risks: string[];
  geographicFit: "excellent" | "good" | "fair";
};

export type RunBuilderResult = {
  plans: BidPlan[];
  unpairedCount: number;
  totalJobs: number;
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

function jobPay(j: MapJob) {
  return jobMyBid(j);
}

function jobMiles(j: ScoredJob) {
  if (j.job.miles != null && j.job.miles > 0) return j.job.miles;
  return Math.round(haversineMi(j.pickup, j.drop));
}

function cityMatch(a: string | null | undefined, b: string | null | undefined) {
  const ca = placeKey(a);
  const cb = placeKey(b);
  if (!ca || !cb) return false;
  return ca === cb || ca.includes(cb) || cb.includes(ca);
}

export function connectionQuality(deadheadMi: number): ConnectionQuality {
  if (deadheadMi <= 10) return "excellent";
  if (deadheadMi <= 25) return "good";
  if (deadheadMi <= 50) return "acceptable";
  if (deadheadMi <= 80) return "poor";
  return "reject";
}

function toScoredJobs(jobs: MapJob[]): ScoredJob[] {
  const out: ScoredJob[] = [];
  for (const job of jobs) {
    const pickup = resolveUkPlace(job.origin);
    const drop = resolveUkPlace(job.destination);
    if (!pickup || !drop) continue;
    out.push({ job, pickup, drop });
  }
  return out;
}

function driverPoint(driver: JobsMapDriver | null): LatLon | null {
  if (driver?.lat != null && driver?.lon != null) {
    return { lat: driver.lat, lon: driver.lon };
  }
  return resolveUkPlace(driver?.label);
}

/** Score job B as next leg after finishing at `from` (drop of previous job). */
export function scoreJobConnection(
  from: LatLon,
  to: ScoredJob,
  prefs: RunBuilderPrefs,
  driver: JobsMapDriver | null,
): number {
  const deadhead = haversineMi(from, to.pickup);
  const quality = connectionQuality(deadhead);

  // Soft reject only for extreme reposition + low pay
  if (deadhead > 150 && jobPay(to.job) < 150) return -Infinity;
  if (quality === "reject" && jobPay(to.job) < 200 && deadhead > prefs.maxEmptyMi) {
    return -Infinity;
  }

  const loaded = jobMiles(to);
  const pay = jobPay(to.job);
  let score = pay - deadhead * prefs.deadheadCostPerMi;

  const home = driverPoint(driver);
  if (home && prefs.goal === "home") {
    const distToHomeAfter = haversineMi(to.drop, home);
    const distToHomeBefore = haversineMi(from, home);
    if (distToHomeAfter < distToHomeBefore) score += 35;
  }

  if (prefs.goal === "empty") score -= deadhead * 2.5;
  if (prefs.goal === "rpm") {
    const total = deadhead + loaded;
    score = total > 0 ? (pay / total) * 100 - deadhead * 0.3 : -Infinity;
  }
  if (prefs.goal === "short") score -= loaded * 0.4;

  if (quality === "excellent") score += 15;
  else if (quality === "good") score += 8;
  else if (quality === "acceptable") score += 2;

  return score;
}

function scoreStartingJob(
  driver: LatLon,
  job: ScoredJob,
  prefs: RunBuilderPrefs,
): number {
  const deadhead = haversineMi(driver, job.pickup);
  // Soft penalty beyond range — don't hard-reject or sparse boards go blank
  const pay = jobPay(job.job);
  let score = pay - deadhead * prefs.deadheadCostPerMi;
  if (deadhead > prefs.maxEmptyMi + 40) {
    score -= (deadhead - prefs.maxEmptyMi) * 2;
  }
  if (prefs.goal === "rpm") {
    const total = deadhead + jobMiles(job);
    score = total > 0 ? (pay / total) * 100 : -Infinity;
  }
  return score;
}

function buildLegs(
  driver: JobsMapDriver | null,
  chain: ScoredJob[],
  emptyMiles: number,
): BidPlanLeg[] {
  const legs: BidPlanLeg[] = [
    {
      kind: "start",
      place: shortPlace(driver?.label) || "Start",
      pay: null,
    },
  ];

  let prevDrop: LatLon | null = driverPoint(driver);

  chain.forEach((sj, i) => {
    const pay = jobPay(sj.job) || null;
    const deadhead =
      prevDrop != null
        ? Math.round(haversineMi(prevDrop, sj.pickup))
        : undefined;

    if (deadhead != null && deadhead > 0 && i === 0) {
      legs.push({
        kind: "empty",
        place: shortPlace(sj.job.origin),
        miles: deadhead,
      });
    } else if (deadhead != null && deadhead > 0 && i > 0) {
      const prev = chain[i - 1]!;
      if (cityMatch(prev.job.destination, sj.job.origin)) {
        legs.push({
          kind: "handoff",
          place: shortPlace(sj.job.origin),
          pay: null,
          deliverPay: jobPay(prev.job) || null,
          pickupPay: pay,
          job: sj.job,
          jobIndex: i + 1,
        });
      } else {
        legs.push({
          kind: "empty",
          place: shortPlace(sj.job.origin),
          miles: deadhead,
        });
        legs.push({
          kind: "pickup",
          place: shortPlace(sj.job.origin),
          pay,
          job: sj.job,
          jobIndex: i + 1,
        });
      }
    } else if (i === 0 || !cityMatch(chain[i - 1]?.job.destination, sj.job.origin)) {
      legs.push({
        kind: "pickup",
        place: shortPlace(sj.job.origin),
        pay,
        job: sj.job,
        jobIndex: i + 1,
      });
    }

    legs.push({
      kind: i === chain.length - 1 ? "deliver" : "loaded",
      place: shortPlace(sj.job.destination),
      pay,
      job: sj.job,
      miles: jobMiles(sj),
      jobIndex: i + 1,
    });

    prevDrop = sj.drop;
  });

  return legs;
}

function greedyRunFromStart(
  start: ScoredJob,
  pool: ScoredJob[],
  driver: JobsMapDriver | null,
  prefs: RunBuilderPrefs,
  pickNext: (
    from: LatLon,
    remaining: ScoredJob[],
    prefs: RunBuilderPrefs,
  ) => ScoredJob | null,
): { chain: ScoredJob[]; emptyMiles: number; loadedMiles: number } {
  const chain: ScoredJob[] = [start];
  let emptyMiles = 0;
  let loadedMiles = jobMiles(start);
  let pos = start.drop;

  const dpt = driverPoint(driver);
  if (dpt) {
    emptyMiles += haversineMi(dpt, start.pickup);
  }

  while (chain.length < prefs.maxJobs) {
    const remaining = pool.filter(
      (j) => !chain.some((c) => c.job.id === j.job.id),
    );
    const next = pickNext(pos, remaining, prefs);
    if (!next) break;

    const dh = haversineMi(pos, next.pickup);
    emptyMiles += dh;
    loadedMiles += jobMiles(next);
    chain.push(next);
    pos = next.drop;
  }

  return { chain, emptyMiles: Math.round(emptyMiles), loadedMiles: Math.round(loadedMiles) };
}

function pickNextGreedy(
  from: LatLon,
  remaining: ScoredJob[],
  prefs: RunBuilderPrefs,
  driver: JobsMapDriver | null,
): ScoredJob | null {
  let best: ScoredJob | null = null;
  let bestScore = -Infinity;
  for (const j of remaining) {
    const s = scoreJobConnection(from, j, prefs, driver);
    if (s > bestScore) {
      bestScore = s;
      best = j;
    }
  }
  return bestScore > -Infinity ? best : null;
}

function pickNextMinEmpty(
  from: LatLon,
  remaining: ScoredJob[],
  prefs: RunBuilderPrefs,
): ScoredJob | null {
  let best: ScoredJob | null = null;
  let bestDh = Infinity;
  for (const j of remaining) {
    const dh = haversineMi(from, j.pickup);
    if (dh > prefs.maxEmptyMi) continue;
    if (dh < bestDh) {
      bestDh = dh;
      best = j;
    }
  }
  return best;
}

function pickNextMaxPay(
  from: LatLon,
  remaining: ScoredJob[],
  prefs: RunBuilderPrefs,
  driver: JobsMapDriver | null,
): ScoredJob | null {
  let best: ScoredJob | null = null;
  let bestPay = -1;
  for (const j of remaining) {
    const s = scoreJobConnection(from, j, prefs, driver);
    if (s <= -Infinity) continue;
    const pay = jobPay(j.job);
    if (pay > bestPay) {
      bestPay = pay;
      best = j;
    }
  }
  return best;
}

function toBidPlan(
  chain: ScoredJob[],
  emptyMiles: number,
  loadedMiles: number,
  label: string,
  goal: RunGoal,
  driver: JobsMapDriver | null,
): BidPlan {
  const jobs = chain.map((s) => s.job);
  const revenue = jobs.reduce((s, j) => s + jobPay(j), 0);
  const totalMiles = loadedMiles + emptyMiles;
  const revenuePerMile = totalMiles > 0 ? revenue / totalMiles : 0;
  const emptyPct = totalMiles > 0 ? (emptyMiles / totalMiles) * 100 : 0;

  const home = driverPoint(driver);
  const endsNearHome =
    Boolean(home) &&
    cityMatch(chain[chain.length - 1]?.job.destination, driver?.label);

  const avgDeadhead =
    chain.length > 1 ? emptyMiles / Math.max(chain.length - 1, 1) : emptyMiles;
  const geographicFit: BidPlan["geographicFit"] =
    avgDeadhead <= 15 ? "excellent" : avgDeadhead <= 35 ? "good" : "fair";

  const risks: string[] = ["All jobs must be won — chain breaks if you lose one"];
  if (emptyPct > 15) risks.push("Higher empty mileage than ideal");
  if (chain.length >= 4) risks.push("Multi-bid plan — consider backup jobs");

  return {
    id: `plan-${chain.map((c) => c.job.id).join("-")}`,
    label,
    goal,
    jobs,
    legs: buildLegs(driver, chain, emptyMiles),
    revenue,
    loadedMiles,
    emptyMiles,
    totalMiles,
    revenuePerMile,
    emptyPct,
    endsNearHome,
    risks,
    geographicFit,
  };
}

function runAreaLabel(chain: ScoredJob[]): string {
  const dest = shortPlace(chain[chain.length - 1]?.job.destination);
  const mid = shortPlace(chain[Math.floor(chain.length / 2)]?.job.destination);
  if (dest && mid && dest !== mid) return `${mid} loop`;
  return dest ? `${dest} run` : "Run";
}

function dedupePlans(plans: BidPlan[]): BidPlan[] {
  const seen = new Set<string>();
  return plans.filter((p) => {
    const key = p.jobs.map((j) => j.id).sort().join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Logistics-style run builder: score connections, greedy graph paths, multiple goals. */
export function buildBidPlans(
  jobs: MapJob[],
  driver: JobsMapDriver | null,
  prefs: RunBuilderPrefs = DEFAULT_RUN_PREFS,
): RunBuilderResult {
  const pool = toScoredJobs(jobs.filter((j) => j.status !== "skipped"));
  const totalJobs = pool.length;
  if (!pool.length) {
    return { plans: [], unpairedCount: 0, totalJobs: 0 };
  }

  // Search with a wider deadhead allowance so sparse Shiply boards still produce runs
  const searchPrefs: RunBuilderPrefs = {
    ...prefs,
    maxEmptyMi: Math.max(prefs.maxEmptyMi, 100),
  };

  const dpt = driverPoint(driver);
  const plans: BidPlan[] = [];

  let starts = dpt
    ? [...pool]
        .map((j) => ({ j, score: scoreStartingJob(dpt, j, searchPrefs) }))
        .filter((x) => x.score > -Infinity)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map((x) => x.j)
    : pool.slice(0, 12);

  // If start location filters everything out (driver far from board), still use best jobs
  if (!starts.length) {
    starts = [...pool]
      .sort((a, b) => jobPay(b.job) - jobPay(a.job))
      .slice(0, 12);
  }

  for (const start of starts) {
    const greedy = greedyRunFromStart(start, pool, driver, searchPrefs, (from, rem) =>
      pickNextGreedy(from, rem, searchPrefs, driver),
    );
    if (greedy.chain.length >= 2) {
      plans.push(
        toBidPlan(
          greedy.chain,
          greedy.emptyMiles,
          greedy.loadedMiles,
          runAreaLabel(greedy.chain),
          prefs.goal,
          driver,
        ),
      );
    }
  }

  // Goal-specific variants from best starts
  const topStarts = starts.slice(0, 6);
  for (const start of topStarts) {
    const minEmpty = greedyRunFromStart(start, pool, driver, searchPrefs, (from, rem) =>
      pickNextMinEmpty(from, rem, searchPrefs),
    );
    if (minEmpty.chain.length >= 2) {
      plans.push(
        toBidPlan(
          minEmpty.chain,
          minEmpty.emptyMiles,
          minEmpty.loadedMiles,
          "Lowest empty mileage",
          "empty",
          driver,
        ),
      );
    }

    const maxPay = greedyRunFromStart(start, pool, driver, searchPrefs, (from, rem) =>
      pickNextMaxPay(from, rem, searchPrefs, driver),
    );
    if (maxPay.chain.length >= 2) {
      plans.push(
        toBidPlan(
          maxPay.chain,
          maxPay.emptyMiles,
          maxPay.loadedMiles,
          "Highest revenue",
          "revenue",
          driver,
        ),
      );
    }

    const homePrefs = { ...searchPrefs, goal: "home" as RunGoal };
    const homeward = greedyRunFromStart(start, pool, driver, homePrefs, (from, rem) =>
      pickNextGreedy(from, rem, homePrefs, driver),
    );
    if (homeward.chain.length >= 2) {
      const plan = toBidPlan(
        homeward.chain,
        homeward.emptyMiles,
        homeward.loadedMiles,
        "Best round trip",
        "home",
        driver,
      );
      if (plan.endsNearHome || !dpt) plans.push(plan);
      else plans.push(plan); // still show — badge can note it
    }

    const shortPrefs = {
      ...searchPrefs,
      goal: "short" as RunGoal,
      maxJobs: Math.min(3, searchPrefs.maxJobs),
    };
    const short = greedyRunFromStart(start, pool, driver, shortPrefs, (from, rem) =>
      pickNextGreedy(from, rem, shortPrefs, driver),
    );
    if (short.chain.length >= 2 && short.emptyMiles + short.loadedMiles < 400) {
      plans.push(
        toBidPlan(
          short.chain,
          short.emptyMiles,
          short.loadedMiles,
          "Short day",
          "short",
          driver,
        ),
      );
    }
  }

  // Closest-pair fallback when geography is sparse
  if (plans.length < 2) {
    for (const start of starts.slice(0, 8)) {
      const nearest = pickNextMinEmpty(start.drop, pool.filter((j) => j.job.id !== start.job.id), {
        ...searchPrefs,
        maxEmptyMi: 200,
      });
      if (!nearest) continue;
      const dh = Math.round(haversineMi(start.drop, nearest.pickup));
      const dptEmpty = dpt ? Math.round(haversineMi(dpt, start.pickup)) : 0;
      plans.push(
        toBidPlan(
          [start, nearest],
          dptEmpty + dh,
          jobMiles(start) + jobMiles(nearest),
          runAreaLabel([start, nearest]),
          "empty",
          driver,
        ),
      );
    }
  }

  const unique = dedupePlans(plans);

  const rank = (p: BidPlan): number => {
    switch (p.goal) {
      case "revenue":
        return p.revenue;
      case "rpm":
        return p.revenuePerMile * 1000;
      case "empty":
        return -p.emptyMiles;
      case "home":
        return p.endsNearHome ? p.revenue + 500 : p.revenue * 0.5;
      case "short":
        return -p.totalMiles;
      default:
        return p.revenuePerMile;
    }
  };

  unique.sort((a, b) => rank(b) - rank(a));

  const picks: BidPlan[] = [];
  const goalOrder: RunGoal[] = ["rpm", "revenue", "empty", "home", "short"];
  for (const g of goalOrder) {
    const match = unique.find((p) => p.goal === g && p.jobs.length >= 2);
    if (match && !picks.some((x) => x.id === match.id)) picks.push(match);
  }
  for (const p of unique) {
    if (picks.length >= 6) break;
    if (p.jobs.length < 2) continue;
    if (!picks.some((x) => x.id === p.id)) picks.push(p);
  }

  // Last resort: top single jobs so the Runs screen is never blank when jobs exist
  if (!picks.length) {
    const top = [...pool]
      .sort((a, b) => jobPay(b.job) - jobPay(a.job))
      .slice(0, 3);
    for (const sj of top) {
      const empty = dpt ? Math.round(haversineMi(dpt, sj.pickup)) : 0;
      picks.push(
        toBidPlan(
          [sj],
          empty,
          jobMiles(sj),
          `${shortPlace(sj.job.origin)} → ${shortPlace(sj.job.destination)}`,
          "revenue",
          driver,
        ),
      );
    }
  }

  const usedIds = new Set(picks.flatMap((p) => p.jobs.map((j) => j.id)));
  const unpairedCount = pool.filter((s) => !usedIds.has(s.job.id)).length;

  return {
    plans: picks.slice(0, 6),
    unpairedCount,
    totalJobs,
  };
}

export function layoutBidPlanMap(
  plan: BidPlan,
  allJobs: MapJob[],
  driver: JobsMapDriver | null,
  width = 640,
  height = 420,
) {
  const pad = 48;
  const points: LatLon[] = [];
  const dpt = driverPoint(driver);
  if (dpt) points.push(dpt);

  for (const j of plan.jobs) {
    const o = resolveUkPlace(j.origin);
    const d = resolveUkPlace(j.destination);
    if (o) points.push(o);
    if (d) points.push(d);
  }

  if (!points.length) {
    return { width, height, driver: null, runPath: "", stops: [], faint: [] };
  }

  const bounds = boundsAround(points);

  const project = (ll: LatLon) =>
    projectLatLon(ll.lat, ll.lon, bounds, width, height, pad);

  const stops: Array<{ x: number; y: number; label: string; role: "you" | "stop" }> = [];
  if (dpt && driver?.label) {
    const p = project(dpt);
    stops.push({ x: p.x, y: p.y, label: shortPlace(driver.label), role: "you" });
  }

  const pathPts: { x: number; y: number }[] = [];
  if (dpt) pathPts.push(project(dpt));

  plan.jobs.forEach((j) => {
    const o = resolveUkPlace(j.origin);
    const d = resolveUkPlace(j.destination);
    if (o) {
      const p = project(o);
      pathPts.push(p);
      stops.push({ x: p.x, y: p.y, label: shortPlace(j.origin), role: "stop" });
    }
    if (d) {
      const p = project(d);
      pathPts.push(p);
      stops.push({
        x: p.x,
        y: p.y,
        label: shortPlace(j.destination),
        role: "stop",
      });
    }
  });

  let runPath = "";
  if (pathPts.length >= 2) {
    runPath = `M ${pathPts[0]!.x} ${pathPts[0]!.y}`;
    for (let i = 1; i < pathPts.length; i++) {
      const prev = pathPts[i - 1]!;
      const cur = pathPts[i]!;
      const mx = (prev.x + cur.x) / 2;
      const my = (prev.y + cur.y) / 2 + (i % 2 === 0 ? 12 : -12);
      runPath += ` Q ${mx} ${my} ${cur.x} ${cur.y}`;
    }
  }

  const planIds = new Set(plan.jobs.map((j) => j.id));
  const faint: Array<{ x: number; y: number }> = [];
  for (const j of allJobs) {
    if (planIds.has(j.id)) continue;
    const d = resolveUkPlace(j.destination);
    if (!d) continue;
    const p = project(d);
    faint.push({ x: p.x, y: p.y });
  }

  return {
    width,
    height,
    driver: dpt && driver?.label ? project(dpt) : null,
    runPath,
    stops,
    faint,
  };
}
