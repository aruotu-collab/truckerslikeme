"use client";

import { useEffect, useState } from "react";
import { JobBidField } from "@/components/job-bid-field";
import { ShiplyLink } from "@/components/shiply-link";
import {
  DEFAULT_HUNT_MAP_GRID_STEP,
  HUNT_MAP_GRID_STEPS,
  HUNT_MAP_GRID_STORAGE_KEY,
  jobsForExploreSelection,
  layoutExploreMap,
  parseHuntMapGridStep,
  type DirectionId,
  type HuntMapGridStep,
} from "@/lib/jobs-map-explore";
import {
  mapStatusMeta,
  shortPlace,
  type JobsMapDriver,
  type MapJob,
} from "@/lib/jobs-map";

type Props = {
  jobs: MapJob[];
  driver: JobsMapDriver | null;
  selectedDirection: DirectionId | null;
  onSelectDirection: (id: DirectionId | null) => void;
  formatMoney: (n: number) => string;
  onSetBid?: (jobId: string, myBid: number | null) => void;
};

function bracketTicks(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size = 4,
) {
  const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1);
  if (vertical) {
    return [
      { x1: x1 - size, y1, x2: x1 + size, y2: y1 },
      { x1: x2 - size, y1: y2, x2: x2 + size, y2: y2 },
    ];
  }
  return [
    { x1, y1: y1 - size, x2: x1, y2: y1 + size },
    { x1: x2, y1: y2 - size, x2: x2, y2: y2 + size },
  ];
}

