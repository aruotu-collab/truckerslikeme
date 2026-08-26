import { analyzeProfit, type ProfitScore } from "@/lib/profit";

export type JobDecisionInputs = {
  /** Loaded (paid) miles */
  loadedMiles: number;
  /** Empty miles to reach pickup */
  deadheadMiles: number;
  /** Customer quote / your bid */
  quote: number;
  /** Shiply success fee % (default 13%) or flat fee */
  shiplyFeePct?: number;
  shiplyFeeFlat?: number;
  dieselPrice: number;
  economy: number;
  costPerMile: number;
  fuelUnit?: "gallon" | "litre";
  economyUnit?: "mpg" | "l_per_100km";
};

export type JobDecision = {
  customerQuote: number;
  shiplyFee: number;
  netToDriver: number;
  totalMiles: number;
  loadedMiles: number;
  deadheadMiles: number;
  fuelCost: number;
  operatingCost: number;
  totalCost: number;
  estimatedNet: number;
  netPerMile: number;
  netPerHour: number;
  hoursEstimate: number;
  score: ProfitScore;
  label: string;
  summary: string;
  verdict: "strong" | "ok" | "weak" | "avoid";
  quality: number;
};

export type QuoteSuggestion = {
  suggested: number;
  floor: number;
  atSuggested: JobDecision;
  atFloor: JobDecision;
  note: string;
};

function shiplyFeeFrom(quote: number, pct?: number, flat?: number) {
  if (flat != null && flat > 0) return Math.round(flat * 100) / 100;
  const p = pct ?? 0.13;
  return Math.round(quote * p * 100) / 100;
}

export function evaluateJob(input: JobDecisionInputs): JobDecision {
  const loaded = Math.max(1, input.loadedMiles);
  const deadhead = Math.max(0, input.deadheadMiles);
  const totalMiles = loaded + deadhead;
  const quote = Math.max(0, input.quote);
  const fee = shiplyFeeFrom(quote, input.shiplyFeePct, input.shiplyFeeFlat);
  const netToDriver = Math.max(0, quote - fee);

  const profit = analyzeProfit({
    miles: totalMiles,
    rateTotal: netToDriver,
    dieselPrice: input.dieselPrice,
    economy: input.economy,
    costPerMile: input.costPerMile,
    fuelUnit: input.fuelUnit,
    economyUnit: input.economyUnit,
  });

  const quality = Math.max(
    0,
    Math.min(
      100,
      Math.round(40 + profit.netPerMile * 35 + (profit.netPerHour / 50) * 25),
    ),
  );

  let verdict: JobDecision["verdict"] = "ok";
  if (profit.score === "great" && quality >= 75) verdict = "strong";
  else if (profit.score === "skip" || quality < 40) verdict = "avoid";
  else if (profit.score === "marginal" || quality < 55) verdict = "weak";

  return {
    customerQuote: Math.round(quote * 100) / 100,
    shiplyFee: fee,
    netToDriver: Math.round(netToDriver * 100) / 100,
    totalMiles: Math.round(totalMiles * 10) / 10,
    loadedMiles: Math.round(loaded * 10) / 10,
    deadheadMiles: Math.round(deadhead * 10) / 10,
    fuelCost: profit.fuelCost,
    operatingCost: profit.operatingCost,
    totalCost: profit.totalCost,
    estimatedNet: profit.netProfit,
    netPerMile: profit.netPerMile,
    netPerHour: profit.netPerHour,
    hoursEstimate: profit.hoursEstimate,
    score: profit.score,
    label: profit.label,
    summary: profit.summary,
    verdict,
    quality,
  };
}

/** Suggest a quote targeting ~£1/mi net after fee & costs. */
export function suggestQuote(
  input: Omit<JobDecisionInputs, "quote">,
): QuoteSuggestion {
  const loaded = Math.max(1, input.loadedMiles);
  const deadhead = Math.max(0, input.deadheadMiles);
  const totalMiles = loaded + deadhead;
  const feePct = input.shiplyFeePct ?? 0.13;

  const costProbe = analyzeProfit({
    miles: totalMiles,
    rateTotal: 0,
    dieselPrice: input.dieselPrice,
    economy: input.economy,
    costPerMile: input.costPerMile,
    fuelUnit: input.fuelUnit,
    economyUnit: input.economyUnit,
  });
  const tripCost = costProbe.totalCost;

  const targetNet = totalMiles * 1.0;
  const floorNet = totalMiles * 0.55;
  const denom = Math.max(0.5, 1 - feePct);
  const suggested = Math.ceil((targetNet + tripCost) / denom / 5) * 5;
  const floor = Math.ceil((floorNet + tripCost) / denom / 5) * 5;

  return {
    suggested,
    floor,
    atSuggested: evaluateJob({ ...input, quote: suggested }),
    atFloor: evaluateJob({ ...input, quote: floor }),
    note: `Don't go below £${floor} unless this positions you for a strong backload.`,
  };
}

export function verdictCopy(v: JobDecision["verdict"]): {
  title: string;
  tone: string;
} {
  switch (v) {
    case "strong":
      return {
        title: "Strong job",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
      };
    case "ok":
      return {
        title: "Workable",
        tone: "border-amber/30 bg-amber/10 text-asphalt",
      };
    case "weak":
      return {
        title: "Tight — only with a backload",
        tone: "border-amber/40 bg-amber/15 text-amber-950",
      };
    default:
      return {
        title: "Avoid alone",
        tone: "border-red-200 bg-red-50 text-alert",
      };
  }
}
