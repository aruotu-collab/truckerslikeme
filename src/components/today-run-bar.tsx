"use client";

import {
  evaluateRunChain,
  orderTodayRun,
  positionsDiffer,
  type RunChainNet,
} from "@/lib/jobs-today-run";
import { shortPlace, type JobsMapDriver, type MapJob } from "@/lib/jobs-map";
import { useMarket } from "@/lib/market-context";

type TodayRunBarProps = {
  jobs: MapJob[];
  todayRunIds: string[];
  home: JobsMapDriver | null;
  driver: JobsMapDriver | null;
  onResetToHome: () => void;
  onOpenRun: () => void;
  onRemoveFromRun?: (jobId: string) => void;
};

export function TodayRunBar({
  jobs,
  todayRunIds,
  home,
  driver,
  onResetToHome,
  onOpenRun,
  onRemoveFromRun,
}: TodayRunBarProps) {
  const { money, market } = useMarket();
  const chain = orderTodayRun(todayRunIds, jobs);
  const net: RunChainNet | null = evaluateRunChain(chain, home, market);
  const awayFromHome = positionsDiffer(home, driver);

  if (!home?.label?.trim() && chain.length === 0) return null;

  const pathLabel = [
    home?.label ? shortPlace(home.label) : null,
    ...chain.map(
      (j) =>
        `${shortPlace(j.origin)}→${shortPlace(j.destination)}${
          j.status === "won" ? " ✓" : ""
        }`,
    ),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="border border-amber/50 bg-[#fff8e8] px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-xs tracking-[0.14em] text-amber uppercase">
            Today&apos;s run
          </p>
          <p className="mt-1 text-sm font-medium text-asphalt">
            {chain.length === 0
              ? "No jobs in the chain yet — mark wins or add from the board."
              : pathLabel}
          </p>
          {awayFromHome && driver?.label ? (
            <p className="mt-1 text-xs text-muted">
              Now at{" "}
              <span className="font-semibold text-asphalt">
                {shortPlace(driver.label)}
              </span>{" "}
              after your last win — open jobs use empty miles from here.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {awayFromHome && (
            <button
              type="button"
              onClick={onResetToHome}
              className="rounded-sm border border-asphalt/20 px-3 py-1.5 text-[10px] font-semibold tracking-wide uppercase"
            >
              Reset to home
            </button>
          )}
          <button
            type="button"
            onClick={onOpenRun}
            className="rounded-sm bg-asphalt px-3 py-1.5 text-[10px] font-semibold tracking-wide text-white uppercase"
          >
            My run →
          </button>
        </div>
      </div>

      {net && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-5">
          <div>
            <dt className="text-[10px] font-semibold tracking-wide text-muted uppercase">
              Jobs
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-asphalt">
              {net.jobCount}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold tracking-wide text-muted uppercase">
              After fees
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-asphalt">
              {money(net.afterFee)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold tracking-wide text-muted uppercase">
              Est. net
            </dt>
            <dd
              className={`text-sm font-semibold tabular-nums ${
                net.estimatedNet < 0 ? "text-alert" : "text-asphalt"
              }`}
            >
              {money(net.estimatedNet)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold tracking-wide text-muted uppercase">
              Net / mi
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-asphalt">
              {money(net.netPerMile)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold tracking-wide text-muted uppercase">
              Empty
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-asphalt">
              {net.emptyMiles} mi
            </dd>
          </div>
        </dl>
      )}

      {chain.length > 0 && onRemoveFromRun && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {chain.map((j, i) => (
            <li
              key={j.id}
              className="inline-flex items-center gap-1.5 rounded-sm border border-asphalt/15 bg-white px-2 py-1 text-[11px]"
            >
              <span className="font-mono text-[10px] text-amber">{i + 1}</span>
              <span className="text-asphalt">
                {shortPlace(j.origin)}→{shortPlace(j.destination)}
              </span>
              {j.status === "won" ? (
                <span className="text-[10px] font-semibold text-emerald-700 uppercase">
                  Won
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => onRemoveFromRun(j.id)}
                className="rounded-sm border border-alert/30 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-alert uppercase hover:bg-red-100"
                aria-label={`Remove ${shortPlace(j.origin)} to ${shortPlace(j.destination)} from today's run`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-[11px] text-muted">
        Chain maths — fee, fuel, and running cost for the whole day plan, not
        one job in isolation.
      </p>
    </section>
  );
}
