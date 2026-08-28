"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { LiveActivity } from "@/components/live-activity";
import { PlanRoutePanel } from "@/components/plan-route-panel";

type Tab = "assist" | "live" | "plan";

export function TripPageClient() {
  const params = useSearchParams();
  const tabParam = params.get("tab");
  const active: Tab = useMemo(() => {
    if (tabParam === "live" || tabParam === "plan" || tabParam === "assist") {
      return tabParam;
    }
    return "assist";
  }, [tabParam]);

  const chip =
    "inline-flex min-h-11 items-center justify-center rounded-sm px-4 py-2 text-sm font-semibold tracking-wide uppercase transition";

  const planQuery = (() => {
    const q = new URLSearchParams();
    const from = params.get("from") || params.get("origin");
    const to = params.get("to") || params.get("destination");
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const s = q.toString();
    return s ? `/find?need=along&${s}` : "/find?need=along";
  })();

  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-5 pt-8 sm:px-8">
        <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
          Trip
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-wide text-asphalt uppercase sm:text-5xl">
          Run the haul
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          After you check a load, use Trip for corridor intel, route stops, and
          parking tips along the way.
        </p>

        <div className="page-sticky-bar -mx-5 mt-6 border-b border-asphalt/10 px-5 py-2.5 sm:-mx-8 sm:px-8">
          <div className="flex flex-wrap gap-2">
          <Link
            href="/trip?tab=assist"
            className={`${chip} ${
              active === "assist"
                ? "bg-amber text-asphalt"
                : "border-2 border-asphalt/40 bg-white text-asphalt hover:border-asphalt"
            }`}
          >
            Assistant
          </Link>
          <Link
            href="/trip?tab=live"
            className={`${chip} ${
              active === "live"
                ? "bg-amber text-asphalt"
                : "border-2 border-asphalt/40 bg-white text-asphalt hover:border-asphalt"
            }`}
          >
            Live
          </Link>
          <Link
            href={planQuery}
            className={`${chip} ${
              active === "plan"
                ? "bg-amber text-asphalt"
                : "border-2 border-asphalt/40 bg-white text-asphalt hover:border-asphalt"
            }`}
          >
            Plan
          </Link>
          </div>
        </div>
      </div>

      {active === "assist" && (
        <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="border border-asphalt/10 bg-white px-5 py-6">
              <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
                Plan the corridor
              </h2>
              <p className="mt-2 text-muted">
                See fuel, parking, and repair from origin to delivery on one
                line.
              </p>
              <Link
                href={planQuery}
                className="mt-5 inline-flex rounded-sm bg-amber px-4 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase"
              >
                Plan route
              </Link>
            </div>
            <div className="border border-asphalt/10 bg-white px-5 py-6">
              <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
                Need a stop now?
              </h2>
              <p className="mt-2 text-muted">
                Tap-first parking, diesel, and repair — with trust badges.
              </p>
              <Link
                href="/find?need=parking"
                className="mt-5 inline-flex rounded-sm bg-asphalt px-4 py-3 text-sm font-semibold tracking-wide text-white uppercase"
              >
                Nearest parking
              </Link>
            </div>
          </div>
        </section>
      )}

      {active === "live" && (
        <div className="pt-4">
          <LiveActivity />
        </div>
      )}

      {active === "plan" && (
        <section className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
          <PlanRoutePanel />
        </section>
      )}
    </main>
  );
}
