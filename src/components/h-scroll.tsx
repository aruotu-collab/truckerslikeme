"use client";

import type { ReactNode } from "react";

type HScrollProps = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  role?: "tablist" | "navigation" | "list";
};

/** Horizontal snap slider for filter chips and mobile menus. */
export function HScroll({
  children,
  className = "",
  "aria-label": ariaLabel,
  role = "tablist",
}: HScrollProps) {
  return (
    <div className={`relative ${className}`}>
      <div
        role={role}
        aria-label={ariaLabel}
        className="h-scroll flex items-center gap-2 overflow-x-auto overscroll-x-contain scroll-smooth pb-1"
      >
        {children}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--h-scroll-fade,transparent)] to-transparent"
      />
    </div>
  );
}
