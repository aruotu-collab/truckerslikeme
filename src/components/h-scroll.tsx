"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type HScrollProps = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  role?: "tablist" | "navigation" | "list";
  hint?: string;
  /** Prev/next + range slider so long strips (e.g. corridor) stay reachable */
  controls?: boolean;
  /** Show a native thin scrollbar under the strip */
  showScrollbar?: boolean;
};

/** Contained horizontal slider with swipe fades — never widens the page. */
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
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollMax, setScrollMax] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const update = () => {
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      setCanLeft(el.scrollLeft > 4);
      setCanRight(max > 4 && el.scrollLeft < max - 4);
      setScrollLeft(el.scrollLeft);
      setScrollMax(max);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Recheck after images/fonts settle
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
    const step = Math.max(180, Math.round(el.clientWidth * 0.65));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  function jumpToEnd() {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  }

  function jumpToStart() {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: 0, behavior: "smooth" });
  }

  const overflow = scrollMax > 4;

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
            aria-label="Scroll corridor left"
            className="absolute top-1/2 left-0 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-sm border border-asphalt/15 bg-white text-asphalt shadow-sm transition hover:border-amber disabled:pointer-events-none disabled:opacity-30"
          >
            ←
          </button>
        )}
        {controls && overflow && (
          <button
            type="button"
            onClick={() => nudge(1)}
            disabled={!canRight}
            aria-label="Scroll corridor right"
            className="absolute top-1/2 right-0 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-sm border border-asphalt/15 bg-white text-asphalt shadow-sm transition hover:border-amber disabled:pointer-events-none disabled:opacity-30"
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
            controls && overflow ? "px-10" : ""
          }`}
          data-h-scroll
        >
          {children}
          {/* Trailing space so last station isn't flush-cut */}
          <span className="w-10 shrink-0" aria-hidden />
        </div>
        {canLeft && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[var(--h-scroll-fade,transparent)] to-transparent"
          />
        )}
        {canRight && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--h-scroll-fade,transparent)] to-transparent"
          />
        )}
      </div>

      {controls && overflow && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={jumpToStart}
            className="text-xs font-semibold tracking-wide text-amber uppercase transition hover:text-asphalt"
          >
            Pickup (A)
          </button>
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="sr-only">Scroll corridor</span>
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.round(scrollMax))}
              value={Math.round(scrollLeft)}
              onChange={(e) => {
                const el = scrollerRef.current;
                if (!el) return;
                el.scrollLeft = Number(e.target.value);
              }}
              className="h-2 w-full min-w-0 cursor-pointer accent-amber"
              aria-label="Scroll along the haul"
            />
          </label>
          <button
            type="button"
            onClick={jumpToEnd}
            className="text-xs font-semibold tracking-wide text-amber uppercase transition hover:text-asphalt"
          >
            Delivery (B) →
          </button>
        </div>
      )}
    </div>
  );
}
