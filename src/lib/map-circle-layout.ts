/** Layout helpers for the Hunt explore map — non-overlapping bubbles + mile grid. */

export type LayoutCircle = {
  id: string;
  x: number;
  y: number;
  r: number;
  anchorX: number;
  anchorY: number;
};

export type MileGridLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  axis: "x" | "y";
};

export type MileGridLabel = {
  x: number;
  y: number;
  text: string;
  anchor: "start" | "middle" | "end";
};

export type MileGrid = {
  lines: MileGridLine[];
  labels: MileGridLabel[];
  axisX: { x1: number; y1: number; x2: number; y2: number };
  axisY: { x1: number; y1: number; x2: number; y2: number };
};

const LABEL_PAD = 32;

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(bx - ax, by - ay);
}

/**
 * Push circles apart so effective radii (incl. label space) never overlap.
 * Soft anchor keeps compass / geo positions when possible.
 */
export function separateCircles(
  circles: LayoutCircle[],
  opts?: {
    gap?: number;
    labelPad?: number;
    anchorWeight?: number;
    iterations?: number;
    minX?: number;
    minY?: number;
    maxX?: number;
    maxY?: number;
    /** Keep clear of a central marker (YOU). */
    block?: { x: number; y: number; r: number };
  },
): LayoutCircle[] {
  if (!circles.length) return [];

  const gap = opts?.gap ?? 8;
  const labelPad = opts?.labelPad ?? LABEL_PAD;
  const anchorWeight = opts?.anchorWeight ?? 0.12;
  const iterations = opts?.iterations ?? 48;
  const minX = opts?.minX ?? -Infinity;
  const minY = opts?.minY ?? -Infinity;
  const maxX = opts?.maxX ?? Infinity;
  const maxY = opts?.maxY ?? Infinity;
  const block = opts?.block;

  const state = circles.map((c) => ({ ...c }));

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < state.length; i++) {
      const a = state[i]!;
      const aEff = a.r + labelPad;

      if (block) {
        const d = dist(a.x, a.y, block.x, block.y);
        const need = aEff + block.r + gap;
        if (d < need && d > 0.001) {
          const push = (need - d) / d;
          a.x += (a.x - block.x) * push;
          a.y += (a.y - block.y) * push;
        }
      }

      a.x += (a.anchorX - a.x) * anchorWeight;
      a.y += (a.anchorY - a.y) * anchorWeight;

      for (let j = i + 1; j < state.length; j++) {
        const b = state[j]!;
        const bEff = b.r + labelPad;
        const d = dist(a.x, a.y, b.x, b.y);
        const need = aEff + bEff + gap;
        if (d < need) {
          if (d < 0.001) {
            a.x -= 1;
            b.x += 1;
            continue;
          }
          const overlap = (need - d) / 2;
          const nx = (a.x - b.x) / d;
          const ny = (a.y - b.y) / d;
          a.x += nx * overlap;
          a.y += ny * overlap;
          b.x -= nx * overlap;
          b.y -= ny * overlap;
        }
      }

      a.x = Math.min(maxX - a.r, Math.max(minX + a.r, a.x));
      a.y = Math.min(maxY - a.r - labelPad, Math.max(minY + a.r, a.y));
    }
  }

  return state;
}

/** Cartesian mile grid centred on driver (screen space). North = up (−y). */
export function buildScreenMileGrid(opts: {
  cx: number;
  cy: number;
  milesPerPx: number;
  maxMi: number;
  stepMi: number;
  width: number;
  height: number;
  pad: number;
}): MileGrid {
  const { cx, cy, milesPerPx, maxMi, stepMi, width, height, pad } = opts;
  const lines: MileGridLine[] = [];
  const labels: MileGridLabel[] = [];

  const left = pad;
  const right = width - pad;
  const top = pad;
  const bottom = height - pad;

  for (let mi = -maxMi; mi <= maxMi; mi += stepMi) {
    if (mi === 0) continue;
    const x = cx + mi * milesPerPx;
    if (x >= left && x <= right) {
      lines.push({ x1: x, y1: top, x2: x, y2: bottom, axis: "x" });
      if (mi > 0 && mi % (stepMi * 2) === 0) {
        labels.push({
          x: x,
          y: bottom - 4,
          text: `${mi} mi E`,
          anchor: "middle",
        });
      } else if (mi < 0 && Math.abs(mi) % (stepMi * 2) === 0) {
        labels.push({
          x: x,
          y: bottom - 4,
          text: `${Math.abs(mi)} mi W`,
          anchor: "middle",
        });
      }
    }

    const y = cy - mi * milesPerPx;
    if (y >= top && y <= bottom) {
      lines.push({ x1: left, y1: y, x2: right, y2: y, axis: "y" });
      if (mi > 0 && mi % (stepMi * 2) === 0) {
        labels.push({
          x: left + 4,
          y: y + 3,
          text: `${mi} mi N`,
          anchor: "start",
        });
      } else if (mi < 0 && Math.abs(mi) % (stepMi * 2) === 0) {
        labels.push({
          x: left + 4,
          y: y + 3,
          text: `${Math.abs(mi)} mi S`,
          anchor: "start",
        });
      }
    }
  }

  return {
    lines,
    labels: [
      ...labels,
      { x: cx + 6, y: cy + 12, text: "0 mi", anchor: "start" as const },
    ],
    axisX: { x1: left, y1: cy, x2: right, y2: cy },
    axisY: { x1: cx, y1: top, x2: cx, y2: bottom },
  };
}
