"use client";

import { useMemo, useState } from "react";
import { JobsRunSequenceChart } from "@/components/jobs-run-sequence-chart";
import {
  buildRunSequence,
  RUN_GOAL_BADGE,
  type RunSequence,
} from "@/lib/jobs-run-sequence";
import type { BidPlan } from "@/lib/jobs-run-builder";
import { shortPlace, type JobsMapDriver } from "@/lib/jobs-map";

type Props = {
  plans: BidPlan[];
  driver: JobsMapDriver | null;
  formatMoney: (n: number) => string;
};

function planLines(
  sequence: RunSequence,
  formatMoney: (n: number) => string,
) {
  const raw: Array<{ place: string; note: string | null }> = [];

  for (const step of sequence.steps) {
    if (step.kind === "start") {
      raw.push({ place: step.label, note: null });
      continue;
    }
    if (step.kind === "deadhead") continue;

    if (step.isLocal) {
      raw.push({
        place: sequence.towns[step.fromCol]?.label ?? step.fromKey,
        note: step.pay != null ? `Local · ${formatMoney(step.pay)}` : "Local job",
      });
    } else {
      const from = sequence.towns[step.fromCol]?.label ?? step.fromKey;
      const to = sequence.towns[step.toCol]?.label ?? step.toKey;
      raw.push({
        place: from,
        note: step.pay != null ? `Pickup ${formatMoney(step.pay)}` : "Pickup",
      });
      raw.push({
        place: to,
        note: step.pay != null ? `Deliver ${formatMoney(step.pay)}` : "Deliver",
      });
    }
  }

  // Collapse Deliver X then Pickup X into one handoff line
  const collapsed: Array<{ place: string; note: string | null }> = [];
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i]!;
    const next = raw[i + 1];
    if (
      next &&
      cur.place === next.place &&
      cur.note?.startsWith("Deliver") &&
      next.note?.startsWith("Pickup")
    ) {
      collapsed.push({
        place: cur.place,
        note: `${cur.note} / ${next.note}`,
      });
      i += 1;
      continue;
    }
    collapsed.push(cur);
  }

  return collapsed.map((l, i) => ({ ...l, n: i + 1 }));
}

export function SuggestedRunPanel({ plans, driver, formatMoney }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    plans[0]?.id ?? null,
  );

  const selected =
    plans.find((p) => p.id === selectedId) ?? plans[0] ?? null;

  const sequence = useMemo(
    () => (selected ? buildRunSequence(selected, driver) : null),
    [selected, driver],
  );

  const lines = useMemo(
    () => (sequence ? planLines(sequence, formatMoney) : []),
    [sequence, formatMoney],
  );

  if (!plans.length || !selected || !sequence) {
    return (
      <p className="text-sm text-muted">
        Need mapped jobs and a start location to suggest runs. Scan Shiply, then
        open Runs.
      </p>
    );
  }

  const badge = RUN_GOAL_BADGE[selected.goal];
  const withHref = selected.jobs.filter((j) => j.href);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl tracking-wide text-asphalt uppercase">
            Suggested run
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Generated from your job board
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800">
          🏆 {badge.badge}
        </span>
      </div>

      <div className="flex flex-wrap gap-4 rounded-lg border border-asphalt/10 bg-white px-4 py-3 text-sm">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Jobs
          </p>
          <p className="font-semibold text-asphalt">{selected.jobs.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Potential
          </p>
          <p className="font-semibold text-asphalt">
            {formatMoney(selected.revenue)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Extra miles
          </p>
          <p className="font-semibold text-asphalt">{selected.emptyMiles}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            £ / mile
          </p>
          <p className="font-semibold text-asphalt">
            {formatMoney(selected.revenuePerMile)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Loaded
          </p>
          <p className="font-semibold text-asphalt">{selected.loadedMiles} mi</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {plans.slice(0, 5).map((plan, i) => {
          const meta = RUN_GOAL_BADGE[plan.goal];
          const active = plan.id === selected.id;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedId(plan.id)}
              className={`min-w-[9.5rem] shrink-0 rounded-lg border px-3 py-3 text-left transition ${
                active
                  ? "border-sky-500 bg-sky-50 ring-1 ring-sky-500/40"
                  : "border-asphalt/10 bg-white hover:border-asphalt/25"
              }`}
            >
              <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                {i + 1}. {meta.title}
              </p>
              <p className="mt-1 text-sm font-semibold text-asphalt">
                {formatMoney(plan.revenue)}
              </p>
              <p className="text-xs text-muted">
                {plan.jobs.length} jobs · {plan.emptyMiles} extra mi
              </p>
            </button>
          );
        })}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-asphalt">Run plan</h4>
        <ol className="mt-3 space-y-0">
          {lines.map((line, i) => (
            <li key={`${line.place}-${i}`} className="flex gap-3">
              <div className="flex w-6 flex-col items-center">
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                    i === 0 ? "bg-sky-500" : "bg-asphalt"
                  }`}
                >
                  {line.n}
                </span>
                {i < lines.length - 1 && (
                  <span className="my-0.5 w-px flex-1 border-l border-dashed border-asphalt/20" />
                )}
              </div>
              <div className="pb-3">
                <p className="text-sm font-medium text-asphalt">{line.place}</p>
                {line.note && (
                  <p className="text-xs text-muted">{line.note}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-asphalt">
          Sequence chart
        </h4>
        <p className="mb-3 text-xs text-muted">
          Columns are towns on this run only. Blue = loaded job · Red dashed =
          deadhead to next pickup.
        </p>
        <JobsRunSequenceChart
          towns={sequence.towns}
          steps={sequence.steps}
          formatMoney={formatMoney}
        />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-asphalt">
          Jobs in this run ({selected.jobs.length})
        </h4>
        <ul className="mt-3 space-y-2">
          {selected.jobs.map((job, i) => (
            <li
              key={job.id}
              className="flex flex-wrap items-center justify-between gap-2 border border-asphalt/10 bg-white px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-asphalt">
                    {shortPlace(job.origin)} → {shortPlace(job.destination)}
                  </p>
                  <p className="text-xs text-muted">
                    {job.item || "Job"}
                    {job.miles != null ? ` · ~${job.miles} mi` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {job.rateTotal != null && (
                  <span className="font-semibold tabular-nums">
                    {formatMoney(job.rateTotal)}
                  </span>
                )}
                {job.href && (
                  <a
                    href={job.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-amber uppercase hover:text-asphalt"
                  >
                    Bid →
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-asphalt/10 pt-4">
        {withHref.length > 0 &&
          withHref.map((j) => (
            <a
              key={j.id}
              href={j.href!}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm bg-sky-600 px-4 py-2.5 text-[11px] font-semibold tracking-wide text-white uppercase"
            >
              Bid · {shortPlace(j.origin)} → {shortPlace(j.destination)}
            </a>
          ))}
        <a
          href="/run"
          className="rounded-sm border border-asphalt/20 px-4 py-2.5 text-[11px] font-semibold tracking-wide uppercase"
        >
          Show on map / Build My Run →
        </a>
      </div>

      {selected.risks.length > 0 && (
        <ul className="space-y-1 text-xs text-muted">
          {selected.risks.map((r) => (
            <li key={r}>! {r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
