"use client";

import { ShiplyLink } from "@/components/shiply-link";
import {
  DRIVER_STATION_KEY,
  layoutTubeMap,
  mapStatusMeta,
  placeKey,
  type JobsMapDriver,
  type MapJob,
} from "@/lib/jobs-map";

type Props = {
  jobs: MapJob[];
  driver: JobsMapDriver | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function JobsTubeMap({ jobs, driver, selectedId, onSelect }: Props) {
  const { stations, lines, deadheads, width, height } = layoutTubeMap(jobs, {
    driver,
    selectedJobId: selectedId,
  });

  if (!stations.length) {
    return (
      <div className="flex min-h-[320px] items-center justify-center border border-dashed border-asphalt/20 bg-[#f7f5f0] px-6 text-center text-sm text-muted">
        Set where you&apos;re starting, scan Shiply results, then add jobs —
        each line is a job from collect → deliver, like a tube map.
      </div>
    );
  }

  const selected = jobs.find((j) => j.id === selectedId);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto border border-asphalt/10 bg-[#f7f5f0]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[640px]"
          role="img"
          aria-label="Shiply jobs tube map"
        >
          <defs>
            <filter
              id="tube-glow"
              x="-40%"
              y="-40%"
              width="180%"
              height="180%"
            >
              <feDropShadow
                dx="0"
                dy="1"
                stdDeviation="1.5"
                floodOpacity="0.12"
              />
            </filter>
          </defs>

          {/* Vertical guide rails — collect / hub / deliver */}
          {[72, width / 2, width - 72].map((x, i) => (
            <g key={x}>
              <line
                x1={x}
                y1={40}
                x2={x}
                y2={height - 28}
                stroke="#ddd8ce"
                strokeWidth="1"
                strokeDasharray="4 6"
              />
              <text
                x={x}
                y={28}
                textAnchor="middle"
                fill="#8a8478"
                style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em" }}
              >
                {i === 0 ? "COLLECT" : i === 1 ? "HUB" : "DELIVER"}
              </text>
            </g>
          ))}

          {deadheads.map((d) => (
            <path
              key={`dh-${d.jobId}`}
              d={d.path}
              fill="none"
              stroke="#1a1d23"
              strokeWidth={selectedId === d.jobId ? 2.5 : 1.5}
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeOpacity={0.45}
            />
          ))}

          {lines.map(({ job, path }) => {
            const meta = mapStatusMeta[job.status];
            const active = job.id === selectedId;
            return (
              <g key={job.id}>
                <path
                  d={path}
                  fill="none"
                  stroke={meta.line}
                  strokeWidth={active ? 8 : job.status === "won" ? 6 : 4.5}
                  strokeLinecap="round"
                  strokeOpacity={
                    active ? 1 : job.status === "skipped" ? 0.25 : 0.9
                  }
                  className="cursor-pointer"
                  onClick={() => onSelect(job.id)}
                />
                {active && (
                  <title>
                    {job.origin} → {job.destination}
                    {job.myBid != null ? ` · £${job.myBid}` : ""}
                  </title>
                )}
              </g>
            );
          })}

          {stations.map((st) => {
            const isDriver =
              st.kind === "driver" ||
              (driver &&
                placeKey(driver.label) === st.key &&
                st.key !== DRIVER_STATION_KEY);
            const showYou = isDriver || st.key === DRIVER_STATION_KEY;
            return (
              <g key={`${st.key}-${st.x}`} filter="url(#tube-glow)">
                {showYou ? (
                  <>
                    <circle
                      cx={st.x}
                      cy={st.y}
                      r={15}
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
                      r={11}
                      fill="#f7f5f0"
                      stroke="#1a1d23"
                      strokeWidth={2.5}
                    />
                    <circle cx={st.x} cy={st.y} r={4} fill="#1a1d23" />
                  </>
                )}
                <text
                  x={st.x}
                  y={st.y + (showYou ? 30 : 26)}
                  textAnchor="middle"
                  fill="#1a1d23"
                  style={{ fontSize: 11, fontWeight: 600 }}
                >
                  {st.label.length > 14
                    ? `${st.label.slice(0, 13)}…`
                    : st.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {selected && (
        <div className="flex flex-wrap items-center gap-3 border border-asphalt/10 bg-white px-4 py-3 text-sm">
          <span className="font-medium text-asphalt">
            {selected.origin} → {selected.destination}
          </span>
          {selected.myBid != null && (
            <span className="text-muted">Your bid £{selected.myBid}</span>
          )}
          {selected.miles != null && (
            <span className="text-muted">{selected.miles} mi</span>
          )}
          <span
            className={`rounded-sm border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${mapStatusMeta[selected.status].soft}`}
          >
            {mapStatusMeta[selected.status].label}
          </span>
          {selected.href ? (
            <ShiplyLink
              href={selected.href}
              className="ml-auto rounded-sm bg-amber px-3 py-1.5 text-[11px] font-semibold tracking-wide text-asphalt uppercase"
            >
              Open on Shiply →
            </ShiplyLink>
          ) : (
            <span className="ml-auto text-xs text-muted">
              No Shiply link from scan
            </span>
          )}
        </div>
      )}
    </div>
  );
}
