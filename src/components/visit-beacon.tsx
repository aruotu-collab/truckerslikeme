"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Soft visit beacon for admin traffic stats (no PII). */
export function VisitBeacon() {
  const pathname = usePathname();

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

    void fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    });
  }, [pathname]);

  return null;
}
