"use client";

import Link from "next/link";
import { JobBidField } from "@/components/job-bid-field";
import { ShiplyLink } from "@/components/shiply-link";
import { boardJobSnapshot } from "@/lib/board-job-decision";
import {
  mapStatusMeta,
  shortPlace,
  hasMyBid,
  type JobsMapDriver,
  type MapJob,
  type MapJobStatus,
} from "@/lib/jobs-map";
import {
  bestNextAfterJob,
  fitToneClass,
} from "@/lib/jobs-today-run";
import { useMarket } from "@/lib/market-context";
import { outlineBtnClass } from "@/lib/ui-buttons";

type BoardJobCardProps = {
  job: MapJob;
  driver: JobsMapDriver | null;
  allJobs: MapJob[];
  onSetBid: (myBid: number | null) => void;
  onStartBidding?: () => void;
  onHide?: () => void;
  onFocusJob?: (jobId: string) => void;
};

export function BoardJobCard({
  job,
  driver,
  allJobs,
  onSetBid,
  onStartBidding,
  onHide,
  onFocusJob,
}: BoardJobCardProps) {
  const { money, market } = useMarket();
  const meta = mapStatusMeta[job.status as MapJobStatus];
  const snap = boardJobSnapshot(job, driver, market);
  const d = snap.decision;
  const next = bestNextAfterJob(job, allJobs, driver);
  const canStartBidding = hasMyBid(job) && onStartBidding;

  return (
    <li
      id={`board-job-${job.id}`}
      className="flex scroll-mt-[calc(var(--site-header-h)+7rem)] flex-col gap-3 border-b border-asphalt/10 py-4 last:border-b-0"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-asphalt">
            {shortPlace(job.origin)} → {shortPlace(job.destination)}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {[
              job.item,
              snap.loadedMiles != null ? `${snap.loadedMiles} mi loaded` : null,
              snap.deadheadMiles != null
                ? `~${snap.deadheadMiles} mi empty from you`
                : driver?.label
                  ? "Empty miles unknown (place not mapped)"
                  : "Set start location for empty miles",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-sm border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${meta.soft}`}
        >
          {meta.label}
        </span>
      </div>

      <JobBidField
        compact
        value={job.myBid}
        miles={snap.loadedMiles}
        onChange={onSetBid}
      />

      {d && snap.verdict ? (
        <div
          className={`border-l-4 px-3 py-2.5 ${
            d.verdict === "strong"
              ? "border-emerald-600 bg-emerald-50"
              : d.verdict === "ok"
                ? "border-amber bg-amber/10"
                : d.verdict === "weak"
                  ? "border-amber bg-amber/15"
                  : "border-alert bg-red-50"
          }`}
        >
          <p className="text-xs font-semibold tracking-wide text-asphalt uppercase">
            {snap.verdict.title}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            This job only — from where you are now, including empty miles and
            Shiply fee. Not your day rate or a full chain.
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
            <div>
              <dt className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                After fee
              </dt>
              <dd className="text-sm font-semibold tabular-nums text-asphalt">
                {money(d.netToDriver)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                Est. net
              </dt>
              <dd
                className={`text-sm font-semibold tabular-nums ${
                  d.estimatedNet < 0 ? "text-alert" : "text-asphalt"
                }`}
              >
                {money(d.estimatedNet)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                Net / mi this trip
              </dt>
              <dd className="text-sm font-semibold tabular-nums text-asphalt">
                {money(d.netPerMile)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                All miles
              </dt>
              <dd className="text-sm font-semibold tabular-nums text-asphalt">
                {Math.round(d.totalMiles)} mi
                {snap.deadheadMiles != null
                  ? ` (${snap.deadheadMiles} empty)`
                  : ""}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">{d.summary}</p>
        </div>
      ) : snap.suggestion ? (
        <div className="border-l-4 border-asphalt/20 bg-concrete/40 px-3 py-2.5">
          <p className="text-xs font-semibold tracking-wide text-asphalt uppercase">
            Suggested quote for this job
          </p>
          <p className="mt-1 text-sm text-muted">
            Around{" "}
            <span className="font-semibold text-asphalt">
              {money(snap.suggestion.suggested)}
            </span>
            {" · "}
            floor ~{money(snap.suggestion.floor)} after Shiply fee, empty miles
            {snap.deadheadMiles != null ? ` (~${snap.deadheadMiles} mi)` : ""},
            and costs — not a general rate.
          </p>
        </div>
      ) : (
        <div className="border-l-4 border-asphalt/15 bg-concrete/30 px-3 py-2.5 text-sm text-muted">
          Need recognisable towns (and a start location) to estimate empty miles
          and profit.
        </div>
      )}

      {next && (
        <div className="rounded-sm border border-asphalt/10 bg-white px-3 py-2 text-xs">
          <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
            Best next after this drop
          </p>
          <p className="mt-1 text-asphalt">
            <span className="font-medium">{next.route}</span>
            {" · "}
            {next.deadheadMi} mi empty
            {" · "}
            <span className={fitToneClass(next.fit.tone)}>
              {next.fit.emoji} {next.fit.label}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {onFocusJob && (
              <button
                type="button"
                onClick={() => onFocusJob(next.job.id)}
                className="rounded-sm border border-asphalt/20 px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase"
              >
                Show on board
              </button>
            )}
            {next.job.href ? (
              <ShiplyLink href={next.job.href} size="sm" />
            ) : null}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canStartBidding && (
          <button
            type="button"
            onClick={onStartBidding}
            className="rounded-sm bg-amber px-3 py-1.5 text-[10px] font-semibold tracking-wide text-asphalt uppercase"
          >
            Start bidding →
          </button>
        )}
        {job.href ? <ShiplyLink href={job.href} /> : null}
        {onHide && (
          <button
            type="button"
            onClick={onHide}
            className={outlineBtnClass("muted")}
          >
            Hide
          </button>
        )}
      </div>
      <p className="text-[10px] text-muted">
        Tap <strong className="font-semibold text-asphalt">Start bidding</strong>{" "}
        when you&apos;re chasing this quote — it moves to{" "}
        <Link
          href="/jobs?tab=bidding"
          className="font-semibold text-asphalt hover:text-amber"
        >
          My Jobs → Bidding
        </Link>{" "}
        and leaves Hunt.
      </p>
    </li>
  );
}
