"use client";

import { ShiplyLink } from "@/components/shiply-link";
import type { BidPlan, BidPlanLeg } from "@/lib/jobs-run-builder";

type Props = {
  plan: BidPlan;
  formatMoney: (n: number) => string;
  selected?: boolean;
  onSelect?: () => void;
};

function legLine(leg: BidPlanLeg, formatMoney: (n: number) => string) {
  switch (leg.kind) {
    case "start":
      return `START ${leg.place}`;
    case "empty":
      return `→ Drive ${leg.miles ?? "?"} mi empty to ${leg.place}`;
    case "pickup":
      return `→ Pickup${leg.jobIndex ? ` Job ${leg.jobIndex}` : ""} in ${leg.place}${leg.pay ? ` · ${formatMoney(leg.pay)}` : ""}`;
    case "handoff":
      return `→ ${leg.place} — Deliver ${leg.deliverPay ? formatMoney(leg.deliverPay) : ""}${leg.pickupPay ? ` / Pickup ${formatMoney(leg.pickupPay)}` : ""}`;
    case "loaded":
    case "deliver":
      return `→ Deliver ${leg.place}${leg.pay ? ` · ${formatMoney(leg.pay)}` : ""}${leg.miles ? ` (${leg.miles} mi)` : ""}`;
    default:
      return leg.place;
  }
}

export function BidPlanCard({
  plan,
  formatMoney,
  selected,
  onSelect,
}: Props) {
  const hrefs = plan.jobs.filter((j) => j.href);

  return (
    <article
      className={`border bg-white px-4 py-5 sm:px-5 ${
        selected ? "border-amber ring-1 ring-amber/30" : "border-asphalt/10"
      }`}
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={onSelect}
      >
        <p className="font-display text-sm tracking-[0.14em] text-amber uppercase">
          Possible run · {plan.label}
        </p>
        <p className="mt-1 text-xs text-muted">
          {plan.geographicFit === "excellent"
            ? "✓ Excellent geographic fit"
            : plan.geographicFit === "good"
              ? "✓ Good geographic fit"
              : "Fair geographic fit"}
          {plan.endsNearHome ? " · ✓ Returns toward home" : ""}
        </p>
      </button>

      <div className="mt-4 space-y-0 text-sm">
        {plan.legs.map((leg, i) => (
          <div key={`${leg.kind}-${leg.place}-${i}`}>
            <p className="font-medium text-asphalt">{legLine(leg, formatMoney)}</p>
            {i < plan.legs.length - 1 && (
              <p className="my-0.5 pl-2 text-base leading-none text-asphalt/35">
                ↓
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-2 border-t border-asphalt/10 pt-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            {plan.jobs.length} jobs to bid on
          </p>
          <p className="font-semibold text-asphalt">
            Potential revenue {formatMoney(plan.revenue)}
          </p>
        </div>
        <div className="text-muted">
          <p>Estimated miles {plan.totalMiles}</p>
          <p>Empty miles {plan.emptyMiles} ({plan.emptyPct.toFixed(1)}%)</p>
          <p className="font-medium text-asphalt">
            Revenue / mile {formatMoney(plan.revenuePerMile)}
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-xs text-muted">
        {plan.risks.map((r) => (
          <li key={r}>! {r}</li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        {hrefs.map((j) => (
          <ShiplyLink
            key={j.id}
            href={j.href!}
            className="rounded-sm bg-amber px-3 py-2 text-[11px] font-semibold tracking-wide text-asphalt uppercase"
          >
            Bid · {j.item || "Job"} →
          </ShiplyLink>
        ))}
        <a
          href="/run"
          className="rounded-sm border border-asphalt/20 px-3 py-2 text-[11px] font-semibold tracking-wide uppercase"
        >
          Open in Build My Run →
        </a>
      </div>
    </article>
  );
}
