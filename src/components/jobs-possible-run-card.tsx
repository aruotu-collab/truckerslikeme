"use client";

import type { PossibleRun, RunStep } from "@/lib/jobs-map-explore";

type Props = {
  run: PossibleRun;
  formatMoney: (n: number) => string;
};

function stepLine(step: RunStep, formatMoney: (n: number) => string) {
  if (step.kind === "start") return step.place;
  if (step.kind === "pickup") {
    return `${step.place} — Pickup${step.pay ? ` ${formatMoney(step.pay)}` : ""}`;
  }
  if (step.kind === "handoff") {
    const d = step.deliverPay ? formatMoney(step.deliverPay) : "";
    const p = step.pickupPay ? formatMoney(step.pickupPay) : "";
    return `${step.place} — Deliver ${d}${p ? ` / Pickup ${p}` : ""}`.trim();
  }
  if (step.kind === "finish") {
    return `${step.place} — Deliver${step.pay ? ` ${formatMoney(step.pay)}` : ""}`;
  }
  return `${step.place} — Deliver${step.pay ? ` ${formatMoney(step.pay)}` : ""}`;
}

export function PossibleRunCard({ run, formatMoney }: Props) {
  const hrefs = run.jobs.filter((j) => j.href);

  return (
    <article className="border border-asphalt/10 bg-white px-4 py-5 sm:px-5">
      <p className="font-display text-sm tracking-[0.14em] text-amber uppercase">
        Possible run · {run.label}
      </p>

      <div className="mt-4 space-y-0">
        {run.steps.map((step, i) => (
          <div key={`${step.place}-${step.kind}-${i}`}>
            <p className="font-medium text-asphalt">{stepLine(step, formatMoney)}</p>
            {i < run.steps.length - 1 && (
              <p className="my-1 pl-2 text-lg leading-none text-asphalt/40">↓</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 border-t border-asphalt/10 pt-4 text-sm">
        <span className="font-semibold text-asphalt">
          {run.jobs.length} job{run.jobs.length === 1 ? "" : "s"}
        </span>
        <span className="text-asphalt">
          {formatMoney(run.totalPay)} potential revenue
        </span>
        <span className="text-muted">{run.extraMiles} extra miles</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {hrefs.length > 0 ? (
          hrefs.map((j) => (
            <a
              key={j.id}
              href={j.href!}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm bg-amber px-4 py-2.5 text-xs font-semibold tracking-wide text-asphalt uppercase"
            >
              Open job on Shiply →
            </a>
          ))
        ) : (
          <span className="text-xs text-muted">No Shiply links from scan</span>
        )}
        <a
          href="/run"
          className="rounded-sm border border-asphalt/20 px-4 py-2.5 text-xs font-semibold tracking-wide uppercase"
        >
          Build in Run →
        </a>
      </div>
    </article>
  );
}
