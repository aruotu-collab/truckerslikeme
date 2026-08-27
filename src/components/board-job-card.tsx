"use client";

import { JobBidField } from "@/components/job-bid-field";
import { ShiplyLink } from "@/components/shiply-link";
import { boardJobSnapshot } from "@/lib/board-job-decision";
import {
  mapStatusMeta,
  shortPlace,
  type JobsMapDriver,
  type MapJob,
  type MapJobStatus,
} from "@/lib/jobs-map";
import { useMarket } from "@/lib/market-context";

type BoardJobCardProps = {
  job: MapJob;
  driver: JobsMapDriver | null;
  onSetBid: (myBid: number | null) => void;
  onMarkWon?: () => void;
  onRemove?: () => void;
};

export function BoardJobCard({
  job,
  driver,
  onSetBid,
  onMarkWon,
  onRemove,
}: BoardJobCardProps) {
  const { money, market } = useMarket();
  const meta = mapStatusMeta[job.status as MapJobStatus];
  const snap = boardJobSnapshot(job, driver, market);
  const d = snap.decision;

  return (
    <li className="flex flex-col gap-3 border-b border-asphalt/10 py-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-asphalt">
            {shortPlace(job.origin)} → {shortPlace(job.destination)}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {[
              job.item,
              snap.loadedMiles != null
                ? `${snap.loadedMiles} mi loaded`
                : null,
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

      <div className="mt-0">
        <JobBidField
          compact
          value={job.myBid}
          miles={snap.loadedMiles}
          onChange={onSetBid}
        />
      </div>

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
                Net / mi
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
            Enter a quote to see if it pays
          </p>
          <p className="mt-1 text-sm text-muted">
            Suggested around{" "}
            <span className="font-semibold text-asphalt">
              {money(snap.suggestion.suggested)}
            </span>
            {" · "}
            floor ~{money(snap.suggestion.floor)} after Shiply fee, empty
            miles
            {snap.deadheadMiles != null ? ` (~${snap.deadheadMiles} mi)` : ""},
            and costs.
          </p>
        </div>
      ) : (
        <div className="border-l-4 border-asphalt/15 bg-concrete/30 px-3 py-2.5 text-sm text-muted">
          Need recognisable towns (and a start location) to estimate empty
          miles and profit.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {job.status !== "won" && onMarkWon && (
          <button
            type="button"
            onClick={onMarkWon}
            className="rounded-sm bg-[#2f6b4f] px-3 py-1.5 text-[10px] font-semibold tracking-wide text-white uppercase"
          >
            I got this
          </button>
        )}
        {job.href ? (
          <ShiplyLink
            href={job.href}
            className="text-[11px] font-semibold tracking-wide text-amber uppercase"
          >
            Shiply →
          </ShiplyLink>
        ) : null}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-[11px] font-semibold tracking-wide text-alert uppercase"
          >
            Remove
          </button>
        )}
      </div>
    </li>
  );
}
