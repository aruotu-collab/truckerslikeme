"use client";

import { useMemo, useState } from "react";
import {
  buildDistanceMatrix,
  chainingCandidates,
  distCellKey,
  distHeatStyle,
  type DistCell,
} from "@/lib/jobs-distance-matrix";
import { shortPlace, type JobsMapDriver, type MapJob } from "@/lib/jobs-map";

type Props = {
  jobs: MapJob[];
  driver: JobsMapDriver | null;
  onGoToRuns?: () => void;
};

export function JobsDistanceMatrix({ jobs, driver, onGoToRuns }: Props) {
  const [selected, setSelected] = useState<DistCell | null>(null);

  const matrix = useMemo(
    () => buildDistanceMatrix(jobs, driver),
    [jobs, driver],
  );

  const chainHint = useMemo(() => {
    if (!selected) return null;
    return chainingCandidates(jobs, selected.fromKey, selected.toKey);
  }, [jobs, selected]);

  if (!matrix.places.length) {
    return (
      <p className="text-sm text-muted">
        No mapped towns yet. Scan Shiply jobs with recognisable UK places to
        build the distance grid.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Crow-flies miles between {matrix.places.length} towns on your board
          {matrix.unmappedCount > 0
            ? ` · ${matrix.unmappedCount} jobs unmapped`
            : ""}
        </p>
        <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
          Darker = shorter deadhead
        </p>
      </div>

      <div className="relative border border-asphalt/20 bg-white shadow-sm">
        <div className="border-b border-asphalt/10 bg-[#e8ecf0] px-3 py-1.5 text-center text-[10px] font-bold tracking-wide text-asphalt uppercase">
          Drop off / To →
        </div>
        <div className="max-h-[min(70vh,560px)] overflow-auto">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-40 min-w-[7.5rem] border border-asphalt/20 bg-[#5b6b7c] px-2 py-3 text-left text-[10px] font-bold tracking-wide text-white uppercase shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                  <span className="block leading-tight">Pickup</span>
                  <span className="block text-[8px] font-normal normal-case opacity-90">
                    / Drop off
                  </span>
                </th>
                {matrix.places.map((place) => (
                  <th
                    key={place.key}
                    className="sticky top-0 z-30 max-w-[2.5rem] min-w-[2.25rem] border border-asphalt/20 bg-[#ffc000] px-1 py-2 text-center align-bottom"
                    title={`${place.label} · ${place.pickupCount} pickups · ${place.dropCount} drops`}
                  >
                    <span
                      className="inline-block text-[10px] leading-tight font-semibold text-asphalt"
                      style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                        maxHeight: "5.5rem",
                      }}
                    >
                      {place.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.places.map((from) => (
                <tr key={from.key}>
                  <th
                    className="sticky left-0 z-20 border border-asphalt/20 bg-[#5b6b7c] px-3 py-2 text-left text-xs font-semibold text-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]"
                    title={`${from.label} · ${from.pickupCount} pickups · ${from.dropCount} drops`}
                  >
                    {from.label}
                  </th>
                  {matrix.places.map((to) => {
                    const cell = matrix.cells.get(
                      distCellKey(from.key, to.key),
                    )!;
                    const isDiag = from.key === to.key;
                    const isSelected =
                      selected?.fromKey === from.key &&
                      selected?.toKey === to.key;

                    return (
                      <td
                        key={to.key}
                        className={`cursor-pointer border border-asphalt/15 px-1 py-1.5 text-center text-[11px] font-medium tabular-nums hover:ring-2 hover:ring-amber/60 ${
                          isSelected ? "ring-2 ring-asphalt" : ""
                        }`}
                        style={distHeatStyle(cell.miles, matrix.maxMiles)}
                        onClick={() => setSelected(cell)}
                        title={`${from.label} → ${to.label}: ${cell.miles} mi`}
                      >
                        {isDiag ? "0" : `${cell.miles}mi`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-asphalt/10 px-3 py-1.5 text-[10px] text-muted">
          Scroll for more towns · left column + top headers stay fixed · tap a
          cell for chaining tip
        </p>
      </div>

      <p className="text-xs text-muted">
        After dropping at a town (row), read across to see empty miles to each
        next pickup (column). That gap is the red line on Suggested chains.
      </p>

      {selected && (
        <aside className="border border-asphalt/10 bg-white px-4 py-5 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-display text-xs tracking-[0.14em] text-amber uppercase">
                Deadhead link
              </p>
              <h3 className="mt-1 font-display text-xl tracking-wide text-asphalt uppercase">
                {selected.fromLabel} → {selected.toLabel}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {selected.miles === 0 && selected.fromKey === selected.toKey
                  ? "Same town — zero deadhead if you pick up here after dropping."
                  : `About ${selected.miles} mi empty between drop and next pickup.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs font-semibold text-muted uppercase hover:text-asphalt"
            >
              Close
            </button>
          </div>

          {chainHint && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                  Jobs dropping at {selected.fromLabel}
                </p>
                {chainHint.afterDrop.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">None on board</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {chainHint.afterDrop.slice(0, 5).map((j) => (
                      <li key={j.id} className="text-sm text-asphalt">
                        {shortPlace(j.origin)} → {shortPlace(j.destination)}
                      </li>
                    ))}
                    {chainHint.afterDrop.length > 5 && (
                      <li className="text-xs text-muted">
                        +{chainHint.afterDrop.length - 5} more
                      </li>
                    )}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                  Jobs picking up at {selected.toLabel}
                </p>
                {chainHint.nextPickup.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">None on board</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {chainHint.nextPickup.slice(0, 5).map((j) => (
                      <li key={j.id} className="text-sm text-asphalt">
                        {shortPlace(j.origin)} → {shortPlace(j.destination)}
                      </li>
                    ))}
                    {chainHint.nextPickup.length > 5 && (
                      <li className="text-xs text-muted">
                        +{chainHint.nextPickup.length - 5} more
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          )}

          {onGoToRuns && (
            <button
              type="button"
              onClick={onGoToRuns}
              className="mt-4 rounded-sm bg-amber px-4 py-2 text-xs font-bold tracking-wide text-asphalt uppercase hover:bg-amber/90"
            >
              See Suggested chains →
            </button>
          )}
        </aside>
      )}
    </div>
  );
}
