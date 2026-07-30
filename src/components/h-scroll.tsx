"use client";

import type { ReactNode } from "react";

type HScrollProps = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  role?: "tablist" | "navigation" | "list";
};

/** Contained horizontal slider — does not widen or slide the page. */
export function HScroll({
  children,
  className = "",
  "aria-label": ariaLabel,
  role = "tablist",
}: HScrollProps) {
  return (
    <div className={`relative max-w-full min-w-0 overflow-x-clip ${className}`}>
      <div
        role={role}
        aria-label={ariaLabel}
        className="h-scroll flex max-w-full items-center gap-2 overflow-x-auto overscroll-x-contain pb-1"
        data-h-scroll
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
