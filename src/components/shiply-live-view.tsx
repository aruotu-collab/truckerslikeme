"use client";

import { useEffect, useState } from "react";

type ShiplyLiveViewProps = {
  url: string;
  /** Bleed to screen edges inside a padded mobile section */
  edgeToEdge?: boolean;
  /**
   * When this value changes to a new non-empty string (e.g. after a scan),
   * collapse the frame so the board is easier to use.
   */
  collapseSignal?: string | null;
};

function liveViewSrc(url: string) {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("navbar")) u.searchParams.set("navbar", "false");
    return u.toString();
  } catch {
    return url;
  }
}

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 640px)").matches;
}

export function ShiplyLiveView({
  url,
  edgeToEdge = true,
  collapseSignal = null,
}: ShiplyLiveViewProps) {
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const src = liveViewSrc(url);

  // Mobile: open fullscreen by default — embedded iframes often drop taps
  useEffect(() => {
    if (isMobileViewport()) setExpanded(true);
  }, [url]);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "auto";
    return () => {
      document.body.style.overflow = prev;
      document.body.style.touchAction = prevTouch;
    };
  }, [expanded]);

  useEffect(() => {
    if (!collapseSignal) return;
    setExpanded(false);
    setCollapsed(true);
  }, [collapseSignal]);

  const frame = (
    <iframe
      title="Shiply browser session"
      src={src}
      className="shiply-live-frame block h-full w-full max-w-full bg-white"
      allow="clipboard-read; clipboard-write; fullscreen; pointer-lock"
      referrerPolicy="no-referrer-when-downgrade"
      // iOS: allow the frame to take the gesture stream
      style={{ touchAction: "auto", pointerEvents: "auto" }}
    />
  );

  if (expanded) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col bg-asphalt"
        data-shiply-live
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <p className="font-display text-xs tracking-[0.14em] text-white uppercase">
              Shiply browser
            </p>
            <p className="mt-0.5 text-[11px] text-white/60">
              Tap inside to scroll and click — then Done to scan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="shrink-0 rounded-sm bg-amber px-3 py-1.5 text-[11px] font-semibold tracking-wide text-asphalt uppercase"
          >
            Done
          </button>
        </div>
        <div className="shiply-live-shell min-h-0 flex-1 bg-white">{frame}</div>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div
        className={`relative flex flex-wrap items-center justify-between gap-3 border border-asphalt/15 bg-concrete/30 px-3 py-2.5 ${
          edgeToEdge ? "-mx-4 sm:mx-0" : ""
        }`}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-asphalt uppercase">
            Shiply browser collapsed
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Collapsed after scan — expand to search Shiply again.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setCollapsed(false);
              if (isMobileViewport()) setExpanded(true);
            }}
            className="rounded-sm bg-asphalt px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white uppercase"
          >
            Expand browser
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="rounded-sm border border-asphalt/20 bg-white px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase sm:hidden"
          >
            Inline view
          </button>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="rounded-sm border border-asphalt/20 bg-white px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase"
          >
            Full size →
          </a>
        </div>
        {/* Keep iframe mounted so the cloud session stays alive */}
        <div
          className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
          aria-hidden
        >
          {frame}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-shiply-live>
      <div
        className={`shiply-live-shell border border-asphalt/15 bg-concrete/20 ${
          edgeToEdge ? "-mx-4 sm:mx-0" : ""
        }`}
      >
        <div className="relative h-[calc(100dvh-11.5rem)] min-h-[min(58dvh,520px)] sm:h-[min(78vh,820px)] sm:min-h-[560px]">
          {frame}
          {/* Mobile tap target — inline iframe often ignores touch; push fullscreen */}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-2 bg-asphalt/85 px-3 py-3 text-[11px] font-semibold tracking-wide text-white uppercase sm:hidden"
          >
            Tap here for full-screen Shiply (easier taps) →
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="font-semibold tracking-wide text-asphalt uppercase hover:text-amber"
        >
          Collapse browser
        </button>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="font-semibold tracking-wide text-amber uppercase hover:text-asphalt"
        >
          Expand browser →
        </button>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-amber hover:text-asphalt"
        >
          Open browser full size →
        </a>
      </div>
    </div>
  );
}
