export const MARKET_KEY = "tlm_market";

export type DriverMarket = {
  countryCode: string;
  countryLabel: string;
  currency: string;
};

const BY_COUNTRY: Record<string, DriverMarket> = {
  GB: { countryCode: "GB", countryLabel: "UK", currency: "GBP" },
  UK: { countryCode: "GB", countryLabel: "UK", currency: "GBP" },
  US: { countryCode: "US", countryLabel: "US", currency: "USD" },
  IE: { countryCode: "IE", countryLabel: "Ireland", currency: "EUR" },
  CA: { countryCode: "CA", countryLabel: "Canada", currency: "CAD" },
  AU: { countryCode: "AU", countryLabel: "Australia", currency: "AUD" },
  NZ: { countryCode: "NZ", countryLabel: "New Zealand", currency: "NZD" },
  DE: { countryCode: "DE", countryLabel: "Germany", currency: "EUR" },
  FR: { countryCode: "FR", countryLabel: "France", currency: "EUR" },
  NL: { countryCode: "NL", countryLabel: "Netherlands", currency: "EUR" },
  ES: { countryCode: "ES", countryLabel: "Spain", currency: "EUR" },
  IT: { countryCode: "IT", countryLabel: "Italy", currency: "EUR" },
  PL: { countryCode: "PL", countryLabel: "Poland", currency: "PLN" },
  MX: { countryCode: "MX", countryLabel: "Mexico", currency: "MXN" },
};

const BY_CURRENCY: Record<string, DriverMarket> = {
  GBP: BY_COUNTRY.GB,
  USD: BY_COUNTRY.US,
  EUR: BY_COUNTRY.IE,
  CAD: BY_COUNTRY.CA,
  AUD: BY_COUNTRY.AU,
  NZD: BY_COUNTRY.NZ,
  PLN: BY_COUNTRY.PL,
  MXN: BY_COUNTRY.MX,
};

export const DEFAULT_MARKET: DriverMarket = BY_COUNTRY.US;

export function marketFromCountryCode(
  code: string | null | undefined,
): DriverMarket {
  if (!code) return DEFAULT_MARKET;
  const key = code.trim().toUpperCase();
  return BY_COUNTRY[key] ?? {
    countryCode: key,
    countryLabel: key,
    currency: "USD",
  };
}

export function marketFromCurrency(
  currency: string | null | undefined,
): DriverMarket | null {
  if (!currency) return null;
  return BY_CURRENCY[currency.trim().toUpperCase()] ?? null;
}

export function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

export function formatMoney(n: number, currency: string): string {
  try {
    return n.toLocaleString(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function marketBadge(market: DriverMarket): string {
  return `${market.countryLabel} · ${currencySymbol(market.currency)}`;
}

export function readStoredMarket(): DriverMarket | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MARKET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DriverMarket>;
    if (!parsed.countryCode || !parsed.currency) return null;
    return {
      countryCode: parsed.countryCode,
      countryLabel: parsed.countryLabel || parsed.countryCode,
      currency: parsed.currency,
    };
  } catch {
    return null;
  }
}

export function writeStoredMarket(market: DriverMarket) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MARKET_KEY, JSON.stringify(market));
  } catch {
    /* ignore */
  }
}
