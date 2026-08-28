"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type HScrollProps = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  role?: "tablist" | "navigation" | "list";
  hint?: string;
  /** @deprecated Arrow controls removed — swipe only. Kept so callers compile. */
  controls?: boolean;
  /** Thin native scrollbar under the strip */
  showScrollbar?: boolean;
  /** Soft edge fades when more content is off-screen (default true) */
  fades?: boolean;
};

/** Contained horizontal scroller — never widens the page. Swipe only, no arrow buttons. */
export function HScroll({
  children,
  className = "",
  "aria-label": ariaLabel,
  role = "tablist",
  hint = "Swipe for more →",
  showScrollbar = false,
  fades = true,
}: HScrollProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const update = () => {
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      setCanLeft(el.scrollLeft > 4);
      setCanRight(max > 4 && el.scrollLeft < max - 4);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const t = window.setTimeout(update, 120);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [children]);

  return (
    <div className={`relative w-full min-w-0 max-w-full ${className}`}>
      {(canLeft || canRight) && hint ? (
        <p className="mb-1 text-[10px] tracking-wide text-muted uppercase">
          {hint}
        </p>
      ) : null}

      <div className="relative w-full min-w-0 max-w-full overflow-hidden">
        <div
          ref={scrollerRef}
          role={role}
          aria-label={ariaLabel}
          className={`${
            showScrollbar ? "h-scroll-visible" : "h-scroll"
          } flex w-full min-w-0 max-w-full items-center gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2 sm:gap-3`}
          data-h-scroll
        >
          <span className="w-1 shrink-0 sm:w-2" aria-hidden />
          {children}
          <span className="w-6 shrink-0 sm:w-8" aria-hidden />
        </div>
        {fades && canLeft && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-[var(--h-scroll-fade,transparent)] to-transparent sm:w-8"
          />
        )}
        {fades && canRight && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-[var(--h-scroll-fade,transparent)] to-transparent sm:w-8"
          />
        )}
      </div>
    </div>
  );
}
