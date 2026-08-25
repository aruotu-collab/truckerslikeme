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

export function MarketProvider({ children }: { children: ReactNode }) {
  const [market, setMarket] = useState<DriverMarket>(DEFAULT_MARKET);
  const [resolved, setResolved] = useState(false);

  const apply = useCallback((next: DriverMarket) => {
    setMarket(next);
    setResolved(true);
    writeStoredMarket(next);
  }, []);

  useEffect(() => {
    const stored = readStoredMarket();
    if (stored) {
      setMarket(stored);
      setResolved(true);
      return;
    }

    const fromIpCookie = readIpCountryCookie();
    if (fromIpCookie) {
      apply(marketFromCountryCode(fromIpCookie));
      return;
    }

    try {
      const savedPlace = localStorage.getItem(LOCATION_KEY);
      const inferred = inferCountryFromLocation(savedPlace);
      if (inferred) {
        apply(marketFromCountryCode(inferred));
        return;
      }
    } catch {
      /* ignore */
    }

    // Fallback: ask the server (reads Vercel IP country header)
    let cancelled = false;
    fetch("/api/geo")
      .then((r) => r.json())
      .then((d: { country?: string | null }) => {
        if (cancelled || !d.country) return;
        // Don't overwrite if something else resolved meanwhile
        const again = readStoredMarket();
        if (again) return;
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
