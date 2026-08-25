"use client";

import {
  DRIVER_STATION_KEY,
  layoutTubeMap,
  mapStatusMeta,
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
  const { stations, lines, deadheads, unresolved, width, height } =
    layoutTubeMap(jobs, {
      driver,
      selectedJobId: selectedId,
    });

  if (!stations.length) {
    return (
      <div className="flex min-h-[280px] items-center justify-center border border-dashed border-asphalt/20 bg-concrete/20 px-6 text-center text-sm text-muted">
        Set your start location, then scan Shiply results — places plot on a UK
        map so you can see distance from where you are.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto border border-asphalt/10 bg-[#edf1f4]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[320px] max-w-full"
          role="img"
          aria-label="UK jobs map"
        >
          <defs>
            <filter
              id="station-glow"
              x="-40%"
              y="-40%"
              width="180%"
              height="180%"
            >
              <feDropShadow
                dx="0"
                dy="1"
                stdDeviation="1.5"
                floodOpacity="0.15"
              />
            </filter>
          </defs>

          {/* Soft UK frame hint */}
          <rect
            x="12"
            y="12"
            width={width - 24}
            height={height - 24}
            fill="none"
            stroke="#c5ced6"
            strokeWidth="1"
            strokeDasharray="6 8"
            rx="4"
          />
          <text
            x={24}
            y={36}
            fill="#6b7280"
            style={{ fontSize: 11, fontWeight: 600 }}
          >
            UK · geographic layout
          </text>

          {deadheads.map((d) => (
            <path
              key={`dh-${d.jobId}`}
              d={d.path}
              fill="none"
              stroke="#c4a035"
              strokeWidth={selectedId === d.jobId ? 3 : 1.75}
              strokeDasharray="6 5"
              strokeLinecap="round"
              strokeOpacity={selectedId && selectedId !== d.jobId ? 0.25 : 0.7}
            />
          ))}

          {lines.map(({ job, path }) => {
            const meta = mapStatusMeta[job.status];
            const active = job.id === selectedId;
            return (
              <path
                key={job.id}
                d={path}
                fill="none"
                stroke={meta.line}
                strokeWidth={active ? 6 : job.status === "won" ? 4.5 : 3.25}
                strokeLinecap="round"
                strokeOpacity={
                  active ? 1 : job.status === "skipped" ? 0.3 : 0.88
                }
                className="cursor-pointer"
                onClick={() => onSelect(job.id)}
              />
            );
          })}

          {stations.map((st) => {
            const isDriver = st.key === DRIVER_STATION_KEY;
            return (
              <g key={st.key} filter="url(#station-glow)">
                {isDriver ? (
                  <>
                    <circle
                      cx={st.x}
                      cy={st.y}
                      r={14}
                      fill="#f5c518"
                      stroke="#1a1d23"
                      strokeWidth={2.5}
                    />
                    <text
                      x={st.x}
                      y={st.y + 4}
                      textAnchor="middle"
                      fill="#1a1d23"
                      style={{ fontSize: 9, fontWeight: 700 }}
                    >
                      YOU
                    </text>
                  </>
                ) : (
                  <>
                    <circle
                      cx={st.x}
                      cy={st.y}
                      r={st.placed ? 10 : 7}
                      fill={st.placed ? "#f7f5f0" : "#e8e4dc"}
                      stroke="#1a1d23"
                      strokeWidth={st.placed ? 2.5 : 1.5}
                      strokeDasharray={st.placed ? undefined : "3 2"}
                    />
                    <circle
                      cx={st.x}
                      cy={st.y}
                      r={3.5}
                      fill="#1a1d23"
                      opacity={st.placed ? 1 : 0.4}
                    />
                  </>
                )}
                <text
                  x={st.x}
                  y={st.y + (isDriver ? 28 : 24)}
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
      {unresolved.length > 0 && (
        <p className="text-xs text-muted">
          Couldn’t place on the UK map (shown dashed):{" "}
          {unresolved.slice(0, 8).join(", ")}
          {unresolved.length > 8 ? "…" : ""}
        </p>
      )}
    </div>
  );
}