export function JobsExploreMap({
  jobs,
  driver,
  selectedDirection,
  onSelectDirection,
  formatMoney,
  onSetBid,
}: Props) {
  const [gridStepMi, setGridStepMi] = useState<HuntMapGridStep>(
    DEFAULT_HUNT_MAP_GRID_STEP,
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HUNT_MAP_GRID_STORAGE_KEY);
      if (stored) setGridStepMi(parseHuntMapGridStep(stored));
    } catch {
      /* ignore */
    }
  }, []);

  const setGridStep = (step: HuntMapGridStep) => {
    setGridStepMi(step);
    try {
      localStorage.setItem(HUNT_MAP_GRID_STORAGE_KEY, String(step));
    } catch {
      /* ignore */
    }
  };

  const layout = layoutExploreMap({
    jobs,
    driver,
    gridStepMi,
  });

  const selection = jobsForExploreSelection(jobs, driver, selectedDirection);

  if (!jobs.length) {
    return (
      <div className="flex min-h-[360px] items-center justify-center border border-dashed border-asphalt/20 bg-[#edf1f4] px-6 text-center text-sm text-muted">
        Scan Shiply and add jobs — they&apos;ll appear as direction clusters
        around you. Tap a direction to see jobs without changing the map.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-asphalt/10 bg-white px-3 py-2">
        <p className="text-xs text-muted">Grid spacing</p>
        <div className="flex flex-wrap gap-1">
          {HUNT_MAP_GRID_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => setGridStep(step)}
              className={`rounded-sm border px-2 py-1 text-[11px] font-semibold ${
                gridStepMi === step
                  ? "border-amber bg-amber/15 text-asphalt"
                  : "border-asphalt/15 text-muted hover:border-asphalt/30"
              }`}
            >
              {step} mi
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto border border-asphalt/10 bg-[#edf1f4]">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="h-auto w-full min-w-[320px]"
          role="img"
          aria-label="Jobs explore map"
        >
          <defs>
            <marker
              id="hunt-axis-arrow"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="#9aa3ad" />
            </marker>
          </defs>

          {layout.grid && layout.driver && (
            <g aria-hidden>
              <line
                x1={layout.grid.axisX.x1}
                y1={layout.grid.axisX.y1}
                x2={layout.grid.axisX.x2}
                y2={layout.grid.axisX.y2}
                stroke="#b0bcc8"
                strokeWidth="1.25"
                markerStart="url(#hunt-axis-arrow)"
                markerEnd="url(#hunt-axis-arrow)"
              />
              <line
                x1={layout.grid.axisY.x1}
                y1={layout.grid.axisY.y1}
                x2={layout.grid.axisY.x2}
                y2={layout.grid.axisY.y2}
                stroke="#b0bcc8"
                strokeWidth="1.25"
                markerStart="url(#hunt-axis-arrow)"
                markerEnd="url(#hunt-axis-arrow)"
              />
              {layout.grid.lines.map((line, i) => (
                <line
                  key={`grid-${line.axis}-${i}`}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke="#d0d8e0"
                  strokeWidth="0.75"
                  strokeOpacity={0.85}
                />
              ))}
              {layout.grid.labels.map((label) => (
                <text
                  key={`${label.text}-${label.x}-${label.y}`}
                  x={label.x}
                  y={label.y}
                  textAnchor={label.anchor}
                  fill="#9aa3ad"
                  style={{ fontSize: 8, fontWeight: 500 }}
                >
                  {label.text}
                </text>
              ))}
              {layout.grid.axisTips.map((tip) => (
                <text
                  key={`tip-${tip.text}`}
                  x={tip.x}
                  y={tip.y}
                  fill="#8a939e"
                  style={{ fontSize: 9, fontWeight: 700 }}
                >
                  {tip.text}
                </text>
              ))}
              {layout.grid.scaleBracket && (
                <g>
                  <line
                    x1={layout.grid.scaleBracket.x1}
                    y1={layout.grid.scaleBracket.y1}
                    x2={layout.grid.scaleBracket.x2}
                    y2={layout.grid.scaleBracket.y2}
                    stroke="#9aa3ad"
                    strokeWidth="1"
                  />
                  {bracketTicks(
                    layout.grid.scaleBracket.x1,
                    layout.grid.scaleBracket.y1,
                    layout.grid.scaleBracket.x2,
                    layout.grid.scaleBracket.y2,
                  ).map((tick, i) => (
                    <line
                      key={`tick-${i}`}
                      x1={tick.x1}
                      y1={tick.y1}
                      x2={tick.x2}
                      y2={tick.y2}
                      stroke="#9aa3ad"
                      strokeWidth="1"
                    />
                  ))}
                  <text
                    x={layout.grid.scaleBracket.labelX}
                    y={layout.grid.scaleBracket.labelY}
                    textAnchor="middle"
                    fill="#8a939e"
                    style={{ fontSize: 8, fontWeight: 600 }}
                  >
                    {layout.grid.scaleBracket.label}
                  </text>
                </g>
              )}
            </g>
          )}

          {layout.directions.map((d) => (
            <g
              key={d.id}
              className="cursor-pointer"
              onClick={() =>
                onSelectDirection(selectedDirection === d.id ? null : d.id)
              }
            >
              <circle
                cx={d.x}
                cy={d.y}
                r={d.r}
                fill={
                  selectedDirection === d.id ? "#c4a035" : "#3d6b8a"
                }
                fillOpacity={0.88}
                stroke="#1a1d23"
                strokeWidth={selectedDirection === d.id ? 3 : 2}
              />
              <text
                x={d.x}
                y={d.y - 2}
                textAnchor="middle"
                fill="white"
                style={{ fontSize: 12, fontWeight: 700 }}
              >
                {d.jobCount}
              </text>
              <text
                x={d.x}
                y={d.y + d.r + 14}
                textAnchor="middle"
                fill="#1a1d23"
                style={{ fontSize: 10, fontWeight: 600 }}
              >
                {d.label}
              </text>
              <text
                x={d.x}
                y={d.y + d.r + 26}
                textAnchor="middle"
                fill="#6b7280"
                style={{ fontSize: 9 }}
              >
                {formatMoney(d.totalPay)}
              </text>
            </g>
          ))}

          {layout.driver && (
            <g>
              <circle
                cx={layout.driver.x}
                cy={layout.driver.y}
                r={18}
                fill="#f5c518"
                stroke="#1a1d23"
                strokeWidth={2.5}
              />
              <text
                x={layout.driver.x}
                y={layout.driver.y + 4}
                textAnchor="middle"
                fill="#1a1d23"
                style={{ fontSize: 8, fontWeight: 800 }}
              >
                YOU
              </text>
              <text
                x={layout.driver.x}
                y={layout.driver.y + 32}
                textAnchor="middle"
                fill="#1a1d23"
                style={{ fontSize: 10, fontWeight: 600 }}
              >
                {layout.driver.label}
              </text>
            </g>
          )}
        </svg>
      </div>

      {selection ? (
        <div className="border border-asphalt/10 bg-white px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium text-asphalt">{selection.title}</p>
              <p className="text-xs text-muted">
                {selection.jobs.length} job
                {selection.jobs.length === 1 ? "" : "s"} ·{" "}
                {formatMoney(selection.totalPay)}
              </p>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-amber"
              onClick={() => onSelectDirection(null)}
            >
              Clear
            </button>
          </div>
          <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto">
            {selection.jobs.map((j) => (
              <li
                key={j.id}
                className="flex flex-col gap-2 border border-asphalt/10 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-asphalt">{j.item || "Job"}</p>
                  <p className="text-xs text-muted">
                    {shortPlace(j.origin)} → {shortPlace(j.destination)}
                    {j.miles != null ? ` · ~${j.miles} mi` : ""}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${mapStatusMeta[j.status].soft}`}
                >
                  {mapStatusMeta[j.status].label}
                </span>
                {onSetBid ? (
                  <JobBidField
                    compact
                    value={j.myBid}
                    miles={j.miles}
                    onChange={(myBid) => onSetBid(j.id, myBid)}
                  />
                ) : (
                  <span className="text-xs text-muted">
                    {j.myBid != null ? formatMoney(j.myBid) : "No bid"}
                  </span>
                )}
                {j.href && <ShiplyLink href={j.href} size="sm" />}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted">
          Tap a direction circle to list jobs — the map stays as-is.
        </p>
      )}
    </div>
  );
}
