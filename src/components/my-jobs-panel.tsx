"use client";

import { useEffect, useMemo, useState } from "react";
import { JobBidField } from "@/components/job-bid-field";
import { ShiplyLink } from "@/components/shiply-link";
import { useMarket } from "@/lib/market-context";
import {
  addJobsToTodayRun,
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
  { id: "considering", label: "Considering" },
  { id: "bidding", label: "Bidding" },
  { id: "won", label: "Won" },
  { id: "delivered", label: "Delivered" },
  { id: "skipped", label: "Hidden" },
];

function isMyJobsFilter(v: string | null): v is MyJobsFilter {
  return (
    v === "bidding" ||
    v === "won" ||
    v === "considering" ||
    v === "delivered" ||
    v === "skipped"
  );
}

export function MyJobsPanel() {
  const { money } = useMarket();
  const [jobs, setJobs] = useState<MapJob[]>([]);
  const [todayRunIds, setTodayRunIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<MyJobsFilter>("bidding");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [runNote, setRunNote] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = readJobsMapState();
    setJobs(loaded.jobs);
    setTodayRunIds(loaded.todayRunIds ?? []);
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (isMyJobsFilter(tab)) setFilter(tab);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const prev = readJobsMapState();
    writeJobsMapState({ ...prev, jobs, todayRunIds });
  }, [jobs, todayRunIds, hydrated]);

  const counts = countMyJobs(jobs);
  const visible = filterMyJobs(jobs, filter);
  const wonJobs = useMemo(() => filterMyJobs(jobs, "won"), [jobs]);

  function setStatus(id: string, status: MapJobStatus) {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, status, updatedAt: new Date().toISOString() }
          : j,
      ),
    );
    if (status === "delivered" || status === "skipped") {
      setTodayRunIds((ids) => ids.filter((x) => x !== id));
    }
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

  function requestRemove(id: string) {
    setPendingRemoveId(id);
  }

  function confirmRemove() {
    if (!pendingRemoveId) return;
    const id = pendingRemoveId;
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setTodayRunIds((ids) => ids.filter((x) => x !== id));
    if (selectedId === id) setSelectedId(null);
    setPendingRemoveId(null);
  }

  function addWonToTodayRun(id: string) {
    const ids = addJobsToTodayRun([id]);
    setTodayRunIds(ids);
    setRunNote("Added to today's run.");
  }

  function planAllWonJobs() {
    if (!wonJobs.length) return;
    const before = todayRunIds.length;
    const ids = addJobsToTodayRun(wonJobs.map((j) => j.id));
    setTodayRunIds(ids);
    const added = ids.length - before;
    setRunNote(
      added > 0
        ? `Added ${added} won job${added === 1 ? "" : "s"} to today's run (${ids.length} total).`
        : `All won jobs were already in today's run (${ids.length} total).`,
    );
  }

  const pendingRemoveJob = pendingRemoveId
    ? jobs.find((j) => j.id === pendingRemoveId) ?? null
    : null;

  const emptyCopy =
    filter === "won"
      ? "When Shiply accepts a bid, mark it won here — then add it to today's run (appends to the queue)."
      : filter === "bidding"
        ? "Jobs land here when you tap Start bidding on the Job Board Hunt tab."
        : filter === "skipped"
          ? "Hidden jobs land here — restore one to bid again, or remove it for good."
          : filter === "delivered"
            ? "Mark a won job delivered when you've dropped it — they'll show here."
            : "New scans appear here as Considering — evaluate on Job Board Hunt first.";

  return (
    <div className="space-y-8">
      <section>
        <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
          Tracker
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-wide text-asphalt uppercase sm:text-5xl">
          My Jobs
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Track each job: Considering → Bidding → Won → Delivered. Use Job Board
          Hunt to evaluate new scans; start bidding here when you&apos;re ready
          to chase a quote on Shiply.
        </p>
      </section>

      <div className="page-sticky-bar -mx-5 flex min-w-0 flex-wrap gap-2 border-b border-asphalt/10 px-5 py-2.5 sm:-mx-8 sm:px-8">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFilter(f.id);
              setRunNote(null);
            }}
            className={`rounded-sm px-3 py-2 text-[11px] font-semibold tracking-wide uppercase sm:px-4 sm:py-2.5 sm:text-xs ${
              filter === f.id
                ? "bg-amber text-asphalt"
                : "border border-asphalt/15 bg-white text-asphalt hover:border-amber"
            }`}
          >
            {f.label}
            <span className="ml-1.5 opacity-70">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {filter === "won" && wonJobs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm text-asphalt">
            {wonJobs.length} won job{wonJobs.length === 1 ? "" : "s"} — add to
            today&apos;s run (appends to any chain you already queued).
          </p>
          <button
            type="button"
            onClick={planAllWonJobs}
            className="rounded-sm bg-asphalt px-4 py-2 text-xs font-semibold tracking-wide text-white uppercase"
          >
            Add all won to run
          </button>
        </div>
      )}

      {runNote && (
        <p
          role="status"
          className="border border-amber/40 bg-amber/10 px-4 py-2.5 text-sm text-asphalt"
        >
          {runNote}
        </p>
      )}

      {!hydrated ? (
        <p className="text-sm text-muted">Loading your jobs…</p>
      ) : !visible.length ? (
        <div className="border border-asphalt/10 bg-white px-5 py-8 text-center">
          <p className="font-display text-lg tracking-wide text-asphalt uppercase">
            Nothing here yet
          </p>
          <p className="mt-2 text-sm text-muted">{emptyCopy}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((job) => {
            const meta = mapStatusMeta[job.status];
            const active = job.id === selectedId;
            const inRun = todayRunIds.includes(job.id);
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
                          inRun && job.status === "won" ? "In today’s run" : null,
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

                {filter !== "won" &&
                  filter !== "skipped" &&
                  filter !== "delivered" && (
                    <div className="mt-3">
                      <JobBidField
                        value={job.myBid}
                        miles={job.miles}
                        onChange={(myBid) => setMyBid(job.id, myBid)}
                      />
                    </div>
                  )}

                {(filter === "won" || filter === "delivered") &&
                  job.myBid != null &&
                  job.myBid > 0 && (
                    <p className="mt-2 text-sm font-medium text-asphalt">
                      {filter === "delivered" ? "Done at" : "Won at"}{" "}
                      {money(job.myBid)}
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
                  {filter === "skipped" && (
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
                        onClick={() => requestRemove(job.id)}
                        className="rounded-sm px-3 py-1.5 text-[11px] font-semibold tracking-wide text-alert uppercase"
                      >
                        Remove
                      </button>
                    </>
                  )}

                  {filter === "delivered" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setStatus(job.id, "won")}
                        className="rounded-sm border border-asphalt/20 px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase"
                      >
                        Back to won
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
                        onClick={() => requestRemove(job.id)}
                        className="rounded-sm px-3 py-1.5 text-[11px] font-semibold tracking-wide text-alert uppercase"
                      >
                        Remove
                      </button>
                    </>
                  )}

                  {filter === "won" && (
                    <>
                      {!inRun ? (
                        <button
                          type="button"
                          onClick={() => addWonToTodayRun(job.id)}
                          className="rounded-sm bg-asphalt px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white uppercase"
                        >
                          Add to today&apos;s run
                        </button>
                      ) : (
                        <span className="rounded-sm border border-emerald-600/40 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-emerald-900 uppercase">
                          In today&apos;s run
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setStatus(job.id, "delivered")}
                        className="rounded-sm bg-[#4a6f86] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white uppercase"
                      >
                        Mark delivered
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus(job.id, "bidding")}
                        className="rounded-sm border border-asphalt/20 px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase"
                      >
                        Back to bidding
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus(job.id, "hunting")}
                        className="rounded-sm border border-asphalt/20 px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase"
                      >
                        Back to considering
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
                        onClick={() => requestRemove(job.id)}
                        className="rounded-sm px-3 py-1.5 text-[11px] font-semibold tracking-wide text-alert uppercase"
                      >
                        Remove
                      </button>
                    </>
                  )}

                  {filter !== "won" &&
                    filter !== "skipped" &&
                    filter !== "delivered" && (
                      <>
                        {job.href ? (
                          <ShiplyLink
                            href={job.href}
                            className="rounded-sm border border-asphalt/20 px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase hover:bg-concrete/40"
                          >
                            Open on Shiply →
                          </ShiplyLink>
                        ) : null}
                        {job.status === "bidding" && (
                          <button
                            type="button"
                            onClick={() => setStatus(job.id, "hunting")}
                            className="rounded-sm border border-asphalt/20 px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase"
                          >
                            Back to considering
                          </button>
                        )}
                        {job.status === "hunting" && (
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
                            onClick={() => {
                              setStatus(job.id, "won");
                              addWonToTodayRun(job.id);
                            }}
                            className="rounded-sm bg-[#2f6b4f] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white uppercase"
                          >
                            I got this
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setStatus(job.id, "skipped")}
                          className="rounded-sm border border-asphalt/15 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase"
                        >
                          Skip
                        </button>
                        <button
                          type="button"
                          onClick={() => requestRemove(job.id)}
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

      {pendingRemoveJob && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-asphalt/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-job-title"
          onClick={() => setPendingRemoveId(null)}
        >
          <div
            className="animate-slide-up w-full max-w-md border border-asphalt/10 bg-background p-6 shadow-2xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-xs tracking-[0.2em] text-alert uppercase">
              Remove job
            </p>
            <h2
              id="remove-job-title"
              className="mt-2 font-display text-2xl tracking-wide text-asphalt uppercase"
            >
              Are you sure?
            </h2>
            <p className="mt-3 text-sm text-muted">
              Remove{" "}
              <span className="font-semibold text-asphalt">
                {shortPlace(pendingRemoveJob.origin)} →{" "}
                {shortPlace(pendingRemoveJob.destination)}
              </span>{" "}
              permanently? This cannot be undone. Use Skip if you might want it
              again.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPendingRemoveId(null)}
                className="rounded-sm border border-asphalt/20 bg-white px-4 py-2.5 text-xs font-semibold tracking-wide uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                className="rounded-sm bg-alert px-4 py-2.5 text-xs font-semibold tracking-wide text-white uppercase"
              >
                Remove permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
