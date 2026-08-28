"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { JobBidField } from "@/components/job-bid-field";
import { ShiplyLink } from "@/components/shiply-link";
import { outlineBtnAlertClass, outlineBtnClass } from "@/lib/ui-buttons";
import { TodayRunBar } from "@/components/today-run-bar";
import { useMarket } from "@/lib/market-context";
import {
  addJobsToTodayRun,
  countMyJobs,
  filterMyJobs,
  mapStatusMeta,
  readJobsMapState,
  shortPlace,
  sortJobsByRecent,
  writeJobsMapState,
  type JobsMapDriver,
  type MapJob,
  type MapJobStatus,
  type MyJobsFilter,
} from "@/lib/jobs-map";
import {
  appendTodayRunId,
  driverAtJobDrop,
  pruneTodayRunIds,
} from "@/lib/jobs-today-run";

type MyJobsNavTab = MyJobsFilter | "run";

function isMyJobsNavTab(v: string | null): v is MyJobsNavTab {
  return (
    v === "bidding" ||
    v === "won" ||
    v === "delivered" ||
    v === "skipped" ||
    v === "run"
  );
}

function MyJobsStickyNav({
  counts,
  todayRunCount,
  activeTab,
  onSelectTab,
  onScrollToRun,
}: {
  counts: ReturnType<typeof countMyJobs>;
  todayRunCount: number;
  activeTab: MyJobsNavTab;
  onSelectTab: (tab: MyJobsFilter) => void;
  onScrollToRun: () => void;
}) {
  const pipeline: {
    key: MyJobsFilter | "run" | "board";
    label: string;
    count: number;
  }[] = [
    { key: "board", label: "Job Board", count: counts.considering },
    { key: "bidding", label: "Bidding", count: counts.bidding },
    { key: "won", label: "Won", count: counts.won },
    { key: "run", label: "Today's run", count: todayRunCount },
    { key: "delivered", label: "Delivered", count: counts.delivered },
  ];

  function tabClass(active: boolean, run = false) {
    if (active && run) {
      return "border-amber bg-amber/15 text-asphalt ring-1 ring-amber/40";
    }
    if (active) {
      return "bg-amber text-asphalt ring-1 ring-amber/40";
    }
    return "border border-asphalt/15 bg-white text-asphalt hover:border-amber";
  }

  return (
    <nav
      aria-label="My Jobs pipeline"
      className="page-sticky-bar -mx-5 border-b border-asphalt/10 px-5 py-2.5 sm:-mx-8 sm:px-8"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase sm:text-[11px]">
        {pipeline.map((step, index) => (
          <Fragment key={step.key}>
            {index > 0 ? (
              <span className="text-muted" aria-hidden>
                →
              </span>
            ) : null}
            {step.key === "board" ? (
              <a
                href="/map"
                className={`shrink-0 rounded-sm px-2.5 py-2 sm:px-3 ${tabClass(false)}`}
              >
                {step.label}
                <span className="ml-1 opacity-70">{step.count}</span>
              </a>
            ) : step.key === "run" ? (
              <button
                type="button"
                onClick={onScrollToRun}
                aria-current={activeTab === "run" ? "page" : undefined}
                className={`shrink-0 rounded-sm px-2.5 py-2 sm:px-3 ${tabClass(activeTab === "run", true)}`}
              >
                {step.label}
                <span className="ml-1 opacity-70">{step.count}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSelectTab(step.key as MyJobsFilter)}
                aria-current={activeTab === step.key ? "page" : undefined}
                className={`shrink-0 rounded-sm px-2.5 py-2 sm:px-3 ${tabClass(activeTab === step.key)}`}
              >
                {step.label}
                <span className="ml-1 opacity-70">{step.count}</span>
              </button>
            )}
          </Fragment>
        ))}
        <span className="mx-0.5 text-muted" aria-hidden>
          ·
        </span>
        <button
          type="button"
          onClick={() => onSelectTab("skipped")}
          aria-current={activeTab === "skipped" ? "page" : undefined}
          className={`shrink-0 rounded-sm px-2.5 py-2 sm:px-3 ${tabClass(activeTab === "skipped")}`}
        >
          Hidden
          <span className="ml-1 opacity-70">{counts.skipped}</span>
        </button>
      </div>
    </nav>
  );
}

