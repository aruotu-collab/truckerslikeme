"use client";

import { useEffect, useState } from "react";

type ShiplyLiveViewProps = {
  url: string;
  /** Bleed to screen edges inside a padded mobile section */
  edgeToEdge?: boolean;
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
}: ShiplyLiveViewProps) {
  const [expanded, setExpanded] = useState(false);
  const src = liveViewSrc(url);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

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

  return (
    <div className="space-y-2">
      <div
        className={`shiply-live-shell border border-asphalt/15 bg-concrete/20 ${
          edgeToEdge ? "-mx-4 sm:mx-0" : ""
        }`}
      >
        {/* Tall on phones so remote Shiply can scroll; desktop stays roomy */}
        <div className="h-[calc(100dvh-11.5rem)] min-h-[min(58dvh,520px)] sm:h-[min(78vh,820px)] sm:min-h-[560px]">
          {frame}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
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
