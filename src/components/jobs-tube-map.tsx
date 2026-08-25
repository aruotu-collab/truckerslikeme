"use client";

import {
  layoutTubeMap,
  mapStatusMeta,
  type MapJob,
} from "@/lib/jobs-map";

type Props = {
  jobs: MapJob[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function JobsTubeMap({ jobs, selectedId, onSelect }: Props) {
  const { stations, lines } = layoutTubeMap(jobs);

  if (!stations.length) {
    return (
      <div className="flex min-h-[280px] items-center justify-center border border-dashed border-asphalt/20 bg-concrete/20 px-6 text-center text-sm text-muted">
        Scan Shiply results to draw your hunt map — origins left, deliveries
        right, coloured lines for each job.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-asphalt/10 bg-[#f7f5f0]">
      <svg
        viewBox="0 0 920 420"
        className="h-auto w-full min-w-[640px]"
        role="img"
        aria-label="Jobs tube map"
      >
        <defs>
          <filter id="station-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* soft guide rails */}
        <line
          x1="70"
          y1="30"
          x2="70"
          y2="390"
          stroke="#ddd8ce"
          strokeWidth="1"
          strokeDasharray="4 6"
        />
        <line
          x1="460"
          y1="30"
          x2="460"
          y2="390"
          stroke="#ddd8ce"
          strokeWidth="1"
          strokeDasharray="4 6"
        />
        <line
          x1="850"
          y1="30"
          x2="850"
          y2="390"
          stroke="#ddd8ce"
          strokeWidth="1"
          strokeDasharray="4 6"
        />
        <text x="70" y="22" textAnchor="middle" className="fill-muted text-[10px]">
          Collect
        </text>
        <text x="460" y="22" textAnchor="middle" className="fill-muted text-[10px]">
          Hub
        </text>
        <text x="850" y="22" textAnchor="middle" className="fill-muted text-[10px]">
          Deliver
        </text>

        {lines.map(({ job, path }) => {
          const meta = mapStatusMeta[job.status];
          const active = job.id === selectedId;
          return (
            <path
              key={job.id}
              d={path}
              fill="none"
              stroke={meta.line}
              strokeWidth={active ? 7 : job.status === "won" ? 5.5 : 4}
              strokeLinecap="round"
              strokeOpacity={active ? 1 : job.status === "skipped" ? 0.35 : 0.85}
              className="cursor-pointer transition-[stroke-width]"
              onClick={() => onSelect(job.id)}
            />
          );
        })}

        {stations.map((st) => (
          <g key={st.key} filter="url(#station-glow)">
            <circle
              cx={st.x}
              cy={st.y}
              r={11}
              fill="#f7f5f0"
              stroke="#1a1d23"
              strokeWidth={2.5}
            />
            <circle cx={st.x} cy={st.y} r={4} fill="#1a1d23" />
            <text
              x={st.x}
              y={st.y + 28}
              textAnchor="middle"
              className="fill-asphalt text-[11px] font-semibold"
            >
              {st.label.length > 14 ? `${st.label.slice(0, 13)}…` : st.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
