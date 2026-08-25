"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  bidPlansToRunRows,
  buildConnectionMatrix,
  buildManualChain,
  buildPlannerRows,
  connectionsFromJob,
  DEFAULT_PLANNER_FILTERS,
  filterPlannerRows,
  sortPlannerRows,
  type PlannerFilters,
  type PlannerSort,
  type PlannerTab,
} from "@/lib/jobs-planner-grid";
import {
  buildBidPlans,
  DEFAULT_RUN_PREFS,
  type RunBuilderPrefs,
} from "@/lib/jobs-run-builder";
import { DIRECTION_LABELS, type DirectionId } from "@/lib/jobs-map-explore";
import { shortPlace, type JobsMapDriver, type MapJob } from "@/lib/jobs-map";

type Props = {
  jobs: MapJob[];
  driver: JobsMapDriver | null;
  formatMoney: (n: number) => string;
  runPrefs?: RunBuilderPrefs;
  initialChainIds?: string[];
};

const TABS: { id: PlannerTab; label: string }[] = [
  { id: "jobs", label: "Jobs" },
  { id: "connections", label: "Connections" },
  { id: "runs", label: "Runs" },
];

const SORTS: { id: PlannerSort; label: string }[] = [
  { id: "pay", label: "£" },
  { id: "rpm", label: "£/mi" },
  { id: "miles", label: "Miles" },
  { id: "fromMe", label: "From me" },
  { id: "deadhead", label: "Deadhead" },
  { id: "pickup", label: "Pickup" },
  { id: "drop", label: "Drop" },
];

function fitClass(tone: string) {
  switch (tone) {
    case "excellent":
    case "good":
      return "text-emerald-700";
    case "possible":
      return "text-amber-700";
    case "home":
      return "text-sky-700";
    default:
      return "text-red-700";
  }
}

