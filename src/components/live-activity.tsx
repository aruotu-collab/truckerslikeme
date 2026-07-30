"use client";

import { useEffect, useState } from "react";
import { liveActivities as seedActivities } from "@/lib/mock-data";
import { useAuthGate } from "@/lib/auth-gate";
import { ReportIncidentModal } from "@/components/report-incident-modal";
import type { ActivityKind, LiveActivity } from "@/types";

const kindMeta: Record<ActivityKind, { label: string; tone: string }> = {
  parking: { label: "Parking", tone: "text-amber" },
  traffic: { label: "Traffic", tone: "text-alert" },
  fuel: { label: "Fuel", tone: "text-diesel" },
  delay: { label: "Delay", tone: "text-alert" },
  route: { label: "Route", tone: "text-sky-deep" },
  weather: { label: "Weather", tone: "text-sky-deep" },
};

export function LiveActivity() {
  const { isSignedIn, openGate } = useAuthGate();
  const [items, setItems] = useState<LiveActivity[]>(seedActivities);
  const [reportOpen, setReportOpen] = useState(false);
  const [awaitingAuth, setAwaitingAuth] = useState(false);

  useEffect(() => {
    if (isSignedIn && awaitingAuth) {
      setAwaitingAuth(false);
      setReportOpen(true);
    }
  }, [isSignedIn, awaitingAuth]);

  function handleReportClick() {
    if (!isSignedIn) {
      setAwaitingAuth(true);
      openGate("report-alert");
      return;
    }
    setReportOpen(true);
  }

  return (
    <section id="live" className="relative scroll-mt-8 py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="animate-pulse-dot inline-block size-2.5 rounded-full bg-alert" />
              <span className="font-display text-sm tracking-[0.2em] text-muted uppercase">
                Live activity
              </span>
            </div>
            <h2 className="font-display text-4xl tracking-wide text-asphalt uppercase sm:text-5xl">
              What drivers are seeing now
            </h2>
            <p className="mt-3 max-w-xl text-muted">
              Browse corridor intel without an account. Sign in only when you
              want to report something.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReportClick}
            className="self-start rounded-sm bg-asphalt px-5 py-3 text-sm font-semibold tracking-wide text-white uppercase transition hover:bg-road sm:self-auto"
          >
            Report an incident
          </button>
        </div>

        <ul className="mt-12 divide-y divide-asphalt/10 border-y border-asphalt/10">
          {items.map((item, index) => {
            const meta = kindMeta[item.kind];
            return (
              <li
                key={item.id}
                className="animate-slide-up flex flex-col gap-2 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
                style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
              >
                <div>
                  <span
                    className={`font-display text-xs tracking-[0.18em] uppercase ${meta.tone}`}
                  >
                    {meta.label}
                  </span>
                  <p className="mt-1 text-lg text-asphalt sm:text-xl">
                    {item.message}
                  </p>
                  <p className="mt-1 text-sm text-muted">{item.location}</p>
                </div>
                <time className="shrink-0 text-sm text-muted">
                  {item.minutesAgo === 0 ? "Just now" : `${item.minutesAgo}m ago`}
                </time>
              </li>
            );
          })}
        </ul>
      </div>

      <ReportIncidentModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmitted={(item) => setItems((prev) => [item, ...prev])}
      />
    </section>
  );
}
