export type ProfitScore = "great" | "good" | "marginal" | "skip";

export type ProfitInputs = {
  miles: number;
  /** Total linehaul rate for the load */
  rateTotal: number;
  dieselPrice: number;
  mpg: number;
  /** Non-fuel operating cost per mile (truck payment, insurance, maint, etc.) */
  costPerMile: number;
  /** Optional toll estimate */
  tolls?: number;
};

export type ProfitResult = {
  miles: number;
  rateTotal: number;
  ratePerMile: number;
  fuelGallons: number;
  fuelCost: number;
  operatingCost: number;
  tolls: number;
  totalCost: number;
  netProfit: number;
  netPerMile: number;
  /** RPM after fuel only (common driver mental model) */
  afterFuelPerMile: number;
  hoursEstimate: number;
  netPerHour: number;
  score: ProfitScore;
  label: string;
  summary: string;
};

const AVG_MPH = 52;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

export function scoreFromNetPerMile(netPerMile: number): {
  score: ProfitScore;
  label: string;
} {
  if (netPerMile >= 1.25) return { score: "great", label: "Take it" };
  if (netPerMile >= 0.75) return { score: "good", label: "Solid" };
  if (netPerMile >= 0.25) return { score: "marginal", label: "Tight" };
  return { score: "skip", label: "Pass" };
}

export function analyzeProfit(input: ProfitInputs): ProfitResult {
  const miles = Math.max(1, input.miles);
  const mpg = Math.max(2, input.mpg);
  const diesel = Math.max(0.5, input.dieselPrice);
  const cpm = Math.max(0, input.costPerMile);
  const tolls = Math.max(0, input.tolls ?? 0);
  const rateTotal = Math.max(0, input.rateTotal);

  const fuelGallons = miles / mpg;
  const fuelCost = fuelGallons * diesel;
  const operatingCost = miles * cpm;
  const totalCost = fuelCost + operatingCost + tolls;
  const netProfit = rateTotal - totalCost;
  const ratePerMile = rateTotal / miles;
  const netPerMile = netProfit / miles;
  const afterFuelPerMile = (rateTotal - fuelCost) / miles;
  const hoursEstimate = miles / AVG_MPH;
  const netPerHour = hoursEstimate > 0 ? netProfit / hoursEstimate : 0;
  const { score, label } = scoreFromNetPerMile(netPerMile);

  const summary =
    score === "great"
      ? `Strong load — about $${round2(netPerMile)}/mi after real costs.`
      : score === "good"
        ? `Workable — $${round2(netPerMile)}/mi true profit after fuel and costs.`
        : score === "marginal"
          ? `Barely covers costs at $${round2(netPerMile)}/mi net. Risk if delayed.`
          : `Likely a loser at $${round2(netPerMile)}/mi after costs. Walk away.`;

  return {
    miles: Math.round(miles),
    rateTotal: round2(rateTotal),
    ratePerMile: round3(ratePerMile),
    fuelGallons: round2(fuelGallons),
    fuelCost: round2(fuelCost),
    operatingCost: round2(operatingCost),
    tolls: round2(tolls),
    totalCost: round2(totalCost),
    netProfit: round2(netProfit),
    netPerMile: round3(netPerMile),
    afterFuelPerMile: round3(afterFuelPerMile),
    hoursEstimate: round2(hoursEstimate),
    netPerHour: round2(netPerHour),
    score,
    label,
    summary,
  };
}
