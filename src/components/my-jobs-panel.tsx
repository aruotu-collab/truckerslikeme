"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { JobBidField } from "@/components/job-bid-field";
import { ShiplyLink } from "@/components/shiply-link";
import { useMarket } from "@/lib/market-context";
import {
  countMyJobs,
  filterMyJobs,
  mapStatusMeta,
  readJobsMapState,
  shortPlace,
  writeJobsMapState,
  type MapJob,
  type MapJobStatus,
  type MyJobsFilter,
} from "@/lib/jobs-map";

const FILTERS: { id: MyJobsFilter; label: string }[] = [
  { id: "bidding", label: "Bidding" },
  { id: "won", label: "Won" },
  { id: "considering", label: "Considering" },
  { id: "skipped", label: "Skipped" },
];

export function MyJobsPanel() {
  const { money } = useMarket();
  const [jobs, setJobs] = useState<MapJob[]>([]);
  const [filter, setFilter] = useState<MyJobsFilter>("bidding");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setJobs(readJobsMapState().jobs);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const prev = readJobsMapState();
    writeJobsMapState({ ...prev, jobs });
  }, [jobs, hydrated]);

  const counts = countMyJobs(jobs);
  const visible = filterMyJobs(jobs, filter);

  function setStatus(id: string, status: MapJobStatus) {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, status, updatedAt: new Date().toISOString() }
          : j,
      ),
    );
  }

  function setMyBid(id: string, myBid: number | null) {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, myBid, updatedAt: new Date().toISOString() }
          : j,
      ),
    );
  }

  function removeJob(id: string) {
    const job = jobs.find((j) => j.id === id);
    const route = job
      ? `${shortPlace(job.origin)} → ${shortPlace(job.destination)}`
      : "this job";
    const ok = window.confirm(
      `Remove ${route} permanently?\n\nThis cannot be undone. Use Skip if you might want it again.`,
    );
    if (!ok) return;
    setJobs((prev) => prev.filter((j) => j.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
          My jobs
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-wide text-asphalt uppercase sm:text-5xl">
          Your bids & wins
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Track what you&apos;ve quoted, what you&apos;ve won, and what still
          needs a decision. Revenue on Map Jobs and Build My Run uses your bids
          only — not Shiply&apos;s scraped amounts.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-sm px-4 py-2.5 text-xs font-semibold tracking-wide uppercase ${
              filter === f.id
                ? "bg-amber text-asphalt"
                : "border border-asphalt/15 bg-white text-asphalt hover:border-amber"
            }`}
          >
            {f.label}
            <span className="ml-1.5 opacity-70">{counts[f.id]}</span>
          </button>
        ))}
        <Link
          href="/map"
          className="ml-auto rounded-sm border border-asphalt/15 bg-white px-4 py-2.5 text-xs font-semibold tracking-wide text-asphalt uppercase hover:border-amber"
        >
          Hunt more on Map Jobs →
        </Link>
      </div>

      {!hydrated ? (
        <p className="text-sm text-muted">Loading your jobs…</p>
      ) : !visible.length ? (
        <div className="border border-asphalt/10 bg-white px-5 py-8 text-center">
          <p className="font-display text-lg tracking-wide text-asphalt uppercase">
            Nothing here yet
          </p>
          <p className="mt-2 text-sm text-muted">
            {filter === "won"
              ? "When Shiply accepts a bid, mark the job as won here."
              : filter === "bidding"
                ? "Enter your quote on jobs from Map Jobs — they appear here when you're bidding."
                : filter === "skipped"
                  ? "Skipped and Hidden jobs land here — restore one to bid again, or remove it for good."
                  : "Scan Shiply on Map Jobs and add jobs to your board first."}
          </p>
          <Link
            href="/map"
            className="mt-4 inline-block rounded-sm bg-amber px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase"
          >
            Open Map Jobs
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((job) => {
            const meta = mapStatusMeta[job.status];
            const active = job.id === selectedId;
            return (
              <li
                key={job.id}
                className={`border px-4 py-3 transition ${
                  active
                    ? "border-asphalt bg-white"
                    : "border-asphalt/10 bg-white/80 hover:border-asphalt/25"
                }`}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setSelectedId(job.id)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-asphalt">
                        {shortPlace(job.origin)} →{" "}
                        {shortPlace(job.destination)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {[
                          job.item,
                          job.miles != null ? `${job.miles} mi` : null,
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
                </button>

                {filter !== "won" && filter !== "skipped" && (
                  <div className="mt-3">
                    <JobBidField
                      value={job.myBid}
                      miles={job.miles}
                      onChange={(myBid) => {
                        setMyBid(job.id, myBid);
                        if (
                          myBid != null &&
                          myBid > 0 &&
                          job.status === "hunting"
                        ) {
                          setStatus(job.id, "bidding");
                        }
                      }}
                    />
                  </div>
                )}

                {filter === "won" && job.myBid != null && job.myBid > 0 && (
                  <p className="mt-2 text-sm font-medium text-asphalt">
                    Won at {money(job.myBid)}
                    {job.miles != null && job.miles > 0
                      ? ` · ${money(job.myBid / job.miles)}/mi`
                      : ""}
                  </p>
                )}

                {filter === "skipped" && job.myBid != null && job.myBid > 0 && (
                  <p className="mt-2 text-sm text-muted">
                    Last quote {money(job.myBid)}
                    {job.miles != null && job.miles > 0
                      ? ` · ${money(job.myBid / job.miles)}/mi`
                      : ""}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {filter === "skipped" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setStatus(job.id, "hunting")}
                        className="rounded-sm bg-amber px-3 py-1.5 text-[11px] font-semibold tracking-wide text-asphalt uppercase"
                      >
                        Restore
                      </button>
                      {job.href ? (
                        <ShiplyLink
                          href={job.href}
                          className="rounded-sm border border-asphalt/20 px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase hover:bg-concrete/40"
                        >
                          Open on Shiply →
                        </ShiplyLink>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeJob(job.id)}
                        className="rounded-sm px-3 py-1.5 text-[11px] font-semibold tracking-wide text-alert uppercase"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <>
                  {job.href ? (
                    <ShiplyLink
                      href={job.href}
                      className="rounded-sm border border-asphalt/20 px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase hover:bg-concrete/40"
                    >
                      Open on Shiply →
                    </ShiplyLink>
                  ) : null}
                  {job.status !== "won" && job.status !== "bidding" && (
                    <button
                      type="button"
                      onClick={() => setStatus(job.id, "bidding")}
                      className="rounded-sm bg-amber px-3 py-1.5 text-[11px] font-semibold tracking-wide text-asphalt uppercase"
                    >
                      Mark bidding
                    </button>
                  )}
                  {job.status !== "won" && (
                    <button
                      type="button"
                      onClick={() => setStatus(job.id, "won")}
                      className="rounded-sm bg-[#2f6b4f] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white uppercase"
                    >
                      I got this
                    </button>
                  )}
                  {job.status === "won" && (
                    <button
                      type="button"
                      onClick={() => setStatus(job.id, "hunting")}
                      className="rounded-sm border border-asphalt/20 px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase"
                    >
                      Back to hunt
                    </button>
                  )}
                  {job.status === "bidding" && (
                    <button
                      type="button"
                      onClick={() => setStatus(job.id, "hunting")}
                      className="rounded-sm border border-asphalt/15 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase"
                    >
                      Still considering
                    </button>
                  )}
                  {job.status !== "skipped" && (
                    <button
                      type="button"
                      onClick={() => setStatus(job.id, "skipped")}
                      className="rounded-sm border border-asphalt/15 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase"
                    >
                      Skip
                    </button>
                  )}
                  <Link
                    href="/run"
                    className="rounded-sm border border-asphalt/15 px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase"
                  >
                    Build run
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeJob(job.id)}
                    className="rounded-sm px-3 py-1.5 text-[11px] font-semibold tracking-wide text-alert uppercase"
                  >
                    Remove
                  </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
