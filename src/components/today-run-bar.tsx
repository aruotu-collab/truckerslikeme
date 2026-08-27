"use client";

import Link from "next/link";
import { JobBidField } from "@/components/job-bid-field";
import { ShiplyLink } from "@/components/shiply-link";
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
  hiddenCount?: number;
  highlightHidden?: boolean;
  onResetToHome: () => void;
  onOpenRun: () => void;
  onShowHidden?: () => void;
  onRemoveFromRun?: (jobId: string) => void;
  onMarkDelivered?: (jobId: string) => void;
  onMarkWon?: (jobId: string) => void;
  onSetBid?: (jobId: string, myBid: number | null) => void;
};

export function TodayRunBar({
  jobs,
  todayRunIds,
  home,
  driver,
  hiddenCount = 0,
  highlightHidden = false,
  onResetToHome,
  onOpenRun,
  onShowHidden,
  onRemoveFromRun,
  onMarkDelivered,
  onMarkWon,
  onSetBid,
}: TodayRunBarProps) {
  const { money, market } = useMarket();
  const chain = orderTodayRun(todayRunIds, jobs);
  const net: RunChainNet | null = evaluateRunChain(chain, home, market);
  const awayFromHome = positionsDiffer(home, driver);

  if (!home?.label?.trim() && chain.length === 0 && hiddenCount === 0) return null;

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
              ? "No jobs in the chain yet — add from the board, My run, or My Jobs → Won."
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
          {hiddenCount > 0 && onShowHidden && (
            <button
              type="button"
              onClick={onShowHidden}
              className={`rounded-sm border px-3 py-1.5 text-[10px] font-semibold tracking-wide uppercase ${
                highlightHidden
                  ? "border-amber bg-amber/15 text-asphalt"
                  : "border-asphalt/20 bg-white text-asphalt hover:border-amber/50 hover:bg-amber/10"
              }`}
              aria-label={`Show ${hiddenCount} hidden jobs`}
            >
              Hidden jobs ({hiddenCount})
            </button>
          )}
          {awayFromHome && (
            <button
              type="button"
              onClick={onResetToHome}
              className="rounded-sm border border-asphalt/20 px-3 py-1.5 text-[10px] font-semibold tracking-wide uppercase"
            >
              Reset to home
            </button>
          )}
          <Link
            href="/jobs?tab=won"
            className="rounded-sm border border-asphalt/20 bg-white px-3 py-1.5 text-[10px] font-semibold tracking-wide uppercase"
          >
            My Jobs →
          </Link>
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

      {chain.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-amber/30 pt-3">
          {chain.map((j, i) => (
            <li
              key={j.id}
              className="border border-asphalt/15 bg-white px-3 py-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-asphalt">
                    <span className="mr-1.5 font-mono text-[10px] text-amber">
                      {i + 1}
                    </span>
                    {shortPlace(j.origin)} → {shortPlace(j.destination)}
                    {j.status === "won" ? (
                      <span className="ml-2 text-[10px] font-semibold text-emerald-700 uppercase">
                        Won
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>

              {onSetBid && j.status !== "won" && j.status !== "delivered" && (
                <div className="mt-2">
                  <JobBidField
                    compact
                    value={j.myBid}
                    miles={j.miles}
                    onChange={(myBid) => onSetBid(j.id, myBid)}
                  />
                </div>
              )}

              {j.status === "won" && j.myBid != null && j.myBid > 0 && (
                <p className="mt-1 text-xs text-muted">
                  Won at {money(j.myBid)}
                </p>
              )}

              <div className="mt-2 flex flex-wrap gap-2">
                {j.href ? (
                  <ShiplyLink
                    href={j.href}
                    className="rounded-sm bg-amber px-2.5 py-1 text-[10px] font-semibold tracking-wide text-asphalt uppercase"
                  >
                    Bid on Shiply →
                  </ShiplyLink>
                ) : null}
                {onMarkWon && j.status !== "won" && j.status !== "delivered" && (
                  <button
                    type="button"
                    onClick={() => onMarkWon(j.id)}
                    className="rounded-sm bg-[#2f6b4f] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white uppercase"
                  >
                    I got this
                  </button>
                )}
                {onMarkDelivered && j.status === "won" && (
                  <button
                    type="button"
                    onClick={() => onMarkDelivered(j.id)}
                    className="rounded-sm border border-sky-600/30 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold text-sky-900 uppercase"
                  >
                    Delivered
                  </button>
                )}
                {onRemoveFromRun && (
                  <button
                    type="button"
                    onClick={() => onRemoveFromRun(j.id)}
                    className="rounded-sm border border-alert/30 bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-alert uppercase"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-[11px] text-muted">
        Today&apos;s run is your bid/win queue for the day. Suggested chains live
        under My run — use{" "}
        <button
          type="button"
          onClick={onOpenRun}
          className="font-semibold text-amber uppercase hover:text-asphalt"
        >
          My run →
        </button>{" "}
        then push a chain here. Wins also sync to{" "}
        <Link
          href="/jobs?tab=won"
          className="font-semibold text-amber hover:text-asphalt"
        >
          My Jobs → Won
        </Link>
        .
      </p>
    </section>
  );
}
