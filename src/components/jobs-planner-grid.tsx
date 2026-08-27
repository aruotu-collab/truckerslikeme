"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ShiplyLink } from "@/components/shiply-link";
import {
  buildConnectionMatrix,
  buildManualChain,
  buildPlannerRows,
  connectionsFromJob,
  DEFAULT_PLANNER_FILTERS,
  filterPlannerRows,
  PLANNER_SORT_DEFAULT_DIR,
  sortPlannerRows,
  type PlannerFilters,
  type PlannerSort,
  type PlannerSortDir,
  type PlannerTab,
} from "@/lib/jobs-planner-grid";
import {
  buildBidPlans,
  DEFAULT_RUN_PREFS,
  type BidPlan,
  type RunBuilderPrefs,
} from "@/lib/jobs-run-builder";
import {
  buildRunSequence,
  RUN_GOAL_BADGE,
} from "@/lib/jobs-run-sequence";
import { DIRECTION_LABELS, type DirectionId } from "@/lib/jobs-map-explore";
import { shortPlace, type JobsMapDriver, type MapJob } from "@/lib/jobs-map";

type Props = {
  jobs: MapJob[];
  driver: JobsMapDriver | null;
  formatMoney: (n: number) => string;
  runPrefs?: RunBuilderPrefs;
  initialChainIds?: string[];
  initialTab?: PlannerTab;
  onOpenDistances?: () => void;
  /** Skip nested tabs — only show suggested run compare. */
  runOnly?: boolean;
  onMarkWon?: (jobId: string) => void;
};

