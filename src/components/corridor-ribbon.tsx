"use client";

import { HScroll } from "@/components/h-scroll";
import {
  corridorKindLabel,
  corridorKindTone,
  type CorridorRibbonStop,
} from "@/lib/corridor-ribbon-shared";

type Props = {
  origin: string;
  destination: string;
  totalMiles?: number;
  stops: CorridorRibbonStop[];
  selectedId?: string | null;
  onSelectStop?: (id: string | null) => void;
  interactive?: boolean;
  hint?: string;
  footer?: string;
  /** Hide A/B pins when origin/destination are shown elsewhere (e.g. marketing card header). */
  hideEndpoints?: boolean;
  /** Show stop detail line (e.g. "M62 · truck parking westbound"). */
  showDetail?: boolean;
  density?: "default" | "comfortable";
};

export function CorridorRibbon({
  origin,
  destination,
  totalMiles,
  stops,
  selectedId,
  onSelectStop,
  interactive = false,
  hint = "Swipe for more stops",
  footer = "A and B stay put. Mid-haul fuel, parking, and repair slide between them.",
  hideEndpoints = false,
  showDetail = false,
  density = "default",
}: Props) {
  const deliveryMi = totalMiles && totalMiles > 0 ? Math.round(totalMiles) : null;
  const stopWidth =
    density === "comfortable"
      ? "w-[6.5rem] sm:w-36"
      : "w-[5rem] sm:w-28";
  const kindMinW =
    density === "comfortable"
      ? "min-w-[4.5rem] sm:min-w-[5rem]"
      : "min-w-[3.5rem] sm:min-w-[4rem]";

  const stopList = (
    <HScroll
      aria-label="Stops between pickup and delivery"
      role="list"
      hint={hint}
      showScrollbar
    >
      <div className="flex min-w-min items-start gap-0">
        {stops.map((stop, index) => {
          const selected = selectedId === stop.id;
          const inner = (
            <>
              <span
                className={`flex min-h-10 ${kindMinW} items-center justify-center rounded-sm px-1.5 py-1 text-[9px] font-bold leading-tight tracking-wide uppercase sm:text-[10px] ${
                  corridorKindTone[stop.kind]
                } ${selected ? "ring-2 ring-amber ring-offset-2" : ""}`}
              >
                {corridorKindLabel[stop.kind]}
              </span>
              <span
                className={`mt-2 line-clamp-2 px-0.5 font-medium leading-tight text-asphalt ${
                  density === "comfortable"
                    ? "text-[11px] sm:text-xs"
                    : "text-[10px] sm:text-[11px]"
                }`}
              >
                {stop.name}
              </span>
              {showDetail && stop.detail ? (
                <span className="mt-1 line-clamp-2 px-0.5 text-[10px] leading-snug text-muted">
                  {stop.detail}
                </span>
              ) : null}
              <span className="mt-1 font-display text-[10px] tracking-wide text-muted uppercase">
                mi {stop.mile}
                <span className="mx-1 text-asphalt/30">·</span>
                {corridorKindLabel[stop.kind]}
              </span>
            </>
          );

          return (
            <div key={stop.id} className="relative flex shrink-0 items-start">
              {index > 0 && (
                <div
                  className="mt-5 h-0.5 w-5 shrink-0 bg-asphalt/20 sm:w-8"
                  aria-hidden
                />
              )}
              {interactive && onSelectStop ? (
                <button
                  type="button"
                  onClick={() => onSelectStop(selected ? null : stop.id)}
                  className={`relative z-10 flex ${stopWidth} flex-col items-center text-center transition`}
                  title={`${stop.name} · mi ${stop.mile}`}
                >
                  {inner}
                </button>
              ) : (
                <div
                  className={`relative z-10 flex ${stopWidth} flex-col items-center text-center`}
                >
                  {inner}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </HScroll>
  );

  if (hideEndpoints) {
    return (
      <div className="[--h-scroll-fade:#ffffff] px-3 py-5 sm:px-5">
        {stops.length > 0 ? (
          stopList
        ) : (
          <div className="flex h-10 items-center justify-center border border-dashed border-asphalt/15 px-3 text-center text-xs text-muted">
            Stops appear here between pickup and delivery
          </div>
        )}
        {stops.length > 0 && footer && (
          <p className="mt-3 text-xs text-muted">{footer}</p>
        )}
      </div>
    );
  }

  return (
    <div className="[--h-scroll-fade:#ffffff] px-3 py-5 sm:px-5">
      <div className="flex items-start gap-1 sm:gap-2">
        <div className="relative z-20 flex w-[4.5rem] shrink-0 flex-col items-center text-center sm:w-[5.5rem]">
          <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-emerald-700 text-xs font-bold tracking-wide text-white">
            A
          </span>
          <span className="mt-2 line-clamp-3 px-0.5 text-[10px] font-semibold leading-tight tracking-wide text-asphalt uppercase sm:text-[11px]">
            {origin}
          </span>
          <span className="mt-1 text-[10px] text-muted">Pickup · mi 0</span>
        </div>

        <div className="mt-5 h-0.5 w-2 shrink-0 bg-asphalt/20 sm:w-3" aria-hidden />

        <div className="min-w-0 flex-1">
          {stops.length > 0 ? (
            stopList
          ) : (
            <div className="flex h-10 items-center justify-center border border-dashed border-asphalt/15 px-3 text-center text-xs text-muted">
              Stops appear here between A and B
            </div>
          )}
        </div>

        <div className="mt-5 h-0.5 w-2 shrink-0 bg-asphalt/20 sm:w-3" aria-hidden />

        <div className="relative z-20 flex w-[4.5rem] shrink-0 flex-col items-center text-center sm:w-[5.5rem]">
          <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-alert text-xs font-bold tracking-wide text-white">
            B
          </span>
          <span className="mt-2 line-clamp-3 px-0.5 text-[10px] font-semibold leading-tight tracking-wide text-asphalt uppercase sm:text-[11px]">
            {destination}
          </span>
          <span className="mt-1 text-[10px] text-muted">
            Delivery{deliveryMi != null ? ` · mi ${deliveryMi}` : ""}
          </span>
        </div>
      </div>
      {stops.length > 0 && footer && (
        <p className="mt-3 text-xs text-muted">{footer}</p>
      )}
    </div>
  );
}
