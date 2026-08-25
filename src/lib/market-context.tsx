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
  marketBadge,
  marketFromCountryCode,
  marketFromCurrency,
  readStoredMarket,
  writeStoredMarket,
  type DriverMarket,
} from "@/lib/market";

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

  useEffect(() => {
    const stored = readStoredMarket();
    if (stored) {
      setMarket(stored);
      setResolved(true);
    }
  }, []);

  const apply = useCallback((next: DriverMarket) => {
    setMarket(next);
    setResolved(true);
    writeStoredMarket(next);
  }, []);

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
