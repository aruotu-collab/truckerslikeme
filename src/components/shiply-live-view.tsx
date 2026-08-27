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

export function ShiplyLiveView({
  url,
  edgeToEdge = true,
  collapseSignal = null,
}: ShiplyLiveViewProps) {
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const src = liveViewSrc(url);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
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
      allow="clipboard-read; clipboard-write; fullscreen"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-asphalt">
        <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-2.5">
          <p className="font-display text-xs tracking-[0.14em] text-white uppercase">
            Shiply browser
          </p>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-sm bg-amber px-3 py-1.5 text-[11px] font-semibold tracking-wide text-asphalt uppercase"
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
            Session still running — show it again to search or re-scan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="rounded-sm bg-asphalt px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white uppercase"
          >
            Show browser
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
        <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
          {frame}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className={`shiply-live-shell border border-asphalt/15 bg-concrete/20 ${
          edgeToEdge ? "-mx-4 sm:mx-0" : ""
        }`}
      >
        <div className="h-[calc(100dvh-11.5rem)] min-h-[min(58dvh,520px)] sm:h-[min(78vh,820px)] sm:min-h-[560px]">
          {frame}
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
          className="font-semibold tracking-wide text-amber uppercase hover:text-asphalt sm:hidden"
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
