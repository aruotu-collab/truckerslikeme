"use client";

import { useMemo, useState } from "react";
import type { CorridorFocus } from "@/lib/intel/rank";
import type { LiveFeedItem } from "@/types";
import {
  STATE_MAP_POINTS,
  STATE_NAMES,
  countIntelByState,
  corridorStateSummary,
  type UsStateCode,
} from "@/lib/us-corridor-states";

type CorridorIntelMapProps = {
  corridor: CorridorFocus | null;
  items: LiveFeedItem[];
  onSelectState?: (state: UsStateCode | null) => void;
};

export function CorridorIntelMap({
  corridor,
  items,
  onSelectState,
}: CorridorIntelMapProps) {
  const [active, setActive] = useState<UsStateCode | null>(null);

  const haulStates = useMemo(
    () => corridorStateSummary(corridor),
    [corridor],
  );

  const counts = useMemo(
    () => countIntelByState(items, haulStates),
    [items, haulStates],
  );

  const totalOnHaul = haulStates.reduce(
    (sum, code) => sum + (counts[code] ?? 0),
    0,
  );

  const originState = haulStates[0] ?? null;
  const destState = haulStates[haulStates.length - 1] ?? null;

  function pick(state: UsStateCode) {
    const next = active === state ? null : state;
    setActive(next);
    onSelectState?.(next);
  }

  if (!corridor || haulStates.length === 0) {
    return (
      <div className="mt-8 border border-asphalt/10 bg-white px-4 py-5 sm:px-6">
        <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
          Corridor intel map
        </p>
        <p className="mt-2 text-asphalt">
          Search a route under Nearest Services → Along route to light up the
          states you&apos;re in and the states you&apos;re going.
        </p>
        <a
          href="/find?need=along"
          className="mt-4 inline-flex rounded-sm bg-amber px-4 py-2.5 text-sm font-semibold text-asphalt uppercase"
        >
          Along route
        </a>
      </div>
    );
  }

  return (
    <div className="mt-8 w-full min-w-0 max-w-full overflow-hidden border border-asphalt/10 bg-white">
      <div className="border-b border-asphalt/10 px-4 py-4 sm:px-6">
        <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
          States on your haul
        </p>
        <h3 className="mt-2 font-display text-2xl tracking-wide text-asphalt uppercase sm:text-3xl">
          Intel for where you are · what&apos;s ahead · where you&apos;re going
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Live intelligence for{" "}
          <span className="font-medium text-asphalt">
            {corridor.origin} → {corridor.destination}
          </span>
          . Highlighted states are on this corridor — not the whole country at
          once.
        </p>
        <p className="mt-2 text-sm text-asphalt">
          <span className="font-display text-amber">{totalOnHaul}</span> live
          signals across{" "}
          <span className="font-medium">{haulStates.join(" · ")}</span>
        </p>
      </div>

      {/* Journey strip */}
      <div className="flex gap-2 overflow-x-auto border-b border-asphalt/10 px-4 py-3 sm:px-6">
        {haulStates.map((code, index) => {
          const isOrigin = code === originState && index === 0;
          const isDest = code === destState && index === haulStates.length - 1;
          const selected = active === code;
          const count = counts[code] ?? 0;
          return (
            <button
              key={`${code}-${index}`}
              type="button"
              onClick={() => pick(code)}
              className={`shrink-0 border-l-2 px-3 py-2 text-left transition ${
                selected
                  ? "border-amber bg-amber/10"
                  : "border-asphalt/15 hover:border-amber/60"
              }`}
            >
              <p className="font-display text-lg text-asphalt">{code}</p>
              <p className="text-[10px] tracking-wide text-muted uppercase">
                {isOrigin
                  ? "You're in / start"
                  : isDest
                    ? "You're going"
                    : "Ahead on haul"}
              </p>
              <p className="mt-0.5 text-xs text-amber">
                {count} live {count === 1 ? "signal" : "signals"}
              </p>
            </button>
          );
        })}
      </div>

      {/* Simplified US map */}
      <div className="relative bg-[#edf1f4] px-2 py-4 sm:px-4">
        <svg
          viewBox="0 0 1000 620"
          className="mx-auto block h-auto w-full max-w-3xl"
          role="img"
          aria-label={`US map highlighting ${haulStates.join(", ")} on your corridor`}
        >
          <rect width="1000" height="620" fill="#edf1f4" />
          {/* Soft national frame */}
          <path
            d="M70 80 C 200 40, 400 30, 600 50 S 900 90, 920 180 S 900 400, 780 500 S 500 560, 280 520 S 80 380, 70 80 Z"
            fill="#dfe3e8"
            stroke="#c5ccd4"
            strokeWidth="2"
          />

          {/* Dim markers for non-haul states */}
          {(Object.keys(STATE_MAP_POINTS) as UsStateCode[]).map((code) => {
            const pt = STATE_MAP_POINTS[code];
            if (!pt || haulStates.includes(code)) return null;
            return (
              <circle
                key={`dim-${code}`}
                cx={pt.x}
                cy={pt.y}
                r="7"
                fill="#c5ccd4"
                opacity="0.45"
              />
            );
          })}

          {/* Corridor path through haul states */}
          {haulStates.length > 1 && (
            <polyline
              fill="none"
              stroke="#e09b1e"
              strokeWidth="4"
              strokeDasharray="10 8"
              strokeLinecap="round"
              opacity="0.85"
              points={haulStates
                .map((code) => {
                  const pt = STATE_MAP_POINTS[code];
                  return pt ? `${pt.x},${pt.y}` : "";
                })
                .filter(Boolean)
                .join(" ")}
            />
          )}

          {/* Haul state markers */}
          {haulStates.map((code, index) => {
            const pt = STATE_MAP_POINTS[code];
            if (!pt) return null;
            const selected = active === code;
            const count = counts[code] ?? 0;
            const isOrigin = index === 0;
            const isDest = index === haulStates.length - 1;
            return (
              <g
                key={`haul-${code}-${index}`}
                className="cursor-pointer"
                onClick={() => pick(code)}
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={selected ? 22 : 18}
                  fill={selected ? "#f0b429" : "#e09b1e"}
                  stroke="#1a1d23"
                  strokeWidth="2"
                />
                <text
                  x={pt.x}
                  y={pt.y + 4}
                  textAnchor="middle"
                  fill="#1a1d23"
                  fontSize="11"
                  fontWeight="700"
                >
                  {code}
                </text>
                <text
                  x={pt.x}
                  y={pt.y - 26}
                  textAnchor="middle"
                  fill="#1a1d23"
                  fontSize="11"
                  fontWeight="600"
                >
                  {count}
                </text>
                {(isOrigin || isDest) && (
                  <text
                    x={pt.x}
                    y={pt.y + 36}
                    textAnchor="middle"
                    fill="#5c6570"
                    fontSize="10"
                  >
                    {isOrigin ? "START" : "GOING"}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <p className="mt-2 px-2 text-center text-xs text-muted">
          Numbers on states = live intel signals for that state on your feed.
          Tap a state to focus the list below.
        </p>
      </div>

      {active && (
        <div className="border-t border-asphalt/10 bg-asphalt px-4 py-3 text-white sm:px-6">
          <p className="font-display text-xs tracking-[0.18em] text-amber uppercase">
            Focused · {STATE_NAMES[active]} ({active})
          </p>
          <p className="mt-1 text-sm text-chrome">
            Showing live intel for this state on your haul. Tap again to clear.
          </p>
        </div>
      )}
    </div>
  );
}
