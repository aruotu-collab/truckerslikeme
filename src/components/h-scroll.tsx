"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type HScrollProps = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  role?: "tablist" | "navigation" | "list";
  hint?: string;
};

/** Contained horizontal slider with swipe fades — never widens the page. */
export function HScroll({
  children,
  className = "",
  "aria-label": ariaLabel,
  role = "tablist",
  hint = "Swipe for more →",
}: HScrollProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setCanLeft(el.scrollLeft > 4);
      setCanRight(max > 4 && el.scrollLeft < max - 4);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [children]);

  return (
    <div className={`relative w-full min-w-0 max-w-full ${className}`}>
      {(canLeft || canRight) && (
        <p className="mb-1 text-[10px] tracking-wide text-chrome/80 uppercase">
          {hint}
        </p>
      )}
      <div className="relative w-full min-w-0 max-w-full overflow-hidden">
        <div
          ref={scrollerRef}
          role={role}
          aria-label={ariaLabel}
          className="h-scroll flex w-full min-w-0 max-w-full items-center gap-3 overflow-x-auto overscroll-x-contain px-0.5 pb-2"
          data-h-scroll
        >
          {children}
          {/* Trailing space so last chip isn't flush-cut */}
          <span className="w-6 shrink-0" aria-hidden />
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
    </div>
  );
}
