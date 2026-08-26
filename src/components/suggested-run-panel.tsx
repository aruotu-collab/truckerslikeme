"use client";

import { useMemo, useState } from "react";
import { JobsRunSequenceChart } from "@/components/jobs-run-sequence-chart";
import {
  buildRunSequence,
  RUN_GOAL_BADGE,
} from "@/lib/jobs-run-sequence";
import type { BidPlan } from "@/lib/jobs-run-builder";
import { shortPlace, type JobsMapDriver } from "@/lib/jobs-map";

type Props = {
  plans: BidPlan[];
  driver: JobsMapDriver | null;
  formatMoney: (n: number) => string;
  onOptimise?: () => void;
};

export function SuggestedRunPanel({
  plans,
  driver,
  formatMoney,
  onOptimise,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    plans[0]?.id ?? null,
  );

  const selected =
    plans.find((p) => p.id === selectedId) ?? plans[0] ?? null;

  const sequence = useMemo(
    () => (selected ? buildRunSequence(selected, driver) : null),
    [selected, driver],
  );

  if (!plans.length || !selected || !sequence) {
    return (
      <div className="rounded-2xl bg-[#0b1220] px-5 py-8 text-center text-sm text-slate-400">
        Need mapped jobs and a start location to suggest runs. Scan Shiply, then
        open Runs.
      </div>
    );
  }

  const badge = RUN_GOAL_BADGE[selected.goal];
  const withHref = selected.jobs.filter((j) => j.href);
  const n = selected.jobs.length;

  return (
    <div className="overflow-hidden rounded-2xl bg-[#0b1220] text-slate-100 shadow-xl">
      {/* Header */}
      <div className="border-b border-white/10 px-5 pt-5 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-white">
              Suggested Run
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-sky-400">
              <span aria-hidden>✦</span> Generated just now
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
            <span aria-hidden>🏆</span> {badge.badge}
          </span>
        </div>

        {/* Summary metrics */}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-200">
            <span className="text-sky-400" aria-hidden>
              ⧉
            </span>
            <span>
              <strong className="font-semibold text-white">{n}</strong> jobs
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-200">
            <span className="text-sky-400" aria-hidden>
              £
            </span>
            <span>
              <strong className="font-semibold text-white">
                {formatMoney(selected.revenue)}
              </strong>{" "}
              potential revenue
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-200">
            <span className="text-sky-400" aria-hidden>
              ↩
            </span>
            <span>
              <strong className="font-semibold text-white">
                {selected.emptyMiles}
              </strong>{" "}
              extra miles
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-5 py-5">
        {/* Candidate run cards */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {plans.slice(0, 5).map((plan, i) => {
            const meta = RUN_GOAL_BADGE[plan.goal];
            const active = plan.id === selected.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedId(plan.id)}
                className={`min-w-[10.5rem] shrink-0 rounded-xl px-3.5 py-3 text-left transition ${
                  active
                    ? "bg-sky-500/15 ring-2 ring-sky-500"
                    : "bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
                }`}
              >
                <p className="text-[11px] font-semibold text-slate-300">
                  <span className="text-sky-400">{i + 1}</span> {meta.title}
                </p>
                <p className="mt-1.5 text-lg font-semibold text-white">
                  {formatMoney(plan.revenue)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {plan.jobs.length} jobs · {plan.emptyMiles} extra miles
                </p>
              </button>
            );
          })}
        </div>

        {/* Run plan list */}
        <div>
          <h4 className="text-sm font-semibold text-white">Run plan</h4>
          <ol className="mt-4 space-y-0">
            {sequence.stops.map((stop, i) => {
              const isPickupish =
                stop.role === "pickup" ||
                (stop.arriveBy === "deadhead" && stop.role !== "deliver");
              const color =
                stop.role === "start"
                  ? "bg-sky-500"
                  : isPickupish
                    ? "bg-rose-500"
                    : "bg-sky-500";

              return (
                <li key={`${stop.index}-${stop.placeKey}`} className="flex gap-3">
                  <div className="flex w-7 flex-col items-center">
                    <span
                      className={`flex size-7 items-center justify-center rounded-full text-[11px] font-bold text-white ${color}`}
                    >
                      {stop.index}
                    </span>
                    {i < sequence.stops.length - 1 && (
                      <span className="my-1 w-px flex-1 border-l border-dashed border-white/15" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-4">
                    <p className="text-[15px] font-semibold text-white">
                      {stop.placeLabel}
                    </p>
                    {stop.note && (
                      <p className="mt-0.5 text-sm text-slate-400">{stop.note}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Sequence chart */}
        <JobsRunSequenceChart sequence={sequence} />

        {/* Jobs list */}
        <div>
          <h4 className="text-sm font-semibold text-white">
            Jobs in this run{" "}
            <span className="font-normal text-slate-400">
              ({n} job{n === 1 ? "" : "s"})
            </span>
          </h4>
          <ul className="mt-3 space-y-2">
            {selected.jobs.map((job, i) => (
              <li key={job.id}>
                {job.href ? (
                  <a
                    href={job.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl bg-white/5 px-3.5 py-3 ring-1 ring-white/10 transition hover:bg-white/10"
                  >
                    <JobRowContent
                      index={i + 1}
                      origin={shortPlace(job.origin)}
                      destination={shortPlace(job.destination)}
                      miles={job.miles}
                      pay={
                        job.rateTotal != null
                          ? formatMoney(job.rateTotal)
                          : null
                      }
                    />
                    <span className="text-slate-500" aria-hidden>
                      ›
                    </span>
                  </a>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3.5 py-3 ring-1 ring-white/10">
                    <JobRowContent
                      index={i + 1}
                      origin={shortPlace(job.origin)}
                      destination={shortPlace(job.destination)}
                      miles={job.miles}
                      pay={
                        job.rateTotal != null
                          ? formatMoney(job.rateTotal)
                          : null
                      }
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer actions */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-white/10 bg-[#0b1220]/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onOptimise}
          className="rounded-xl border border-white/15 px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/5"
        >
          ✦ Optimise again
        </button>
        {withHref.length > 0 ? (
          <div className="flex min-w-0 flex-1 flex-wrap justify-center gap-2">
            {withHref.length === 1 ? (
              <a
                href={withHref[0]!.href!}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-sky-500 px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-sky-400"
              >
                Bid on job →
              </a>
            ) : (
              withHref.map((j) => (
                <a
                  key={j.id}
                  href={j.href!}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-sky-500 px-3 py-2.5 text-center text-xs font-semibold text-white hover:bg-sky-400"
                >
                  Bid · {shortPlace(j.origin)}
                </a>
              ))
            )}
            {withHref.length > 1 && (
              <span className="self-center text-[11px] text-slate-500">
                Open all {n} links to bid
              </span>
            )}
          </div>
        ) : (
          <span className="flex-1 text-center text-xs text-slate-500">
            Add Shiply links to bid
          </span>
        )}
        <a
          href="/run"
          className="rounded-xl border border-white/15 px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/5"
        >
          ⌕ Show on map
        </a>
      </div>

      {selected.risks.length > 0 && (
        <ul className="space-y-1 border-t border-white/10 px-5 py-3 text-xs text-slate-500">
          {selected.risks.map((r) => (
            <li key={r}>! {r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function JobRowContent({
  index,
  origin,
  destination,
  miles,
  pay,
}: {
  index: number;
  origin: string;
  destination: string;
  miles: number | null;
  pay: string | null;
}) {
  return (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-white">
          {origin} → {destination}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          {miles != null && <span>~{miles} mi</span>}
          {pay && (
            <span className="font-semibold text-slate-200">{pay}</span>
          )}
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            Available
          </span>
        </p>
      </div>
    </>
  );
}
