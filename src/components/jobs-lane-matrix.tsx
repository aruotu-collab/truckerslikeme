"use client";

import { useMemo, useState } from "react";
import { ShiplyLink } from "@/components/shiply-link";
import {
  buildLaneMatrix,
  filterMatrixByDrop,
  filterMatrixByPickup,
  laneCellKey,
  laneHeatStyle,
  topLanes,
  type LaneCell,
  type LaneMatrix,
} from "@/lib/jobs-lane-matrix";
import { mapStatusMeta, type JobsMapDriver, type MapJob } from "@/lib/jobs-map";

type Props = {
  jobs: MapJob[];
  driver: JobsMapDriver | null;
  formatMoney: (n: number) => string;
  onAddToRun?: (jobs: MapJob[]) => void;
};

export function JobsLaneMatrix({
  jobs,
  driver,
  formatMoney,
  onAddToRun,
}: Props) {
  const [filterPickup, setFilterPickup] = useState<string | null>(null);
  const [filterDrop, setFilterDrop] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<LaneCell | null>(null);

  const fullMatrix = useMemo(
    () => buildLaneMatrix(jobs, driver),
    [jobs, driver],
  );

  const matrix = useMemo(() => {
    let m: LaneMatrix = fullMatrix;
    if (filterPickup) m = filterMatrixByPickup(m, filterPickup);
    if (filterDrop) m = filterMatrixByDrop(m, filterDrop);
    return m;
  }, [fullMatrix, filterPickup, filterDrop]);

  const activeFilterLabel = useMemo(() => {
    if (filterPickup && filterDrop) {
      const p = fullMatrix.pickups.find((x) => x.key === filterPickup)?.label;
      const d = fullMatrix.drops.find((x) => x.key === filterDrop)?.label;
      return `Pickups near ${p} · drops toward ${d}`;
    }
    if (filterPickup) {
      return `Pickups around ${fullMatrix.pickups.find((x) => x.key === filterPickup)?.label}`;
    }
    if (filterDrop) {
      return `Jobs heading toward ${fullMatrix.drops.find((x) => x.key === filterDrop)?.label}`;
    }
    return null;
  }, [filterPickup, filterDrop, fullMatrix]);

  const top = useMemo(() => topLanes(fullMatrix), [fullMatrix]);

  if (!fullMatrix.totalJobs) {
    return (
      <p className="text-sm text-muted">
        No mapped pickup→drop lanes yet. Scan Shiply jobs with recognisable UK
        places.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {fullMatrix.totalJobs} jobs across {fullMatrix.pickups.length} pickup
          × {fullMatrix.drops.length} drop locations
          {fullMatrix.unmappedCount > 0
            ? ` · ${fullMatrix.unmappedCount} unmapped`
            : ""}
        </p>
        {(filterPickup || filterDrop) && (
          <button
            type="button"
            onClick={() => {
              setFilterPickup(null);
              setFilterDrop(null);
              setSelectedCell(null);
            }}
            className="text-xs font-semibold text-amber uppercase hover:text-asphalt"
          >
            Clear lane filter
          </button>
        )}
      </div>

      {activeFilterLabel && (
        <p className="border border-amber/30 bg-amber/5 px-3 py-2 text-sm text-asphalt">
          {activeFilterLabel}
        </p>
      )}

      {top.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">
            Strongest lanes:
          </span>
          {top.map((lane) => (
            <button
              key={laneCellKey(lane.pickupKey, lane.dropKey)}
              type="button"
              onClick={() => setSelectedCell(lane)}
              className="rounded-sm border border-asphalt/15 bg-white px-2.5 py-1 text-xs font-medium text-asphalt hover:border-amber/50"
            >
              {lane.pickupLabel} → {lane.dropLabel}{" "}
              <span className="font-bold text-amber">{lane.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative border border-asphalt/20 bg-white shadow-sm">
        <div className="border-b border-asphalt/10 bg-[#ffc000] px-3 py-1.5 text-center text-[10px] font-bold tracking-wide text-asphalt uppercase">
          Drop-off → scroll sideways
        </div>
        <div className="max-h-[min(70vh,560px)] overflow-auto">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-40 min-w-[7.5rem] border border-asphalt/20 bg-[#4472c4] px-2 py-3 text-left text-[10px] font-bold tracking-wide text-white uppercase shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                  <span className="block leading-tight">Pickup</span>
                  <span className="block text-[8px] font-normal normal-case opacity-90">
                    / Drop off
                  </span>
                </th>
                {matrix.drops.map((drop) => (
                  <th
                    key={drop.key}
                    className={`sticky top-0 z-30 max-w-[2.5rem] min-w-[2.25rem] cursor-pointer border border-asphalt/20 bg-[#ffc000] px-1 py-2 text-center align-bottom transition hover:bg-[#ffd966] ${
                      filterDrop === drop.key
                        ? "ring-2 ring-inset ring-asphalt"
                        : ""
                    }`}
                    onClick={() => {
                      setFilterDrop(filterDrop === drop.key ? null : drop.key);
                      setSelectedCell(null);
                    }}
                    title={`${drop.label} — ${drop.total} incoming jobs`}
                  >
                    <span
                      className="inline-block text-[10px] leading-tight font-semibold text-asphalt"
                      style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                        maxHeight: "5.5rem",
                      }}
                    >
                      {drop.label}
                    </span>
                  </th>
                ))}
                <th className="sticky right-0 top-0 z-40 min-w-[3.25rem] border border-asphalt/20 bg-[#e8ecf0] px-2 py-2 text-center text-[9px] font-bold tracking-wide text-muted uppercase shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                  Out
                </th>
              </tr>
            </thead>
            <tbody>
              {matrix.pickups.map((pickup) => (
                <tr key={pickup.key}>
                  <th
                    className={`sticky left-0 z-20 cursor-pointer border border-asphalt/20 bg-[#4472c4] px-3 py-2 text-left text-xs font-semibold text-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)] transition hover:bg-[#5a82d4] ${
                      filterPickup === pickup.key
                        ? "ring-2 ring-inset ring-amber"
                        : ""
                    }`}
                    onClick={() => {
                      setFilterPickup(
                        filterPickup === pickup.key ? null : pickup.key,
                      );
                      setSelectedCell(null);
                    }}
                    title={`${pickup.label} — ${pickup.total} outgoing jobs`}
                  >
                    {pickup.label}
                  </th>
                  {matrix.drops.map((drop) => {
                    const cell = matrix.cells.get(
                      laneCellKey(pickup.key, drop.key),
                    );
                    const count = cell?.count ?? 0;
                    const isSelected =
                      selectedCell?.pickupKey === pickup.key &&
                      selectedCell?.dropKey === drop.key;

                    return (
                      <td
                        key={drop.key}
                        className={`border border-asphalt/15 px-1 py-1 text-center tabular-nums ${
                          count > 0
                            ? "cursor-pointer hover:ring-2 hover:ring-amber/60"
                            : "bg-white"
                        } ${isSelected ? "ring-2 ring-asphalt" : ""}`}
                        style={laneHeatStyle(count, matrix.maxCount)}
                        onClick={() => {
                          if (cell) setSelectedCell(cell);
                        }}
                        title={
                          count > 0
                            ? `${pickup.label} → ${drop.label} · ${count} job${count === 1 ? "" : "s"}`
                            : undefined
                        }
                      >
                        {count > 0 ? count : ""}
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-20 border border-asphalt/20 bg-[#e8ecf0] px-2 py-2 text-center text-xs font-semibold tabular-nums text-asphalt shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.12)]">
                    {pickup.total}
                  </td>
                </tr>
              ))}
              <tr>
                <th className="sticky bottom-0 left-0 z-40 border border-asphalt/20 bg-[#dfe3e8] px-3 py-2 text-left text-[9px] font-bold tracking-wide text-muted uppercase shadow-[2px_-2px_4px_-2px_rgba(0,0,0,0.12)]">
                  In
                </th>
                {matrix.drops.map((drop) => (
                  <td
                    key={drop.key}
                    className="sticky bottom-0 z-30 border border-asphalt/20 bg-[#dfe3e8] px-2 py-2 text-center text-xs font-semibold tabular-nums text-asphalt shadow-[0_-2px_4px_-2px_rgba(0,0,0,0.08)]"
                  >
                    {drop.total}
                  </td>
                ))}
                <td className="sticky bottom-0 right-0 z-40 border border-asphalt/20 bg-[#dfe3e8] px-2 py-2 text-center text-xs font-bold tabular-nums shadow-[-2px_-2px_4px_-2px_rgba(0,0,0,0.12)]">
                  {matrix.totalJobs}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="border-t border-asphalt/10 px-3 py-1.5 text-[10px] text-muted">
          Scroll sideways for more towns · Pickup + Out + In stay fixed
        </p>
      </div>

      <p className="text-xs text-muted">
        Darker cells = more jobs on that lane. Tap a row for pickups, a column
        for destinations, or a cell for job details.
      </p>

      {selectedCell && (
        <aside className="border border-asphalt/10 bg-white px-4 py-5 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-display text-xs tracking-[0.14em] text-amber uppercase">
                Lane detail
              </p>
              <h3 className="mt-1 font-display text-xl tracking-wide text-asphalt uppercase">
                {selectedCell.pickupLabel} → {selectedCell.dropLabel}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {selectedCell.count} job{selectedCell.count === 1 ? "" : "s"} ·{" "}
                {formatMoney(selectedCell.totalPay)} combined potential
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCell(null)}
              className="text-xs font-semibold text-muted uppercase hover:text-asphalt"
            >
              Close
            </button>
          </div>

          <ul className="mt-4 space-y-2">
            {selectedCell.jobs.map((job) => {
              const meta = mapStatusMeta[job.status];
              return (
                <li
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-asphalt/10 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-asphalt">
                      {job.item || "Job"}
                    </p>
                    <p className="text-xs text-muted">
                      {meta.label}
                      {job.miles != null ? ` · ~${job.miles} mi` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {job.myBid != null && (
                      <span className="font-semibold tabular-nums">
                        {formatMoney(job.myBid)}
                      </span>
                    )}
                    {job.myBid == null && (
                      <span className="text-xs text-slate-500">No bid yet</span>
                    )}
                    {job.href && (
                      <ShiplyLink
                        href={job.href}
                        className="rounded-sm bg-amber px-3 py-1.5 text-[11px] font-semibold tracking-wide text-asphalt uppercase"
                      >
                        Bid →
                      </ShiplyLink>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {onAddToRun && selectedCell.jobs.length > 0 && (
            <button
              type="button"
              onClick={() => onAddToRun(selectedCell.jobs)}
              className="mt-4 rounded-sm bg-amber px-4 py-2.5 text-[11px] font-semibold tracking-wide text-asphalt uppercase"
            >
              Add {selectedCell.count} to run builder →
            </button>
          )}
        </aside>
      )}
    </div>
  );
}
