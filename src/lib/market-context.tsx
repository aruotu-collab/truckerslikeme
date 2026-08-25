"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_MARKET,
  formatMoney,
  inferCountryFromLocation,
  inferCountryFromNavigator,
  marketBadge,
  marketFromCountryCode,
  marketFromCurrency,
  readIpCountryCookie,
  readStoredMarket,
  writeStoredMarket,
  type DriverMarket,
} from "@/lib/market";

const LOCATION_KEY = "tlm_last_location";

type MarketContextValue = {
  market: DriverMarket;
  /** Set when location or currency has been detected/saved. */
  resolved: boolean;
  badge: string;
  setFromCountryCode: (code: string | null | undefined) => void;
  setFromCurrency: (currency: string | null | undefined) => void;
  money: (n: number) => string;
};

const MarketContext = createContext<MarketContextValue | null>(null);

function detectInitialMarket(): { market: DriverMarket; resolved: boolean } {
  if (typeof window === "undefined") {
    return { market: DEFAULT_MARKET, resolved: false };
  }

  const stored = readStoredMarket();
  if (stored) return { market: stored, resolved: true };

  const ip = readIpCountryCookie();
  if (ip) {
    const market = marketFromCountryCode(ip);
    writeStoredMarket(market);
    return { market, resolved: true };
  }

  try {
    const inferred = inferCountryFromLocation(
      localStorage.getItem(LOCATION_KEY),
    );
    if (inferred) {
      const market = marketFromCountryCode(inferred);
      writeStoredMarket(market);
      return { market, resolved: true };
    }
  } catch {
    /* ignore */
  }

  const locale = inferCountryFromNavigator();
  if (locale) {
    const market = marketFromCountryCode(locale);
    writeStoredMarket(market);
    return { market, resolved: true };
  }

  return { market: DEFAULT_MARKET, resolved: false };
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [market, setMarket] = useState<DriverMarket>(DEFAULT_MARKET);
  const [resolved, setResolved] = useState(false);

  const apply = useCallback((next: DriverMarket) => {
    setMarket(next);
    setResolved(true);
    writeStoredMarket(next);
  }, []);

  // Resolve on the client as soon as possible (locale / saved place / cookie)
  useEffect(() => {
    const initial = detectInitialMarket();
    if (initial.resolved) {
      setMarket(initial.market);
      setResolved(true);
      return;
    }

    let cancelled = false;
    fetch("/api/ip-country")
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json() as Promise<{ country?: string | null }>;
      })
      .then((d) => {
        if (cancelled || !d?.country) return;
        if (readStoredMarket()) return;
        apply(marketFromCountryCode(d.country));
      })
      .catch(() => {
        /* ignore */
      });

    return () => {
      cancelled = true;
    };
  }, [apply]);

  const setFromCountryCode = useCallback(
    (code: string | null | undefined) => {
      if (!code) return;
      apply(marketFromCountryCode(code));
    },
    [apply],
  );

  const setFromCurrency = useCallback(
    (currency: string | null | undefined) => {
      const next = marketFromCurrency(currency);
      if (next) apply(next);
    },
    [apply],
  );

  const value = useMemo<MarketContextValue>(
    () => ({
      market,
      resolved,
      badge: resolved ? marketBadge(market) : "",
      setFromCountryCode,
      setFromCurrency,
      money: (n: number) => formatMoney(n, market.currency),
    }),
    [market, resolved, setFromCountryCode, setFromCurrency],
  );

  return (
    <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
  );
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) {
    throw new Error("useMarket must be used within MarketProvider");
  }
  return ctx;
}