export function MyJobsPanel() {
  const { money } = useMarket();
  const [jobs, setJobs] = useState<MapJob[]>([]);
  const [todayRunIds, setTodayRunIds] = useState<string[]>([]);
  const [home, setHome] = useState<JobsMapDriver | null>(null);
  const [driver, setDriver] = useState<JobsMapDriver | null>(null);
  const [navTab, setNavTab] = useState<MyJobsNavTab>("bidding");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [runNote, setRunNote] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = readJobsMapState();
    setJobs(loaded.jobs);
    setTodayRunIds(loaded.todayRunIds ?? []);
    setHome(loaded.home ?? loaded.driver);
    setDriver(loaded.driver);
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "considering") {
        window.location.replace("/map");
        return;
      }
      if (isMyJobsNavTab(tab)) setNavTab(tab);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const prev = readJobsMapState();
    writeJobsMapState({ ...prev, jobs, todayRunIds, driver, home });
  }, [jobs, todayRunIds, driver, home, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    setTodayRunIds((ids) => {
      const pruned = pruneTodayRunIds(ids, jobs);
      if (
        pruned.length === ids.length &&
        pruned.every((id, index) => id === ids[index])
      ) {
        return ids;
      }
      return pruned;
    });
  }, [jobs, hydrated]);

  const counts = countMyJobs(jobs);
  const listTab = navTab === "run" ? null : navTab;
  const visible = useMemo(
    () =>
      listTab
        ? sortJobsByRecent(filterMyJobs(jobs, listTab))
        : [],
    [jobs, listTab],
  );
  const wonJobs = useMemo(
    () => sortJobsByRecent(filterMyJobs(jobs, "won")),
    [jobs],
  );

  function setStatus(id: string, status: MapJobStatus) {
    const job = jobs.find((j) => j.id === id);
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, status, updatedAt: new Date().toISOString() }
          : j,
      ),
    );
    if (status === "won") {
      setTodayRunIds((ids) => appendTodayRunId(ids, id));
      if (job) {
        const atDrop = driverAtJobDrop(job);
        if (atDrop) setDriver(atDrop);
      }
      setRunNote("Added to today's run.");
    }
    if (status === "delivered" || status === "skipped") {
      setTodayRunIds((ids) => ids.filter((x) => x !== id));
      if (status === "delivered" && job) {
        const atDrop = driverAtJobDrop(job);
        if (atDrop) setDriver(atDrop);
      }
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
    setTodayRunIds((ids) => appendTodayRunId(ids, id));
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

  function removeFromTodayRun(id: string) {
    setTodayRunIds((ids) => ids.filter((x) => x !== id));
  }

  function resetDriverToHome() {
    if (home) setDriver({ ...home });
  }

  function scrollToTodayRun() {
    setNavTab("run");
    setRunNote(null);
    window.setTimeout(() => {
      document
        .getElementById("today-run-bar")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function selectListTab(tab: MyJobsFilter) {
    setNavTab(tab);
    setRunNote(null);
  }

  const pendingRemoveJob = pendingRemoveId
    ? jobs.find((j) => j.id === pendingRemoveId) ?? null
    : null;

  const emptyCopy =
    listTab === "won"
      ? "When Shiply accepts a bid, mark it won here — it lands in Today's run automatically."
      : listTab === "bidding"
        ? "Jobs land here when you tap Start bidding on Job Board (Hunt or Chains)."
        : listTab === "skipped"
          ? "Hidden jobs land here — restore one to bid again, or remove it for good."
          : listTab === "delivered"
            ? "Mark a won job delivered when you've dropped it — they'll show here."
            : "Nothing in this tab.";

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
          Your pipeline after you start bidding: Bidding → Won → Today&apos;s
          run → Delivered. New scans stay on{" "}
          <a href="/map" className="font-semibold text-asphalt hover:text-amber">
            Job Board → Hunt
          </a>{" "}
          until you tap Start bidding.
        </p>
      </section>

      {hydrated ? (
        <>
          <MyJobsStickyNav
            counts={counts}
            todayRunCount={todayRunIds.length}
            activeTab={navTab}
            onSelectTab={selectListTab}
            onScrollToRun={scrollToTodayRun}
          />

          <TodayRunBar
            context="tracker"
            jobs={jobs}
            todayRunIds={todayRunIds}
            home={home}
            driver={driver}
            onResetToHome={resetDriverToHome}
            onOpenRun={() => {
              window.location.href = "/map?tab=suggested";
            }}
            onRemoveFromRun={removeFromTodayRun}
            onMarkDelivered={(id) => setStatus(id, "delivered")}
            onMarkWon={(id) => setStatus(id, "won")}
            onSetBid={setMyBid}
          />
        </>
      ) : null}

      {listTab === "won" && wonJobs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm text-asphalt">
            {wonJobs.length} won job{wonJobs.length === 1 ? "" : "s"} — new wins
            land in Today&apos;s run automatically. Add any older wins you
            missed below.
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
      ) : navTab === "run" ? null : !visible.length ? (
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

                {listTab !== "won" &&
                  listTab !== "skipped" &&
                  listTab !== "delivered" && (
                    <div className="mt-3">
                      <JobBidField
                        value={job.myBid}
                        miles={job.miles}
                        onChange={(myBid) => setMyBid(job.id, myBid)}
                      />
                    </div>
                  )}

                {(listTab === "won" || listTab === "delivered") &&
                  job.myBid != null &&
                  job.myBid > 0 && (
                    <p className="mt-2 text-sm font-medium text-asphalt">
                      {listTab === "delivered" ? "Done at" : "Won at"}{" "}
                      {money(job.myBid)}
                      {job.miles != null && job.miles > 0
                        ? ` · ${money(job.myBid / job.miles)}/mi`
                        : ""}
                    </p>
                  )}

                {listTab === "skipped" && job.myBid != null && job.myBid > 0 && (
                  <p className="mt-2 text-sm text-muted">
                    Last quote {money(job.myBid)}
                    {job.miles != null && job.miles > 0
                      ? ` · ${money(job.myBid / job.miles)}/mi`
                      : ""}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {listTab === "skipped" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setStatus(job.id, "hunting")}
                        className="rounded-sm bg-amber px-3 py-1.5 text-[11px] font-semibold tracking-wide text-asphalt uppercase"
                      >
                        Restore
                      </button>
                      {job.href ? (
                        <ShiplyLink href={job.href} size="sm">
                          Open on Shiply →
                        </ShiplyLink>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => requestRemove(job.id)}
                        className={outlineBtnAlertClass("sm")}
                      >
                        Remove
                      </button>
                    </>
                  )}

                  {listTab === "delivered" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setStatus(job.id, "won")}
                        className={outlineBtnClass("muted")}
                      >
                        Back to won
                      </button>
                      {job.href ? (
                        <ShiplyLink href={job.href} size="sm">
                          Open on Shiply →
                        </ShiplyLink>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => requestRemove(job.id)}
                        className={outlineBtnAlertClass("sm")}
                      >
                        Remove
                      </button>
                    </>
                  )}

                  {listTab === "won" && (
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
                        className={outlineBtnClass("muted")}
                      >
                        Back to bidding
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus(job.id, "hunting")}
                        className={outlineBtnClass("muted")}
                      >
                        Back to considering
                      </button>
                      {job.href ? (
                        <ShiplyLink href={job.href} size="sm">
                          Open on Shiply →
                        </ShiplyLink>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => requestRemove(job.id)}
                        className={outlineBtnAlertClass("sm")}
                      >
                        Remove
                      </button>
                    </>
                  )}

                  {listTab !== "won" &&
                    listTab !== "skipped" &&
                    listTab !== "delivered" && (
                      <>
                        {job.href ? (
                          <ShiplyLink href={job.href} size="sm">
                            Open on Shiply →
                          </ShiplyLink>
                        ) : null}
                        {job.status === "bidding" && (
                          <button
                            type="button"
                            onClick={() => setStatus(job.id, "hunting")}
                            className={outlineBtnClass("muted")}
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
                            onClick={() => setStatus(job.id, "won")}
                            className="rounded-sm bg-[#2f6b4f] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white uppercase"
                          >
                            I got this
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setStatus(job.id, "skipped")}
                          className={outlineBtnClass("muted")}
                        >
                          Skip
                        </button>
                        <button
                          type="button"
                          onClick={() => requestRemove(job.id)}
                          className={outlineBtnAlertClass("sm")}
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
                className={outlineBtnClass("muted")}
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
