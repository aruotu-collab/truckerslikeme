"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { LiveActivity } from "@/components/live-activity";
import { RoutePlanner } from "@/components/route-planner";

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

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/trip?tab=assist"
            className={`${chip} ${
              active === "assist"
                ? "bg-amber text-asphalt"
                : "border border-asphalt/15 bg-white text-asphalt"
            }`}
          >
            Assistant
          </Link>
          <Link
            href="/trip?tab=live"
            className={`${chip} ${
              active === "live"
                ? "bg-amber text-asphalt"
                : "border border-asphalt/15 bg-white text-asphalt"
            }`}
          >
            Live
          </Link>
          <Link
            href="/trip?tab=plan"
            className={`${chip} ${
              active === "plan"
                ? "bg-amber text-asphalt"
                : "border border-asphalt/15 bg-white text-asphalt"
            }`}
          >
            Plan
          </Link>
        </div>
      </div>

      {active === "assist" && (
        <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="border border-asphalt/10 bg-white px-5 py-6">
              <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
                Check a load first
              </h2>
              <p className="mt-2 text-muted">
                Score the money, then we help you park and plan the corridor.
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex rounded-sm bg-amber px-4 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase"
              >
                Open load checker
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
                href="/find"
                className="mt-5 inline-flex rounded-sm bg-asphalt px-4 py-3 text-sm font-semibold tracking-wide text-white uppercase"
              >
                Open find
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
        <div className="bg-asphalt pt-4">
          <RoutePlanner />
        </div>
      )}
    </main>
  );
}