const TABS: { id: PlannerTab | "distances"; label: string }[] = [
  { id: "jobs", label: "Jobs" },
  { id: "connections", label: "Connections" },
  { id: "runs", label: "Runs" },
  { id: "distances", label: "Distances" },
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

function SortTh({
  label,
  column,
  sort,
  dir,
  onSort,
  className = "",
  sticky,
}: {
  label: string;
  column: PlannerSort;
  sort: PlannerSort;
  dir: PlannerSortDir;
  onSort: (column: PlannerSort) => void;
  className?: string;
  sticky?: string;
}) {
  const active = sort === column;
  return (
    <th
      className={`${sticky ?? ""} px-3 py-3 ${className}`}
      aria-sort={
        active ? (dir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 text-left text-[10px] font-semibold tracking-wide uppercase transition hover:text-asphalt ${
          active ? "text-asphalt" : "text-muted"
        }`}
      >
        {label}
        <span className="font-mono text-[9px] opacity-80" aria-hidden>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

export function JobsPlannerGrid({
  jobs,
  driver,
  formatMoney,
  runPrefs = DEFAULT_RUN_PREFS,
  initialChainIds,
  initialTab = "jobs",
  onOpenDistances,
  runOnly = false,
  onMarkWon,
}: Props) {
  const [tab, setTab] = useState<PlannerTab>(runOnly ? "runs" : initialTab);
  const [sort, setSort] = useState<PlannerSort>("default");
  const [sortDir, setSortDir] = useState<PlannerSortDir>("asc");
  const [filters, setFilters] = useState<PlannerFilters>(DEFAULT_PLANNER_FILTERS);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [focusJobId, setFocusJobId] = useState<string | null>(null);
  const [chainIds, setChainIds] = useState<string[]>([]);
  const [matrixMaxDeadhead, setMatrixMaxDeadhead] = useState(80);

  useEffect(() => {
    if (initialChainIds?.length) {
      setChainIds(initialChainIds);
      if (!runOnly) setTab("jobs");
    }
  }, [initialChainIds, runOnly]);

  const rows = useMemo(
    () => buildPlannerRows(jobs, driver, runPrefs),
    [jobs, driver, runPrefs],
  );

  const filteredRows = useMemo(
    () => sortPlannerRows(filterPlannerRows(rows, filters), sort, sortDir),
    [rows, filters, sort, sortDir],
  );

  const chain = useMemo(
    () => buildManualChain(chainIds, jobs, driver),
    [chainIds, jobs, driver],
  );

  const runBuilder = useMemo(
    () => buildBidPlans(jobs, driver, runPrefs),
    [jobs, driver, runPrefs],
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

  if (runOnly) {
    return (
      <RunsCompareView
        plans={runBuilder.plans}
        driver={driver}
        formatMoney={formatMoney}
        totalJobCount={jobs.length}
        mappedJobCount={runBuilder.totalJobs}
        onMarkWon={onMarkWon}
      />
    );
  }

  function toggleChain(jobId: string) {
    setChainIds((prev) =>
      prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId],
    );
  }

  function handleSort(column: PlannerSort) {
    if (column === "default") {
      setSort("default");
      setSortDir("asc");
      return;
    }
    if (sort === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSort(column);
    setSortDir(PLANNER_SORT_DEFAULT_DIR[column]);
  }

  function resetSort() {
    setSort("default");
    setSortDir("asc");
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
          className="inline-flex flex-wrap border border-asphalt/15 bg-white font-display tracking-wide uppercase"
          role="tablist"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id !== "distances" && tab === t.id}
              onClick={() => {
                if (t.id === "distances") {
                  onOpenDistances?.();
                  return;
                }
                setTab(t.id);
              }}
              className={`px-4 py-2.5 text-xs font-semibold sm:px-5 ${
                t.id !== "distances" && tab === t.id
                  ? "bg-asphalt text-white"
                  : t.id === "distances"
                    ? "text-amber hover:bg-amber/10"
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

      {/* Filters — only on Jobs / Connections */}
      {tab !== "runs" && (
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
                  maxFromMe: e.target.value ? Number(e.target.value) || null : null,
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
                  maxDeadhead: e.target.value
                    ? Number(e.target.value) || null
                    : null,
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
                  minValue: e.target.value ? Number(e.target.value) || null : null,
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
      )}

      {/* JOBS tab */}
      {tab === "jobs" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={resetSort}
              className={`rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase ${
                sort === "default"
                  ? "bg-asphalt text-white"
                  : "border border-asphalt/15 text-muted hover:border-asphalt/40"
              }`}
            >
              Default order
            </button>
            {sort !== "default" && (
              <p className="text-[11px] text-muted">
                Sorted by {sort} ({sortDir === "asc" ? "low→high" : "high→low"})
                · click a column again to flip
              </p>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto border border-asphalt/10 bg-white md:block">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-asphalt/10 bg-[#f4f6f8] text-left text-[10px] font-semibold tracking-wide text-muted uppercase">
                  <th className="sticky left-0 z-20 w-10 bg-[#f4f6f8] px-2 py-3 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    ☑
                  </th>
                  <SortTh
                    label="Job"
                    column="job"
                    sort={sort}
                    dir={sortDir}
                    onSort={handleSort}
                    sticky="sticky left-10 z-20 w-14 bg-[#f4f6f8] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                    className="!px-2"
                  />
                  <SortTh
                    label="Pickup"
                    column="pickup"
                    sort={sort}
                    dir={sortDir}
                    onSort={handleSort}
                    sticky="sticky left-24 z-20 w-28 bg-[#f4f6f8] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                    className="!px-2"
                  />
                  <SortTh
                    label="Drop"
                    column="drop"
                    sort={sort}
                    dir={sortDir}
                    onSort={handleSort}
                    sticky="sticky left-[13.5rem] z-20 w-28 bg-[#f4f6f8] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                    className="!px-2"
                  />
                  <SortTh
                    label="£"
                    column="pay"
                    sort={sort}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortTh
                    label="Miles"
                    column="miles"
                    sort={sort}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortTh
                    label="From me"
                    column="fromMe"
                    sort={sort}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortTh
                    label="Next pickup"
                    column="nextPickup"
                    sort={sort}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortTh
                    label="Deadhead"
                    column="deadhead"
                    sort={sort}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortTh
                    label="Fit"
                    column="fit"
                    sort={sort}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortTh
                    label="£/mile"
                    column="rpm"
                    sort={sort}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortTh
                    label="Best next · tap"
                    column="bestNext"
                    sort={sort}
                    dir={sortDir}
                    onSort={handleSort}
                  />
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
                            aria-expanded={expanded}
                            title={
                              expanded
                                ? "Hide possible next jobs"
                                : "Show possible next jobs"
                            }
                            className="inline-flex items-center gap-1 text-amber hover:underline"
                          >
                            {row.code}
                            <span className="text-[9px] font-semibold text-muted" aria-hidden>
                              {expanded ? "▲" : "▼"}
                            </span>
                          </button>
                        </td>
                        <td className="sticky left-24 z-10 bg-inherit px-2 py-2.5 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                          {row.pickup}
                        </td>
                        <td className="sticky left-[13.5rem] z-10 bg-inherit px-2 py-2.5 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                          {row.drop}
                        </td>
                        <td className="px-3 py-2.5 font-semibold tabular-nums">
                          {row.pay > 0 ? formatMoney(row.pay) : "—"}
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
                          {row.pay > 0 ? formatMoney(row.rpm) : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {row.bestNext ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedJobId(expanded ? null : row.job.id)
                              }
                              aria-expanded={expanded}
                              title={`Show possible next jobs after ${row.code}`}
                              className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 font-mono text-xs font-semibold transition ${
                                expanded
                                  ? "border-amber bg-amber text-asphalt"
                                  : "border-amber bg-amber/15 text-amber shadow-sm hover:bg-amber/30"
                              }`}
                            >
                              {row.bestNext.code}
                              <span className="font-sans text-[10px] font-bold tracking-wide uppercase">
                                {expanded ? "▲ hide" : "▼ options"}
                              </span>
                            </button>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
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
                      {row.pay > 0 ? formatMoney(row.pay) : "No bid"} ·{" "}
                      {row.miles} mi
                      {row.pay > 0 && row.rpm > 0
                        ? ` · ${formatMoney(row.rpm)}/mi`
                        : ""}
                    </p>
                    {row.bestNext && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedJobId(
                            expandedJobId === row.job.id ? null : row.job.id,
                          )
                        }
                        className="mt-2 inline-flex items-center gap-1.5 rounded-sm border border-amber/50 bg-amber/10 px-2.5 py-1.5 text-xs font-semibold text-amber"
                      >
                        Best next {row.bestNext.code}
                        <span className="font-normal text-muted">
                          · {row.bestNext.deadhead} mi empty · tap for options
                        </span>
                      </button>
                    )}
                    {expandedJobId === row.job.id && (
                      <div className="mt-3 border-t border-asphalt/10 pt-3">
                        <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                          Possible next jobs
                        </p>
                        <ul className="mt-2 space-y-2">
                          {connectionsFromJob(
                            row.job,
                            jobs,
                            driver,
                            runPrefs,
                            8,
                          ).map((c) => (
                            <li
                              key={c.toJob.id}
                              className="text-xs text-asphalt"
                            >
                              <span className="font-mono font-semibold text-amber">
                                {c.toCode}
                              </span>{" "}
                              {c.route} · {c.deadheadMi} mi empty ·{" "}
                              <span className={fitClass(c.fit.tone)}>
                                {c.fit.label}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
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

      {/* RUNS tab — simple light compare (no dark mockup panel) */}
      {tab === "runs" && (
        <RunsCompareView
          plans={runBuilder.plans}
          driver={driver}
          formatMoney={formatMoney}
          totalJobCount={jobs.length}
          mappedJobCount={runBuilder.totalJobs}
        />
      )}
    </div>
  );
}

function RunsCompareView({
  plans,
  driver,
  formatMoney,
  totalJobCount,
  mappedJobCount,
  onMarkWon,
}: {
  plans: BidPlan[];
  driver: JobsMapDriver | null;
  formatMoney: (n: number) => string;
  totalJobCount: number;
  mappedJobCount: number;
  onMarkWon?: (jobId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    plans[0]?.id ?? null,
  );
  /** Jobs the driver dropped from the selected suggested run. */
  const [excludedIds, setExcludedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!plans.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !plans.some((p) => p.id === selectedId)) {
      setSelectedId(plans[0]!.id);
    }
  }, [plans, selectedId]);

  // Reset exclusions when switching suggested run
  useEffect(() => {
    setExcludedIds([]);
  }, [selectedId]);

  const basePlan =
    plans.find((p) => p.id === selectedId) ?? plans[0] ?? null;

  const workingPlan = useMemo(() => {
    if (!basePlan) return null;
    const kept = basePlan.jobs.filter((j) => !excludedIds.includes(j.id));
    if (kept.length === basePlan.jobs.length) return basePlan;
    if (!kept.length) {
      return {
        ...basePlan,
        jobs: [],
        revenue: 0,
        loadedMiles: 0,
        emptyMiles: 0,
        totalMiles: 0,
        revenuePerMile: 0,
        emptyPct: 0,
        legs: [],
      } satisfies BidPlan;
    }
    const chain = buildManualChain(
      kept.map((j) => j.id),
      kept,
      driver,
    );
    if (!chain) return basePlan;
    return {
      ...basePlan,
      label: `${basePlan.label} (edited)`,
      jobs: chain.jobs,
      revenue: chain.revenue,
      loadedMiles: chain.loadedMiles,
      emptyMiles: chain.emptyMiles,
      totalMiles: chain.totalMiles,
      revenuePerMile: chain.revenuePerMile,
      emptyPct: chain.emptyPct,
      legs: [],
    } satisfies BidPlan;
  }, [basePlan, excludedIds, driver]);

  const sequence = useMemo(
    () => (workingPlan ? buildRunSequence(workingPlan, driver) : null),
    [workingPlan, driver],
  );

  if (!plans.length || !basePlan || !workingPlan || !sequence) {
    const hasStart = Boolean(driver?.label?.trim());
    let title = "No suggested runs yet";
    let detail = "Add jobs and set your start location, then come back here.";
    if (!hasStart) {
      title = "Set your start location";
      detail = "Suggested runs need a starting town above the board.";
    } else if (totalJobCount === 0) {
      title = "No jobs on the board";
      detail = "Scan Shiply and add jobs first.";
    } else if (mappedJobCount === 0) {
      title = "Jobs aren’t mapped yet";
      detail = "We couldn’t recognise pickup/drop towns on these jobs.";
    } else {
      title = "Couldn’t build a chain";
      detail = "No jobs linked within a sensible deadhead yet.";
    }
    return (
      <div className="border border-asphalt/10 bg-white px-5 py-10 text-center">
        <p className="font-display text-lg tracking-wide text-asphalt uppercase">
          {title}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{detail}</p>
      </div>
    );
  }

  const loadedPct =
    workingPlan.totalMiles > 0
      ? Math.round((workingPlan.loadedMiles / workingPlan.totalMiles) * 100)
      : 0;

  function dropFromRun(jobId: string) {
    setExcludedIds((prev) =>
      prev.includes(jobId) ? prev : [...prev, jobId],
    );
  }

  function restoreAll() {
    setExcludedIds([]);
  }

  return (
    <div className="space-y-5 border border-asphalt/10 bg-white">
      <div className="border-b border-asphalt/10 px-4 py-4 sm:px-5">
        <p className="font-display text-xs tracking-[0.14em] text-amber uppercase">
          Bid planner
        </p>
        <h3 className="mt-1 font-display text-2xl tracking-wide text-asphalt uppercase">
          Suggested runs
        </h3>
        <p className="mt-1 text-sm text-muted">
          Tap a row to open its journey underneath — jobs for that run stay
          below.
        </p>
      </div>

      <div className="px-4 sm:px-5">
        <div className="overflow-x-auto border border-asphalt/10">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-asphalt/10 bg-[#f4f6f8] text-left text-[10px] font-semibold tracking-wide text-muted uppercase">
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Goal</th>
                <th className="px-3 py-2.5">Jobs</th>
                <th className="px-3 py-2.5">Revenue</th>
                <th className="px-3 py-2.5">Loaded</th>
                <th className="px-3 py-2.5">Deadhead</th>
                <th className="px-3 py-2.5">Total</th>
                <th className="px-3 py-2.5">£ / mi</th>
              </tr>
            </thead>
            <tbody>
              {plans.slice(0, 6).map((plan, i) => {
                const meta = RUN_GOAL_BADGE[plan.goal];
                const active = plan.id === basePlan.id;
                return (
                  <Fragment key={plan.id}>
                    <tr
                      onClick={() => setSelectedId(plan.id)}
                      className={`cursor-pointer border-b border-asphalt/5 ${
                        active
                          ? "bg-amber/15"
                          : "hover:bg-concrete/40"
                      }`}
                    >
                      <td className="px-3 py-2.5 font-mono text-xs font-semibold text-amber">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-asphalt">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="text-[10px] text-muted"
                            aria-hidden
                          >
                            {active ? "▼" : "▶"}
                          </span>
                          {meta.title}
                          {active && (
                            <span className="text-[10px] font-semibold tracking-wide text-amber uppercase">
                              Selected
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {plan.jobs.length}
                      </td>
                      <td className="px-3 py-2.5 font-semibold tabular-nums">
                        {plan.revenue > 0 ? formatMoney(plan.revenue) : "—"}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-muted">
                        {plan.loadedMiles}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-muted">
                        {plan.emptyMiles}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {plan.totalMiles}
                      </td>
                      <td className="px-3 py-2.5 font-semibold tabular-nums">
                        {plan.revenue > 0 && plan.totalMiles > 0
                          ? `£${plan.revenuePerMile.toFixed(2)}`
                          : "—"}
                      </td>
                    </tr>
                    {active && (
                      <tr className="border-b border-asphalt/10 bg-amber/5">
                        <td colSpan={8} className="px-4 py-4 sm:px-5">
                          <div className="mb-3 flex h-2.5 overflow-hidden border border-asphalt/15 bg-white">
                            <div
                              className="bg-asphalt"
                              style={{ width: `${loadedPct}%` }}
                            />
                            <div
                              className="bg-[#c4a035]/70"
                              style={{ width: `${100 - loadedPct}%` }}
                            />
                          </div>
                          <p className="mb-3 text-[11px] text-muted">
                            Loaded {workingPlan.loadedMiles} mi · Deadhead{" "}
                            {workingPlan.emptyMiles} mi
                            {workingPlan.revenue > 0
                              ? ` · ${formatMoney(workingPlan.revenue)}`
                              : ""}
                          </p>
                          <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                            Journey
                          </p>
                          {workingPlan.jobs.length === 0 ? (
                            <p className="mt-2 text-sm text-muted">
                              No jobs left in this run. Restore jobs or pick
                              another suggestion.
                            </p>
                          ) : (
                            <ol className="mt-2 space-y-0">
                              {sequence.stops.map((stop, si) => {
                                const next = sequence.stops[si + 1];
                                return (
                                  <li
                                    key={`${stop.index}-${stop.placeKey}-${si}`}
                                  >
                                    <div className="flex gap-3">
                                      <span className="flex size-7 shrink-0 items-center justify-center bg-asphalt text-[10px] font-bold text-white">
                                        {stop.index}
                                      </span>
                                      <div className="min-w-0 flex-1 pt-0.5 pb-0.5">
                                        <p className="text-sm font-semibold text-asphalt">
                                          {stop.placeLabel}
                                        </p>
                                        <p className="text-xs text-muted">
                                          {stop.role === "start"
                                            ? "You start"
                                            : stop.role === "pickup"
                                              ? "Pickup"
                                              : stop.role === "deliver"
                                                ? "Drop-off"
                                                : (stop.note ?? "")}
                                        </p>
                                      </div>
                                    </div>
                                    {next &&
                                      (next.arriveBy === "loaded" ||
                                        next.arriveBy === "deadhead") && (
                                        <div className="ml-3.5 border-l border-asphalt/15 py-1.5 pl-6">
                                          <div
                                            className={`px-2.5 py-1 text-xs ${
                                              next.arriveBy === "loaded"
                                                ? "border border-asphalt/20 bg-asphalt/5 text-asphalt"
                                                : "border border-dashed border-amber/50 bg-amber/5 text-muted"
                                            }`}
                                          >
                                            <strong className="tabular-nums">
                                              {next.milesFromPrev} mi
                                            </strong>{" "}
                                            {next.arriveBy === "loaded"
                                              ? "loaded — earning"
                                              : "empty — deadhead"}
                                          </div>
                                        </div>
                                      )}
                                  </li>
                                );
                              })}
                            </ol>
                          )}
                          <p className="mt-3 text-[11px] text-muted">
                            Jobs for this run are listed below — drop any you
                            don’t want.
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {excludedIds.length > 0 && (
        <div className="mx-4 flex flex-wrap items-center justify-between gap-2 border border-amber/30 bg-amber/10 px-3 py-2 text-sm text-asphalt sm:mx-5">
          <span>
            Removed {excludedIds.length} job
            {excludedIds.length === 1 ? "" : "s"} from this run — totals
            updated.
          </span>
          <button
            type="button"
            onClick={restoreAll}
            className="text-xs font-semibold tracking-wide text-amber uppercase underline"
          >
            Restore all
          </button>
        </div>
      )}

      <div className="border-t border-asphalt/10 px-4 py-4 sm:px-5">
        <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
          Jobs in this run ({workingPlan.jobs.length})
        </p>
        <ul className="mt-3 divide-y divide-asphalt/10 border border-asphalt/10">
          {workingPlan.jobs.map((job, i) => (
            <li
              key={job.id}
              className="flex flex-wrap items-center gap-3 px-3 py-3"
            >
              <span className="flex size-7 shrink-0 items-center justify-center bg-asphalt font-mono text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-asphalt">
                  {shortPlace(job.origin)} → {shortPlace(job.destination)}
                </p>
                <p className="text-xs text-muted">
                  {job.miles != null ? `${job.miles} mi` : "Miles unknown"}
                  {job.myBid != null && job.myBid > 0
                    ? ` · ${formatMoney(job.myBid)}`
                    : " · set bid on Jobs tab"}
                  {job.status === "won" ? " · Won" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {job.href && (
                  <ShiplyLink
                    href={job.href}
                    className="shrink-0 rounded-sm bg-amber px-3 py-2 text-[11px] font-bold tracking-wide text-asphalt uppercase"
                  >
                    Open on Shiply
                  </ShiplyLink>
                )}
                {onMarkWon && job.status !== "won" && (
                  <button
                    type="button"
                    onClick={() => onMarkWon(job.id)}
                    className="shrink-0 rounded-sm bg-[#2f6b4f] px-3 py-2 text-[11px] font-bold tracking-wide text-white uppercase"
                  >
                    I got this
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dropFromRun(job.id)}
                  className="shrink-0 rounded-sm border border-asphalt/20 px-3 py-2 text-[11px] font-bold tracking-wide text-muted uppercase hover:border-alert hover:text-alert"
                >
                  Drop from run
                </button>
              </div>
            </li>
          ))}
        </ul>
        {workingPlan.jobs.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            Drop from run only edits this suggestion — it does not delete the
            job from your board.
          </p>
        )}
      </div>
    </div>
  );
}
