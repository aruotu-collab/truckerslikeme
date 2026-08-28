"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { postAnalyticsBeacon } from "@/lib/analytics-beacon";

function readCountryCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)tlm_ip_country=([A-Z]{2})/);
  return match?.[1] ?? null;
}

function visitDedupeKey(pathname: string): string {
  return `tlm-visit:${pathname}:${new Date().toDateString()}`;
}

function wasVisitRecorded(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markVisitRecorded(key: string): void {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // private mode / storage blocked — skip dedupe persistence
  }
}

/** Page visit beacon for admin traffic stats (desktop + mobile). */
export function VisitBeacon() {
  const pathname = usePathname();
  const inflight = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/api")) return;

    const key = visitDedupeKey(pathname);
    if (wasVisitRecorded(key)) return;
    if (inflight.current === key) return;
    inflight.current = key;

    const country = readCountryCookie();
    const referrer =
      typeof document !== "undefined" && document.referrer
        ? document.referrer.slice(0, 500)
        : null;

    const payload = { path: pathname, country, referrer };

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    async function record(attempt: number) {
      const ok = await postAnalyticsBeacon("/api/visits", payload);
      if (cancelled) return;

      if (ok) {
        markVisitRecorded(key);
        inflight.current = null;
        return;
      }

      // Mobile networks / background tabs — retry once before giving up.
      if (attempt < 1) {
        retryTimer = setTimeout(() => void record(attempt + 1), 2000);
        return;
      }

      inflight.current = null;
    }

    void record(0);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [pathname]);

  return null;
}
