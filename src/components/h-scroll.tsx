"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type HScrollProps = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  role?: "tablist" | "navigation" | "list";
  hint?: string;
  /** Side arrows when content overflows */
  controls?: boolean;
  /** Thin native scrollbar under the strip */
  showScrollbar?: boolean;
};

/** Contained horizontal scroller — never widens the page. */
export function HScroll({
  children,
  className = "",
  "aria-label": ariaLabel,
  role = "tablist",
  hint = "Swipe for more →",
  controls = false,
  showScrollbar = false,
}: HScrollProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const update = () => {
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      setOverflow(max > 4);
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

  function nudge(direction: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const step = Math.max(160, Math.round(el.clientWidth * 0.7));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  return (
    <div className={`relative w-full min-w-0 max-w-full ${className}`}>
      {(canLeft || canRight) && hint ? (
        <p className="mb-1 text-[10px] tracking-wide text-muted uppercase">
          {hint}
        </p>
      ) : null}

      <div className="relative w-full min-w-0 max-w-full overflow-hidden">
        {controls && overflow && (
          <button
            type="button"
            onClick={() => nudge(-1)}
            disabled={!canLeft}
            aria-label="Scroll left"
            className="absolute top-1/2 left-0 z-30 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-sm border border-asphalt/15 bg-white text-sm text-asphalt transition hover:border-amber disabled:pointer-events-none disabled:opacity-25"
          >
            ←
          </button>
        )}
        {controls && overflow && (
          <button
            type="button"
            onClick={() => nudge(1)}
            disabled={!canRight}
            aria-label="Scroll right"
            className="absolute top-1/2 right-0 z-30 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-sm border border-asphalt/15 bg-white text-sm text-asphalt transition hover:border-amber disabled:pointer-events-none disabled:opacity-25"
          >
            →
          </button>
        )}

        <div
          ref={scrollerRef}
          role={role}
          aria-label={ariaLabel}
          className={`${
            showScrollbar || controls ? "h-scroll-visible" : "h-scroll"
          } flex w-full min-w-0 max-w-full items-center gap-3 overflow-x-auto overscroll-x-contain px-0.5 pb-2 ${
            controls && overflow ? "px-9" : ""
          }`}
          data-h-scroll
        >
          {children}
          <span className="w-6 shrink-0" aria-hidden />
        </div>
        {canLeft && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[var(--h-scroll-fade,transparent)] to-transparent"
          />
        )}
        {canRight && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--h-scroll-fade,transparent)] to-transparent"
          />
        )}
      </div>
    </div>
  );
}
