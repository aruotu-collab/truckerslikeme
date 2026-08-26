"use client";

import { useId, useMemo } from "react";
import type { RunSequence } from "@/lib/jobs-run-sequence";

type Props = {
  sequence: RunSequence;
};

const COL_W = 64;
const ROW_H = 48;
const PAD_TOP = 44;
const PAD_LEFT = 36;
const PAD_BOTTOM = 40;
const PAD_RIGHT = 16;

export function JobsRunSequenceChart({ sequence }: Props) {
  const uid = useId().replace(/:/g, "");
  const { towns, stops } = sequence;

  const width = PAD_LEFT + towns.length * COL_W + PAD_RIGHT;
  const height = PAD_TOP + stops.length * ROW_H + PAD_BOTTOM;

  const nodes = useMemo(
    () =>
      stops.map((stop) => ({
        stop,
        x: PAD_LEFT + stop.col * COL_W + COL_W / 2,
        y: PAD_TOP + (stop.index - 0.5) * ROW_H,
      })),
    [stops],
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0b1220]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[300px]"
        role="img"
        aria-label="Run sequence: blue loaded legs, red deadhead"
      >
        <defs>
          <marker
            id={`dh-arrow-${uid}`}
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
          >
            <path d="M0,0 L7,3.5 L0,7 Z" fill="#f87171" />
          </marker>
        </defs>

        {/* Column headers */}
        {towns.map((t, i) => {
          const x = PAD_LEFT + i * COL_W + COL_W / 2;
          return (
            <text
              key={t.key}
              x={x}
              y={22}
              textAnchor="middle"
              fill="#94a3b8"
              style={{ fontSize: 11, fontWeight: 600 }}
            >
              {t.label.length > 9 ? `${t.label.slice(0, 8)}…` : t.label}
            </text>
          );
        })}

        {/* Grid dots */}
        {stops.map((stop) => {
          const y = PAD_TOP + (stop.index - 0.5) * ROW_H;
          return (
            <g key={`grid-${stop.index}`}>
              <text
                x={14}
                y={y + 4}
                textAnchor="middle"
                fill="#64748b"
                style={{ fontSize: 11, fontWeight: 600 }}
              >
                {stop.index}
              </text>
              {towns.map((_, i) => (
                <circle
                  key={i}
                  cx={PAD_LEFT + i * COL_W + COL_W / 2}
                  cy={y}
                  r={2.5}
                  fill="rgba(148,163,184,0.22)"
                />
              ))}
            </g>
          );
        })}

        {/* Edges between consecutive stops */}
        {nodes.map((node, i) => {
          if (i === 0) return null;
          const prev = nodes[i - 1]!;
          const isDeadhead = node.stop.arriveBy === "deadhead";
          const x1 = prev.x;
          const y1 = prev.y;
          const x2 = node.x;
          const y2 = node.y;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;

          // Slight curve so overlapping columns still read
          const curve =
            Math.abs(x2 - x1) < 4
              ? `M ${x1} ${y1} C ${x1 + 22} ${y1 + 8}, ${x2 + 22} ${y2 - 8}, ${x2} ${y2}`
              : `M ${x1} ${y1} Q ${mx} ${my + (x2 > x1 ? -10 : 10)} ${x2} ${y2}`;

          return (
            <path
              key={`edge-${node.stop.index}`}
              d={curve}
              fill="none"
              stroke={isDeadhead ? "#f87171" : "#3b82f6"}
              strokeWidth={isDeadhead ? 2.5 : 3.5}
              strokeDasharray={isDeadhead ? "7 5" : undefined}
              strokeLinecap="round"
              markerEnd={
                isDeadhead ? `url(#dh-arrow-${uid})` : undefined
              }
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(({ stop, x, y }) => {
          const isStart = stop.role === "start";
          const isDeadheadArrive = stop.arriveBy === "deadhead";

          if (isStart) {
            return (
              <circle
                key={`node-${stop.index}`}
                cx={x}
                cy={y}
                r={8}
                fill="#38bdf8"
                stroke="#e2e8f0"
                strokeWidth={2}
              />
            );
          }

          if (isDeadheadArrive && stop.role === "pickup") {
            return (
              <g key={`node-${stop.index}`}>
                <rect
                  x={x - 7}
                  y={y - 7}
                  width={14}
                  height={14}
                  rx={2}
                  fill="#f87171"
                  stroke="#fecaca"
                  strokeWidth={1.5}
                  transform={`rotate(45 ${x} ${y})`}
                />
              </g>
            );
          }

          return (
            <circle
              key={`node-${stop.index}`}
              cx={x}
              cy={y}
              r={7}
              fill="#0b1220"
              stroke={
                stop.role === "pickup" || stop.role === "handoff"
                  ? "#f87171"
                  : "#3b82f6"
              }
              strokeWidth={2.5}
            />
          );
        })}

        {/* Legend */}
        <g transform={`translate(${PAD_LEFT}, ${height - 16})`}>
          <line
            x1={0}
            y1={0}
            x2={26}
            y2={0}
            stroke="#3b82f6"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <text x={32} y={3} fill="#94a3b8" style={{ fontSize: 10 }}>
            Loaded (with job)
          </text>
          <line
            x1={148}
            y1={0}
            x2={174}
            y2={0}
            stroke="#f87171"
            strokeWidth={2.5}
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
          <text x={180} y={3} fill="#94a3b8" style={{ fontSize: 10 }}>
            Deadhead (reposition)
          </text>
        </g>
      </svg>
    </div>
  );
}
