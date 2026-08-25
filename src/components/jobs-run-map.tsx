"use client";

import { layoutBidPlanMap, type BidPlan } from "@/lib/jobs-run-builder";
import type { JobsMapDriver, MapJob } from "@/lib/jobs-map";

type Props = {
  plan: BidPlan;
  allJobs: MapJob[];
  driver: JobsMapDriver | null;
};

export function JobsRunMap({ plan, allJobs, driver }: Props) {
  const layout = layoutBidPlanMap(plan, allJobs, driver);

  return (
    <div className="overflow-x-auto border border-asphalt/10 bg-[#edf1f4]">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-auto w-full min-w-[320px]"
        role="img"
        aria-label="Selected bid plan map"
      >
        {layout.faint.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={3}
            fill="#9aa5b1"
            opacity={0.35}
          />
        ))}

        {layout.runPath && (
          <path
            d={layout.runPath}
            fill="none"
            stroke="#2f6b4f"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {layout.stops.map((st, i) => (
          <g key={`${st.label}-${i}`}>
            {st.role === "you" ? (
              <>
                <circle
                  cx={st.x}
                  cy={st.y}
                  r={16}
                  fill="#f5c518"
                  stroke="#1a1d23"
                  strokeWidth={2.5}
                />
                <text
                  x={st.x}
                  y={st.y + 4}
                  textAnchor="middle"
                  fill="#1a1d23"
                  style={{ fontSize: 8, fontWeight: 800 }}
                >
                  YOU
                </text>
              </>
            ) : (
              <>
                <circle
                  cx={st.x}
                  cy={st.y}
                  r={9}
                  fill="#fff"
                  stroke="#2f6b4f"
                  strokeWidth={2.5}
                />
                <circle cx={st.x} cy={st.y} r={3.5} fill="#2f6b4f" />
              </>
            )}
            <text
              x={st.x}
              y={st.y + (st.role === "you" ? 28 : 22)}
              textAnchor="middle"
              fill="#1a1d23"
              style={{ fontSize: 10, fontWeight: 600 }}
            >
              {st.label.length > 12 ? `${st.label.slice(0, 11)}…` : st.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="border-t border-asphalt/10 px-3 py-2 text-[11px] text-muted">
        Green path = this bid plan · faint dots = other jobs not in this run
      </p>
    </div>
  );
}
