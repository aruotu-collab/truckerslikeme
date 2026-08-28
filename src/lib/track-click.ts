"use client";

import { postAnalyticsBeacon } from "@/lib/analytics-beacon";

function readCountryCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)tlm_ip_country=([A-Z]{2})/);
  return match?.[1] ?? null;
}

export function trackClick(
  eventName: string,
  label: string,
  opts?: { path?: string; userId?: string | null },
) {
  if (typeof window === "undefined") return;

  const path = opts?.path ?? window.location.pathname;
  const country = readCountryCookie();
  const referrer =
    typeof document !== "undefined" && document.referrer
      ? document.referrer.slice(0, 500)
      : null;

  void postAnalyticsBeacon("/api/clicks", {
    event: eventName,
    label,
    path,
    country,
    referrer,
    userId: opts?.userId ?? null,
  });
}