export function JobsPlannerGrid({
  jobs,
  driver,
  formatMoney,
  runPrefs = DEFAULT_RUN_PREFS,
  initialChainIds,
}: Props) {
  const [tab, setTab] = useState<PlannerTab>("jobs");
  const [sort, setSort] = useState<PlannerSort>("pay");
  const [filters, setFilters] = useState<PlannerFilters>(DEFAULT_PLANNER_FILTERS);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [focusJobId, setFocusJobId] = useState<string | null>(null);
  const [chainIds, setChainIds] = useState<string[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [matrixMaxDeadhead, setMatrixMaxDeadhead] = useState(80);

  useEffect(() => {
    if (initialChainIds?.length) {
      setChainIds(initialChainIds);
      setTab("jobs");
    }
  }, [initialChainIds]);

  const rows = useMemo(
    () => buildPlannerRows(jobs, driver, runPrefs),
    [jobs, driver, runPrefs],
  );

  const filteredRows = useMemo(
    () => sortPlannerRows(filterPlannerRows(rows, filters), sort),
    [rows, filters, sort],
  );

  const chain = useMemo(
    () => buildManualChain(chainIds, jobs, driver),
    [chainIds, jobs, driver],
  );

  const runBuilder = useMemo(
    () => buildBidPlans(jobs, driver, runPrefs),
    [jobs, driver, runPrefs],
  );

  const runRows = useMemo(
    () => bidPlansToRunRows(runBuilder.plans),
    [runBuilder.plans],
  );

  const focusJob = focusJobId
    ? jobs.find((j) => j.id === focusJobId) ?? null
    : null;

  const focusConnections = useMemo(() => {
    if (!focusJob) return [];
    const maxDh = filters.maxDeadhead ?? 120;
    return connectionsFromJob(focusJob, jobs, driver, runPrefs, 20).filter(
      (c) => c.deadheadMi <= maxDh,
    );
  }, [focusJob, jobs, driver, runPrefs, filters.maxDeadhead]);

  const matrix = useMemo(
    () =>
      buildConnectionMatrix(
        focusJob ? [focusJob, ...jobs.filter((j) => j.id !== focusJob.id).slice(0, 11)] : jobs.slice(0, 12),
        jobs,
        driver,
        matrixMaxDeadhead,
        runPrefs,
      ),
    [focusJob, jobs, driver, matrixMaxDeadhead, runPrefs],
  );

  function toggleChain(jobId: string) {
    setChainIds((prev) =>
      prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId],
    );
  }

  function applyChainFromPlan(jobList: MapJob[]) {
    setChainIds(jobList.map((j) => j.id));
    setTab("jobs");
  }

  return (
    <div className="space-y-4">
      {/* Chain builder panel */}
      {chain && chain.jobs.length > 0 && (
        <div className="border border-amber/40 bg-amber/5 px-4 py-4 sm:px-5">
          <p className="font-display text-xs tracking-[0.14em] text-amber uppercase">
            Your bid plan
          </p>
          <p className="mt-2 font-mono text-sm text-asphalt">
            {driver?.label ? `${shortPlace(driver.label)} → ` : ""}
            {chain.legs.map((l) => l.route).join(" → ")}
            {chain.endsNearHome && driver?.label ? ` → ${shortPlace(driver.label)}` : ""}
          </p>
          <p className="mt-2 text-sm font-semibold text-asphalt">
            {chain.jobs.length} jobs · {formatMoney(chain.revenue)} ·{" "}
            {chain.emptyMiles} empty miles · {formatMoney(chain.revenuePerMile)}/mi
          </p>
          <div className="mt-3 space-y-1 font-mono text-xs text-muted">
            {chain.legs.map((leg, i) => (
              <p key={leg.job.id}>
                {i > 0 && leg.emptyBefore != null && leg.emptyBefore > 0 && (
                  <span className="text-asphalt/50">↓ {leg.emptyBefore} empty · </span>
                )}
                ☑ {leg.route} {formatMoney(leg.pay)}
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setChainIds([])}
            className="mt-3 text-xs font-semibold text-muted uppercase hover:text-asphalt"
          >
            Clear chain
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex border border-asphalt/15 bg-white font-display tracking-wide uppercase"
          role="tablist"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-xs font-semibold sm:px-5 ${
                tab === t.id
                  ? "bg-asphalt text-white"
                  : "text-asphalt/70 hover:bg-concrete/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">
          {filteredRows.length} of {rows.length} jobs
          {runBuilder.plans.length > 0 && tab === "runs"
            ? ` · ${runBuilder.plans.length} auto runs`
            : ""}
        </p>
      </div>

      {/* Filters — departure board style */}
      <div className="border border-asphalt/10 bg-[#1a1d23] px-3 py-3 text-white sm:px-4">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-amber uppercase">
          Filters
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs">
            <span className="text-white/60">From me &lt; mi</span>
            <input
              type="number"
              placeholder="Any"
              value={filters.maxFromMe ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  maxFromMe: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="mt-1 w-full border-0 bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-amber"
            />
          </label>
          <label className="text-xs">
            <span className="text-white/60">Next deadhead &lt; mi</span>
            <input
              type="number"
              placeholder="Any"
              value={filters.maxDeadhead ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  maxDeadhead: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="mt-1 w-full border-0 bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-amber"
            />
          </label>
          <label className="text-xs">
            <span className="text-white/60">Value &gt; £</span>
            <input
              type="number"
              placeholder="Any"
              value={filters.minValue ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  minValue: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="mt-1 w-full border-0 bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-amber"
            />
          </label>
          <label className="text-xs">
            <span className="text-white/60">Direction</span>
            <select
              value={filters.direction ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  direction: (e.target.value as DirectionId) || null,
                }))
              }
              className="mt-1 w-full border-0 bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-amber"
            >
              <option value="">Any</option>
              {(Object.keys(DIRECTION_LABELS) as DirectionId[]).map((d) => (
                <option key={d} value={d} className="text-asphalt">
                  {DIRECTION_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 text-xs">
            <input
              type="checkbox"
              checked={filters.endNearHome}
              onChange={(e) =>
                setFilters((f) => ({ ...f, endNearHome: e.target.checked }))
              }
              className="size-4 accent-amber"
            />
            <span>End near home</span>
          </label>
        </div>
        {(filters.maxFromMe ||
          filters.maxDeadhead ||
          filters.minValue ||
          filters.direction ||
          filters.endNearHome) && (
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_PLANNER_FILTERS)}
            className="mt-2 text-[11px] font-semibold text-amber uppercase"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* JOBS tab */}
      {tab === "jobs" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSort(s.id)}
                className={`rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase ${
                  sort === s.id
                    ? "bg-asphalt text-white"
                    : "border border-asphalt/15 text-muted"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto border border-asphalt/10 bg-white md:block">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-asphalt/10 bg-[#f4f6f8] text-left text-[10px] font-semibold tracking-wide text-muted uppercase">
                  <th className="sticky left-0 z-20 w-10 bg-[#f4f6f8] px-2 py-3 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    ☑
                  </th>
                  <th className="sticky left-10 z-20 w-14 bg-[#f4f6f8] px-2 py-3 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    Job
                  </th>
                  <th className="sticky left-24 z-20 w-28 bg-[#f4f6f8] px-2 py-3 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    Pickup
                  </th>
                  <th className="sticky left-[13.5rem] z-20 w-28 bg-[#f4f6f8] px-2 py-3 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    Drop
                  </th>
                  <th className="px-3 py-3">£</th>
                  <th className="px-3 py-3">Miles</th>
                  <th className="px-3 py-3">From me</th>
                  <th className="px-3 py-3">Next pickup</th>
                  <th className="px-3 py-3">Deadhead</th>
                  <th className="px-3 py-3">Fit</th>
                  <th className="px-3 py-3">£/mile</th>
                  <th className="px-3 py-3">Best next</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const expanded = expandedJobId === row.job.id;
                  const inChain = chainIds.includes(row.job.id);
                  const nextConns = expanded
                    ? connectionsFromJob(row.job, jobs, driver, runPrefs, 10)
                    : [];

                  return (
                    <Fragment key={row.job.id}>
                      <tr
                        className={`border-b border-asphalt/5 hover:bg-concrete/30 ${
                          expanded ? "bg-amber/5" : ""
                        } ${inChain ? "bg-emerald-50/50" : ""}`}
                      >
                        <td className="sticky left-0 z-10 bg-inherit px-2 py-2.5 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                          <input
                            type="checkbox"
                            checked={inChain}
                            onChange={() => toggleChain(row.job.id)}
                            className="size-4 accent-emerald-600"
                            aria-label={`Add ${row.code} to chain`}
                          />
                        </td>
                        <td className="sticky left-10 z-10 bg-inherit px-2 py-2.5 font-mono text-xs font-semibold shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedJobId(expanded ? null : row.job.id)
                            }
                            className="text-amber hover:underline"
                          >
                            {row.code}
                          </button>
                        </td>
                        <td className="sticky left-24 z-10 bg-inherit px-2 py-2.5 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                          {row.pickup}
                        </td>
                        <td className="sticky left-[13.5rem] z-10 bg-inherit px-2 py-2.5 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                          {row.drop}
                        </td>
                        <td className="px-3 py-2.5 font-semibold tabular-nums">
                          {formatMoney(row.pay)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-muted">
                          {row.miles}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-muted">
                          {row.emptyToPickup != null
                            ? `${row.emptyToPickup} mi`
                            : "—"}
                        </td>
                        <td className="max-w-[10rem] truncate px-3 py-2.5 text-muted">
                          {row.bestNext?.route ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-muted">
                          {row.bestNext ? `${row.bestNext.deadhead} mi` : "—"}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-xs ${fitClass(row.fit.tone)}`}
                        >
                          {row.fit.emoji} {row.fit.label}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums font-medium">
                          {formatMoney(row.rpm)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs">
                          {row.bestNext?.code ?? "—"}
                        </td>
                      </tr>
                      {expanded && nextConns.length > 0 && (
                        <tr key={`${row.job.id}-exp`} className="bg-concrete/20">
                          <td colSpan={12} className="px-4 py-3">
                            <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                              Possible next jobs after {row.code} —{" "}
                              {row.pickup} → {row.drop}
                            </p>
                            <table className="mt-2 w-full text-xs">
                              <thead>
                                <tr className="text-left text-muted">
                                  <th className="py-1 pr-4">Next job</th>
                                  <th className="py-1 pr-4">Empty mi</th>
                                  <th className="py-1 pr-4">Value</th>
                                  <th className="py-1 pr-4">Direction</th>
                                  <th className="py-1">Connection</th>
                                </tr>
                              </thead>
                              <tbody>
                                {nextConns.map((c) => (
                                  <tr key={c.toJob.id} className="border-t border-asphalt/5">
                                    <td className="py-2 pr-4 font-medium">
                                      {c.toCode} {c.route}
                                    </td>
                                    <td className="py-2 pr-4 tabular-nums">
                                      {c.deadheadMi}
                                    </td>
                                    <td className="py-2 pr-4">
                                      {formatMoney(c.pay)}
                                    </td>
                                    <td className="py-2 pr-4">
                                      {c.direction
                                        ? DIRECTION_LABELS[c.direction]
                                        : "—"}
                                    </td>
                                    <td
                                      className={`py-2 ${fitClass(c.fit.tone)}`}
                                    >
                                      {c.fit.emoji} {c.fit.label}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {filteredRows.map((row) => (
              <li
                key={row.job.id}
                className="border border-asphalt/10 bg-white px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={chainIds.includes(row.job.id)}
                    onChange={() => toggleChain(row.job.id)}
                    className="mt-1 size-4 accent-emerald-600"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-semibold text-amber">
                      {row.code}
                    </p>
                    <p className="font-medium text-asphalt">
                      {row.pickup} → {row.drop}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {formatMoney(row.pay)} · {row.miles} mi ·{" "}
                      {formatMoney(row.rpm)}/mi
                    </p>
                    {row.bestNext && (
                      <p className="mt-1 text-xs text-muted">
                        Next: {row.bestNext.route} ({row.bestNext.deadhead} mi){" "}
                        {row.bestNext.code}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs ${fitClass(row.fit.tone)}`}>
                    {row.fit.emoji}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {!filteredRows.length && (
            <p className="text-sm text-muted">
              No jobs match these filters. Widen deadhead or clear filters.
            </p>
          )}
        </div>
      )}

      {/* CONNECTIONS tab */}
      {tab === "connections" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 border border-asphalt/10 bg-white px-4 py-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm">
              <span className="font-medium text-asphalt">Focus job</span>
              <select
                value={focusJobId ?? ""}
                onChange={(e) => setFocusJobId(e.target.value || null)}
                className="mt-1 w-full border border-asphalt/15 px-3 py-2 text-sm outline-none focus:border-amber"
              >
                <option value="">All jobs (top 12 matrix)</option>
                {rows.map((r) => (
                  <option key={r.job.id} value={r.job.id}>
                    {r.code} {r.pickup} → {r.drop}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium text-asphalt">Max deadhead</span>
              <input
                type="number"
                min={20}
                max={120}
                value={matrixMaxDeadhead}
                onChange={(e) =>
                  setMatrixMaxDeadhead(Number(e.target.value) || 80)
                }
                className="mt-1 w-24 border border-asphalt/15 px-3 py-2 text-sm"
              />
            </label>
          </div>

          {focusJob && (
            <div className="border border-asphalt/10 bg-white px-4 py-4">
              <h3 className="font-display text-sm tracking-wide text-asphalt uppercase">
                Best jobs after{" "}
                {rows.find((r) => r.job.id === focusJob.id)?.code}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {shortPlace(focusJob.origin)} → {shortPlace(focusJob.destination)}
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-asphalt/10 text-left text-[10px] uppercase text-muted">
                      <th className="py-2 pr-3">Possible next</th>
                      <th className="py-2 pr-3">Empty mi</th>
                      <th className="py-2 pr-3">Value</th>
                      <th className="py-2 pr-3">Direction</th>
                      <th className="py-2">Fit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {focusConnections.slice(0, 10).map((c) => (
                      <tr
                        key={c.toJob.id}
                        className="border-b border-asphalt/5 hover:bg-concrete/30"
                      >
                        <td className="py-2.5 pr-3">
                          <button
                            type="button"
                            onClick={() => setFocusJobId(c.toJob.id)}
                            className="text-left font-medium text-asphalt hover:text-amber"
                          >
                            {c.toCode} {c.route}
                          </button>
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums">{c.deadheadMi}</td>
                        <td className="py-2.5 pr-3">{formatMoney(c.pay)}</td>
                        <td className="py-2.5 pr-3">
                          {c.direction ? DIRECTION_LABELS[c.direction] : "—"}
                        </td>
                        <td className={`py-2.5 ${fitClass(c.fit.tone)}`}>
                          {c.fit.emoji} {c.fit.label}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="overflow-x-auto border border-asphalt/10 bg-white">
            <p className="border-b border-asphalt/10 px-4 py-2 text-[10px] font-semibold tracking-wide text-muted uppercase">
              Connection matrix · From ↓ / Next →
            </p>
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-asphalt/10 bg-[#f4f6f8] px-2 py-2 text-left">
                    From ↓
                  </th>
                  {matrix.cols.map((col) => (
                    <th
                      key={col.job.id}
                      className="border-b border-asphalt/10 bg-[#f4f6f8] px-2 py-2 text-left font-mono"
                      title={col.route}
                    >
                      {col.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row, ri) => (
                  <tr key={row.job.id} className="border-b border-asphalt/5">
                    <td
                      className="sticky left-0 z-10 bg-white px-2 py-2 font-mono font-semibold"
                      title={row.route}
                    >
                      {row.code}
                    </td>
                    {matrix.cells[ri]?.map((cell, ci) => (
                      <td
                        key={`${row.job.id}-${matrix.cols[ci]?.job.id}`}
                        className="px-2 py-2 text-center tabular-nums"
                      >
                        {cell.deadhead == null ? (
                          "—"
                        ) : cell.quality === "reject" ? (
                          <span className="text-red-600/70">🔴</span>
                        ) : (
                          <span
                            className={fitClass(cell.fit?.tone ?? "poor")}
                            title={`${cell.deadhead} mi`}
                          >
                            {cell.fit?.emoji} {cell.deadhead}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RUNS tab */}
      {tab === "runs" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Auto-generated combinations from deadhead scoring — tap to expand or
            load into your chain.
          </p>

          <div className="overflow-x-auto border border-asphalt/10 bg-white">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-asphalt/10 bg-[#f4f6f8] text-left text-[10px] font-semibold tracking-wide text-muted uppercase">
                  <th className="px-3 py-3">Run</th>
                  <th className="px-3 py-3">Jobs</th>
                  <th className="px-3 py-3">Potential £</th>
                  <th className="px-3 py-3">Total mi</th>
                  <th className="px-3 py-3">Empty</th>
                  <th className="px-3 py-3">£/mile</th>
                  <th className="px-3 py-3">Ends</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {runRows.map((rr) => {
                  const expanded = expandedRunId === rr.plan.id;
                  return (
                    <Fragment key={rr.plan.id}>
                      <tr
                        className={`border-b border-asphalt/5 hover:bg-concrete/30 ${
                          expanded ? "bg-amber/5" : ""
                        }`}
                      >
                        <td className="px-3 py-3 font-mono font-semibold">
                          {rr.runLabel}
                        </td>
                        <td className="px-3 py-3">{rr.jobsCount}</td>
                        <td className="px-3 py-3 font-semibold">
                          {formatMoney(rr.revenue)}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-muted">
                          {rr.totalMiles}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-muted">
                          {rr.emptyMiles}
                        </td>
                        <td className="px-3 py-3 font-medium">
                          {formatMoney(rr.rpm)}
                        </td>
                        <td className="px-3 py-3 text-muted">
                          {rr.ends}
                          {rr.plan.endsNearHome ? " 🏠" : ""}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRunId(expanded ? null : rr.plan.id)
                            }
                            className="text-xs font-semibold text-amber uppercase"
                          >
                            {expanded ? "Hide" : "Expand"}
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr key={`${rr.plan.id}-legs`}>
                          <td colSpan={8} className="bg-concrete/20 px-4 py-4">
                            <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                              {rr.plan.label}
                            </p>
                            <div className="mt-2 space-y-1 font-mono text-sm">
                              <p>{driver?.label ? shortPlace(driver.label) : "Start"}</p>
                              {rr.plan.legs
                                .filter((l) => l.kind !== "start")
                                .map((leg, i) => (
                                  <p key={i} className="text-asphalt">
                                    {leg.kind === "empty" && (
                                      <span className="text-muted">
                                        ↓ {leg.miles} empty
                                      </span>
                                    )}
                                    {leg.kind === "pickup" && (
                                      <span>
                                        ☑ Pickup {leg.place}
                                        {leg.pay ? ` · ${formatMoney(leg.pay)}` : ""}
                                      </span>
                                    )}
                                    {(leg.kind === "deliver" ||
                                      leg.kind === "loaded") && (
                                      <span>
                                        → Deliver {leg.place}
                                        {leg.pay ? ` · ${formatMoney(leg.pay)}` : ""}
                                      </span>
                                    )}
                                    {leg.kind === "handoff" && (
                                      <span>
                                        ☑ {leg.place} handoff
                                        {leg.deliverPay
                                          ? ` · ${formatMoney(leg.deliverPay)}`
                                          : ""}
                                      </span>
                                    )}
                                  </p>
                                ))}
                            </div>
                            <p className="mt-3 text-sm font-semibold">
                              {rr.jobsCount} jobs · {formatMoney(rr.revenue)} ·{" "}
                              {rr.emptyMiles} empty mi
                            </p>
                            <button
                              type="button"
                              onClick={() => applyChainFromPlan(rr.plan.jobs)}
                              className="mt-3 rounded-sm bg-amber px-4 py-2 text-[11px] font-semibold tracking-wide text-asphalt uppercase"
                            >
                              Use this chain →
                            </button>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!runRows.length && (
            <p className="text-sm text-muted">
              Need mapped jobs and a start location to generate runs.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
