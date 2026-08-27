"use client";

import { ShiplyLink } from "@/components/shiply-link";
import {
  layoutExploreMap,
  type DirectionId,
} from "@/lib/jobs-map-explore";
import { mapStatusMeta, type JobsMapDriver, type MapJob } from "@/lib/jobs-map";

type Props = {
  jobs: MapJob[];
  driver: JobsMapDriver | null;
  selectedDirection: DirectionId | null;
  selectedCityKey: string | null;
  selectedRouteId: string | null;
  onSelectDirection: (id: DirectionId | null) => void;
  onSelectCity: (key: string | null) => void;
  onSelectRoute: (id: string | null) => void;
  formatMoney: (n: number) => string;
};

export function JobsExploreMap({
  jobs,
  driver,
  selectedDirection,
  selectedCityKey,
  selectedRouteId,
  onSelectDirection,
  onSelectCity,
  onSelectRoute,
  formatMoney,
}: Props) {
  const layout = layoutExploreMap({
    jobs,
    driver,
    selectedDirection,
    selectedCityKey,
    selectedRouteId,
  });

  const activeLine =
    layout.lines.find((l) => l.id === selectedRouteId) ?? null;

  if (!jobs.length) {
    return (
      <div className="flex min-h-[360px] items-center justify-center border border-dashed border-asphalt/20 bg-[#edf1f4] px-6 text-center text-sm text-muted">
        Scan Shiply and add jobs — they&apos;ll appear as direction clusters
        around you. Tap a direction to explore without dozens of crossing lines.
      </div>
    );
  }

  const focused = Boolean(selectedDirection || selectedCityKey);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto border border-asphalt/10 bg-[#edf1f4]">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="h-auto w-full min-w-[320px]"
          role="img"
          aria-label="Jobs explore map"
        >
          {!focused && layout.driver && (
            <>
              {[
                { scale: 0.22, mi: 50 },
                { scale: 0.38, mi: 100 },
              ].map(({ scale, mi }) => (
                <circle
                  key={scale}
                  cx={layout.driver!.x}
                  cy={layout.driver!.y}
                  r={Math.min(layout.width, layout.height) * scale}
                  fill="none"
                  stroke="#c5ced6"
                  strokeWidth="1"
                  strokeDasharray="5 7"
                />
              ))}
              {layout.ringLabels.map((ring) => (
                <text
                  key={ring.label}
                  x={ring.x}
                  y={ring.y}
                  fill="#8a8478"
                  style={{ fontSize: 9, fontWeight: 600 }}
                >
                  {ring.label}
                </text>
              ))}
            </>
          )}

          {layout.lines.map((line) => {
            const active = line.id === selectedRouteId;
            return (
              <path
                key={line.id}
                d={line.path}
                fill="none"
                stroke={active ? "#c4a035" : "#3d6b8a"}
                strokeWidth={
                  active ? 5 : 2 + Math.min(line.jobCount, 4)
                }
                strokeLinecap="round"
                strokeOpacity={active ? 1 : 0.72}
                className="cursor-pointer"
                onClick={() =>
                  onSelectRoute(active ? null : line.id)
                }
              />
            );
          })}

          {layout.directions.map((d) => (
            <g
              key={d.id}
              className="cursor-pointer"
              onClick={() => {
                onSelectRoute(null);
                onSelectCity(null);
                onSelectDirection(
                  selectedDirection === d.id ? null : d.id,
                );
              }}
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
                strokeWidth={2}
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

          {layout.cities.map(({ cluster, x, y, r }) => (
            <g
              key={cluster.id}
              className="cursor-pointer"
              onClick={() => {
                onSelectRoute(null);
                onSelectCity(
                  selectedCityKey === cluster.destKey
                    ? null
                    : cluster.destKey,
                );
              }}
            >
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={
                  selectedCityKey === cluster.destKey
                    ? "#c4a035"
                    : "#2f6b4f"
                }
                fillOpacity={0.9}
                stroke="#1a1d23"
                strokeWidth={2}
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fill="white"
                style={{ fontSize: 11, fontWeight: 700 }}
              >
                {cluster.jobCount}
              </text>
              <text
                x={x}
                y={y + r + 14}
                textAnchor="middle"
                fill="#1a1d23"
                style={{ fontSize: 11, fontWeight: 600 }}
              >
                {cluster.label}
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

      {focused && (
        <p className="text-xs text-muted">
          {selectedCityKey
            ? "Tap a route line for jobs on that connection."
            : "Tap a city to drill into jobs."}{" "}
          <button
            type="button"
            className="font-medium text-amber"
            onClick={() => {
              onSelectDirection(null);
              onSelectCity(null);
              onSelectRoute(null);
            }}
          >
            ← All directions
          </button>
        </p>
      )}

      {activeLine && (
        <div className="border border-asphalt/10 bg-white px-4 py-3">
          <p className="font-medium text-asphalt">
            {activeLine.originLabel} → {activeLine.destLabel}
          </p>
          <p className="text-xs text-muted">
            {activeLine.jobCount} job{activeLine.jobCount === 1 ? "" : "s"} ·{" "}
            {formatMoney(activeLine.totalPay)}
          </p>
          <ul className="mt-2 space-y-1.5">
            {activeLine.jobs.map((j) => (
              <li
                key={j.id}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <span className="text-asphalt">
                  {j.item || "Job"}
                  {j.myBid != null
                    ? ` · ${formatMoney(j.myBid)}`
                    : " · No bid"}
                </span>
                <span
                  className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${mapStatusMeta[j.status].soft}`}
                >
                  {mapStatusMeta[j.status].label}
                </span>
                {j.href && (
                  <ShiplyLink
                    href={j.href}
                    className="text-xs font-semibold text-amber uppercase"
                  >
                    Shiply →
                  </ShiplyLink>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
