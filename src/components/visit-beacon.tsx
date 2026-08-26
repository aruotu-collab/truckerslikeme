"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuthGate } from "@/lib/auth-gate";

function readCountryCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)tlm_ip_country=([A-Z]{2})/);
  return match?.[1] ?? null;
}

/** Page visit beacon for admin traffic stats. */
export function VisitBeacon() {
  const pathname = usePathname();
  const { user } = useAuthGate();

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/api")) return;

    const key = `tlm-visit:${pathname}:${new Date().toDateString()}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // ignore
    }

    const country = readCountryCookie();
    const referrer =
      typeof document !== "undefined" && document.referrer
        ? document.referrer.slice(0, 500)
        : null;

    void fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        country,
        referrer,
        userId: user?.id ?? null,
      }),
      keepalive: true,
    });
  }, [pathname, user?.id]);

  return null;
}
