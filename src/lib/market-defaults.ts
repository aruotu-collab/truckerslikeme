import type { DriverMarket } from "@/lib/market";

export type FuelUnit = "gallon" | "litre";
export type DistanceUnit = "mi" | "km";
export type EconomyUnit = "mpg" | "l_per_100km";

export type MarketOperatingDefaults = {
  countryCode: string;
  currency: string;
  distanceUnit: DistanceUnit;
  fuelUnit: FuelUnit;
  economyUnit: EconomyUnit;
  /** Diesel price in local currency per fuelUnit */
  dieselPrice: number;
  /** mpg OR L/100km depending on economyUnit */
  economy: number;
  /**
   * Non-fuel running cost in local currency per mile.
   * (km markets store an equivalent £/€ per mile for the engine,
   *  or we convert at analyze time from costPerKm.)
   */
  costPerMile: number;
  /** Optional native per-km cost for EU-style markets */
  costPerKm?: number;
  dieselLabel: string;
  economyLabel: string;
  cpmLabel: string;
  sourceNote: string;
};

/**
 * Starter defaults — fuel from typical public averages (GOV.UK / EIA / EC / NRCan).
 * Non-fuel CPM is a light van / O-O band; drivers should override on Check.
 */
const TABLE: Record<string, MarketOperatingDefaults> = {
  GB: {
    countryCode: "GB",
    currency: "GBP",
    distanceUnit: "mi",
    fuelUnit: "litre",
    economyUnit: "l_per_100km",
    dieselPrice: 1.52,
    economy: 9.5,
    costPerMile: 0.55,
    dieselLabel: "Diesel £/L",
    economyLabel: "L/100km",
    cpmLabel: "Other £/mi",
    sourceNote: "UK pump diesel (GOV.UK/RAC-style average) + light van CPM band",
  },
  US: {
    countryCode: "US",
    currency: "USD",
    distanceUnit: "mi",
    fuelUnit: "gallon",
    economyUnit: "mpg",
    dieselPrice: 3.85,
    economy: 6.5,
    costPerMile: 0.65,
    dieselLabel: "Diesel $/gal",
    economyLabel: "MPG",
    cpmLabel: "Other $/mi",
    sourceNote: "EIA on-highway diesel band + ATRI-style non-fuel CPM",
  },
  DE: {
    countryCode: "DE",
    currency: "EUR",
    distanceUnit: "km",
    fuelUnit: "litre",
    economyUnit: "l_per_100km",
    dieselPrice: 1.65,
    economy: 9.0,
    costPerMile: 0.7,
    costPerKm: 0.45,
    dieselLabel: "Diesel €/L",
    economyLabel: "L/100km",
    cpmLabel: "Other €/km",
    sourceNote: "EC Weekly Oil Bulletin-style diesel + BGL-ish running cost band",
  },
  CA: {
    countryCode: "CA",
    currency: "CAD",
    distanceUnit: "km",
    fuelUnit: "litre",
    economyUnit: "l_per_100km",
    dieselPrice: 1.75,
    economy: 9.5,
    costPerMile: 0.85,
    costPerKm: 0.55,
    dieselLabel: "Diesel C$/L",
    economyLabel: "L/100km",
    cpmLabel: "Other C$/km",
    sourceNote: "NRCan-style diesel + Canadian light commercial CPM band",
  },
  IE: {
    countryCode: "IE",
    currency: "EUR",
    distanceUnit: "mi",
    fuelUnit: "litre",
    economyUnit: "l_per_100km",
    dieselPrice: 1.58,
    economy: 9.5,
    costPerMile: 0.58,
    dieselLabel: "Diesel €/L",
    economyLabel: "L/100km",
    cpmLabel: "Other €/mi",
    sourceNote: "Ireland diesel average + light van CPM band",
  },
};

export function operatingDefaultsForMarket(
  market: Pick<DriverMarket, "countryCode"> | null | undefined,
): MarketOperatingDefaults {
  const code = market?.countryCode?.toUpperCase() || "US";
  if (TABLE[code]) return TABLE[code];
  // Eurozone-ish fallback
  if (["FR", "NL", "ES", "IT", "AT", "BE"].includes(code)) {
    return { ...TABLE.DE, countryCode: code };
  }
  return TABLE.US;
}
