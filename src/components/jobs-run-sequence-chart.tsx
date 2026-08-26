"use client";

import { useMemo } from "react";
import type { SequenceStep, SequenceTown } from "@/lib/jobs-run-sequence";

type Props = {
  towns: SequenceTown[];
  steps: SequenceStep[];
  formatMoney: (n: number) => string;
};

const COL_W = 72;
const LABEL_W = 118;
const ROW_H = 44;
const PAD_TOP = 56;
const PAD_LEFT = LABEL_W + 8;

function segmentPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  local: boolean,
) {
  if (local || Math.abs(x2 - x1) < 4) {
    const midY = (y1 + y2) / 2;
    const bump = 18;
    return `M ${x1} ${y1} Q ${x1 + bump} ${midY} ${x2} ${y2}`;
  }
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + (x2 > x1 ? -6 : 6);
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

export function JobsRunSequenceChart({ towns, steps, formatMoney }: Props) {
  const width = PAD_LEFT + towns.length * COL_W + 24;
  const height = PAD_TOP + steps.length * ROW_H + 36;

  const points = useMemo(
    () =>
      steps.map((step) => {
        const y = PAD_TOP + (step.index - 0.5) * ROW_H;
        const x1 = PAD_LEFT + step.fromCol * COL_W + COL_W / 2;
        const x2 = PAD_LEFT + step.toCol * COL_W + COL_W / 2;
        return { step, x1, x2, y };
      }),
    [steps],
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10 bg-[#0f172a]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[320px]"
        role="img"
        aria-label="Run sequence chart: blue loaded legs, red deadhead"
      >
        <defs>
          <marker
            id="deadhead-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="#f87171" />
          </marker>
        </defs>

        {towns.map((t, i) => {
          const x = PAD_LEFT + i * COL_W + COL_W / 2;
          return (
            <g key={t.key}>
              <line
                x1={x}
                y1={PAD_TOP - 8}
                x2={x}
                y2={height - 28}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
              <text
                x={x}
                y={28}
                textAnchor="middle"
                fill="#94a3b8"
                style={{ fontSize: 10, fontWeight: 600 }}
              >
                {t.label.length > 10 ? `${t.label.slice(0, 9)}…` : t.label}
              </text>
            </g>
          );
        })}

        {steps.map((step) => {
          const y = PAD_TOP + (step.index - 0.5) * ROW_H;
          return (
            <g key={`row-${step.index}`}>
              <text
                x={8}
                y={y + 4}
                fill="#64748b"
                style={{ fontSize: 9, fontWeight: 600 }}
              >
                {step.index}
              </text>
              <text x={22} y={y + 4} fill="#cbd5e1" style={{ fontSize: 9 }}>
                {step.label.length > 16
                  ? `${step.label.slice(0, 15)}…`
                  : step.label}
              </text>
              {towns.map((_, i) => (
                <circle
                  key={i}
                  cx={PAD_LEFT + i * COL_W + COL_W / 2}
                  cy={y}
                  r={2}
                  fill="rgba(148,163,184,0.25)"
                />
              ))}
            </g>
          );
        })}

        {points.map(({ step, x1, x2, y }) => {
          if (step.kind === "start") {
            return (
              <circle
                key={`seg-${step.index}`}
                cx={x1}
                cy={y}
                r={7}
                fill="#38bdf8"
                stroke="#fff"
                strokeWidth={2}
              />
            );
          }

          const isDeadhead = step.kind === "deadhead";
          const path = segmentPath(x1, y, x2, y, step.isLocal);

          return (
            <g key={`seg-${step.index}`}>
              <path
                d={path}
                fill="none"
                stroke={isDeadhead ? "#f87171" : "#3b82f6"}
                strokeWidth={isDeadhead ? 2.5 : 3.5}
                strokeDasharray={isDeadhead ? "6 4" : undefined}
                strokeLinecap="round"
                markerEnd={isDeadhead ? "url(#deadhead-arrow)" : undefined}
              />
              <circle
                cx={x1}
                cy={y}
                r={5}
                fill="#fff"
                stroke={isDeadhead ? "#f87171" : "#3b82f6"}
                strokeWidth={2}
              />
              <circle
                cx={x2}
                cy={y}
                r={5}
                fill="#fff"
                stroke={isDeadhead ? "#f87171" : "#3b82f6"}
                strokeWidth={2}
              />
              {(step.miles > 0 || step.pay != null) && (
                <text
                  x={(x1 + x2) / 2}
                  y={y - 10}
                  textAnchor="middle"
                  fill={isDeadhead ? "#fca5a5" : "#93c5fd"}
                  style={{ fontSize: 8, fontWeight: 600 }}
                >
                  {isDeadhead
                    ? `+${step.miles} mi`
                    : step.pay != null
                      ? formatMoney(step.pay)
                      : `${step.miles} mi`}
                </text>
              )}
            </g>
          );
        })}

        <g transform={`translate(${PAD_LEFT}, ${height - 18})`}>
          <line
            x1={0}
            y1={0}
            x2={28}
            y2={0}
            stroke="#3b82f6"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <text x={34} y={3} fill="#94a3b8" style={{ fontSize: 9 }}>
            Loaded (with job)
          </text>
          <line
            x1={140}
            y1={0}
            x2={168}
            y2={0}
            stroke="#f87171"
            strokeWidth={2.5}
            strokeDasharray="5 3"
            strokeLinecap="round"
          />
          <text x={174} y={3} fill="#94a3b8" style={{ fontSize: 9 }}>
            Deadhead (reposition)
          </text>
        </g>
      </svg>
    </div>
  );
}
