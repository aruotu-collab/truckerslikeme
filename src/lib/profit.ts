import type {
  EconomyUnit,
  FuelUnit,
  DistanceUnit,
} from "@/lib/market-defaults";

export type ProfitScore = "great" | "good" | "marginal" | "skip";

export type ProfitInputs = {
  miles: number;
  /** Total linehaul / quote for the load */
  rateTotal: number;
  dieselPrice: number;
  /**
   * Economy value: MPG when economyUnit=mpg,
   * or L/100km when economyUnit=l_per_100km.
   */
  economy: number;
  /** @deprecated prefer economy + economyUnit */
  mpg?: number;
  /** Non-fuel operating cost per mile (always in currency per mile) */
  costPerMile: number;
  tolls?: number;
  fuelUnit?: FuelUnit;
  economyUnit?: EconomyUnit;
  /** If km, `miles` input is treated as kilometres and converted */
  distanceUnit?: DistanceUnit;
};

export type ProfitResult = {
  miles: number;
  rateTotal: number;
  ratePerMile: number;
  fuelGallons: number;
  fuelLitres: number;
  fuelCost: number;
  operatingCost: number;
  tolls: number;
  totalCost: number;
  breakEvenRate: number;
  netProfit: number;
  netPerMile: number;
  afterFuelPerMile: number;
  hoursEstimate: number;
  netPerHour: number;
  score: ProfitScore;
  label: string;
  summary: string;
  assumptions: {
    fuelUnit: FuelUnit;
    economyUnit: EconomyUnit;
    distanceUnit: DistanceUnit;
    dieselPrice: number;
    economy: number;
    costPerMile: number;
  };
};

const AVG_MPH = 52;
const KM_PER_MILE = 1.60934;
const LITRES_PER_US_GALLON = 3.78541;

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

function fuelCostFromInputs(input: {
  miles: number;
  dieselPrice: number;
  economy: number;
  fuelUnit: FuelUnit;
  economyUnit: EconomyUnit;
}): { fuelCost: number; fuelGallons: number; fuelLitres: number } {
  const { miles, dieselPrice, economy, fuelUnit, economyUnit } = input;

  if (economyUnit === "l_per_100km" || fuelUnit === "litre") {
    const lPer100 = Math.max(2, economy);
    const km = miles * KM_PER_MILE;
    const litres = (lPer100 / 100) * km;
    const pricePerLitre =
      fuelUnit === "litre"
        ? dieselPrice
        : dieselPrice / LITRES_PER_US_GALLON;
    return {
      fuelCost: litres * pricePerLitre,
      fuelLitres: litres,
      fuelGallons: litres / LITRES_PER_US_GALLON,
    };
  }

  const mpg = Math.max(2, economy);
  const gallons = miles / mpg;
  return {
    fuelCost: gallons * dieselPrice,
    fuelGallons: gallons,
    fuelLitres: gallons * LITRES_PER_US_GALLON,
  };
}

export function analyzeProfit(input: ProfitInputs): ProfitResult {
  const distanceUnit = input.distanceUnit ?? "mi";
  const rawDistance = Math.max(0.1, input.miles);
  const miles =
    distanceUnit === "km" ? rawDistance / KM_PER_MILE : rawDistance;

  const fuelUnit = input.fuelUnit ?? "gallon";
  const economyUnit =
    input.economyUnit ??
    (fuelUnit === "litre" ? "l_per_100km" : "mpg");
  const economy = Math.max(
    0.5,
    input.economy ?? input.mpg ?? (economyUnit === "mpg" ? 6.5 : 9.5),
  );
  const diesel = Math.max(0.01, input.dieselPrice);
  const cpm = Math.max(0, input.costPerMile);
  const tolls = Math.max(0, input.tolls ?? 0);
  const rateTotal = Math.max(0, input.rateTotal);

  const { fuelCost, fuelGallons, fuelLitres } = fuelCostFromInputs({
    miles,
    dieselPrice: diesel,
    economy,
    fuelUnit,
    economyUnit,
  });

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
      ? `Strong load — about ${round2(netPerMile)}/mi after real costs.`
      : score === "good"
        ? `Workable — ${round2(netPerMile)}/mi true profit after fuel and costs.`
        : score === "marginal"
          ? `Barely covers costs at ${round2(netPerMile)}/mi net. Risk if delayed.`
          : `Likely a loser at ${round2(netPerMile)}/mi after costs. Walk away.`;

  return {
    miles: Math.round(miles * 10) / 10,
    rateTotal: round2(rateTotal),
    ratePerMile: round3(ratePerMile),
    fuelGallons: round2(fuelGallons),
    fuelLitres: round2(fuelLitres),
    fuelCost: round2(fuelCost),
    operatingCost: round2(operatingCost),
    tolls: round2(tolls),
    totalCost: round2(totalCost),
    breakEvenRate: round2(totalCost),
    netProfit: round2(netProfit),
    netPerMile: round3(netPerMile),
    afterFuelPerMile: round3(afterFuelPerMile),
    hoursEstimate: round2(hoursEstimate),
    netPerHour: round2(netPerHour),
    score,
    label,
    summary,
    assumptions: {
      fuelUnit,
      economyUnit,
      distanceUnit,
      dieselPrice: diesel,
      economy,
      costPerMile: cpm,
    },
  };
}
