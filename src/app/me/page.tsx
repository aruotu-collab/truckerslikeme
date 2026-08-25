"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGate } from "@/lib/auth-gate";
import {
  fetchMyAlerts,
  fetchSavedRoutes,
  type SavedRouteRow,
} from "@/lib/supabase/data";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { UpgradeToProButton } from "@/components/upgrade-to-pro";
import type { ActivityKind, LiveActivity } from "@/types";

const kindMeta: Record<ActivityKind, { label: string; tone: string }> = {
  parking: { label: "Parking", tone: "text-amber" },
  traffic: { label: "Traffic", tone: "text-alert" },
  fuel: { label: "Fuel", tone: "text-diesel" },
  delay: { label: "Delay", tone: "text-alert" },
  route: { label: "Route", tone: "text-sky-deep" },
  weather: { label: "Weather", tone: "text-sky-deep" },
  weigh: { label: "Weigh", tone: "text-sky-deep" },
  repair: { label: "Repair", tone: "text-diesel" },
};

export default function MePage() {
  const router = useRouter();
  const {
    isSignedIn,
    isPro,
    user,
    loading,
    openGate,
    signOut,
    refreshPlan,
  } = useAuthGate();
  const [routes, setRoutes] = useState<SavedRouteRow[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [reports, setReports] = useState<LiveActivity[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const [upgraded, setUpgraded] = useState(false);
  const [analyses, setAnalyses] = useState<
    {
      id: string;
      origin: string | null;
      destination: string | null;
      miles: number;
      net_profit: number;
      net_per_mile: number;
      score: string;
      created_at: string;
    }[]
  >([]);
  const [analysesError, setAnalysesError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setUpgraded(params.get("upgraded") === "1");
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!isSignedIn) {
      openGate("join-community");
    }
  }, [loading, isSignedIn, openGate]);

  useEffect(() => {
    if (upgraded && isSignedIn) {
      void refreshPlan();
    }
  }, [upgraded, isSignedIn, refreshPlan]);

  useEffect(() => {
    if (!isSignedIn || !user) {
      setRoutes([]);
      setReports([]);
      return;
    }

    let mounted = true;
    setRoutesLoading(true);
    setReportsLoading(true);

    Promise.all([
      fetchSavedRoutes(user.id),
      fetchMyAlerts(user.id),
      fetch("/api/me/plan").then((r) => r.json()),
      fetch("/api/loads/history").then((r) => r.json()),
    ]).then(([routesResult, alertsResult, plan, hist]) => {
      if (!mounted) return;
      setRoutes(routesResult.routes);
      setRoutesError(routesResult.error);
      setRoutesLoading(false);
      setReports(alertsResult.items);
      setReportsError(alertsResult.error);
      setReportsLoading(false);
      setStripeReady(Boolean((plan as { stripeReady?: boolean }).stripeReady));
      const items = (hist as { items?: typeof analyses }).items ?? [];
      setAnalyses(items);
      if ((hist as { error?: string }).error) {
        setAnalysesError(
          "History needs schema-money.sql in Supabase if this stays empty after scoring loads.",
        );
      }
    });

    return () => {
      mounted = false;
    };
  }, [isSignedIn, user]);

  const displayName =
    (typeof user?.user_metadata?.display_name === "string" &&
      user.user_metadata.display_name) ||
    user?.email?.split("@")[0] ||
    "Driver";

  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <SiteHeader variant="solid" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        {loading ? (
          <p className="text-muted">Loading your account…</p>
        ) : !isSignedIn ? (
          <div className="max-w-lg">
            <h1 className="font-display text-4xl tracking-wide text-asphalt uppercase">
              Me
            </h1>
            <p className="mt-3 text-muted">
              Sign in to view your profile, saved routes, and Mehip.
            </p>
            <button
              type="button"
              onClick={() => openGate("join-community")}
              className="mt-6 rounded-sm bg-amber px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot"
            >
              Sign in
            </button>
          </div>
        ) : (
          <div className="animate-fade-in space-y-12">
            <section>
              <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
                Your account
              </p>
              <h1 className="mt-2 font-display text-4xl tracking-wide text-asphalt uppercase sm:text-5xl">
                {displayName}
              </h1>
              <p className="mt-3 text-lg text-muted">{user?.email}</p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                <span>
                  Plan:{" "}
                  <strong className="text-asphalt">
                    {isPro ? "Pro" : "Free"}
                  </strong>
                </span>
                {joined && (
                  <span>
                    Joined: <strong className="text-asphalt">{joined}</strong>
                  </span>
                )}
              </div>
              {upgraded && (
                <p className="mt-4 border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-asphalt">
                  Welcome to Pro — unlimited load profit scores are unlocked.
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/money"
                  className="rounded-sm bg-amber px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot"
                >
                  Score a load
                </Link>
                <Link
                  href="/plan"
                  className="rounded-sm bg-asphalt px-5 py-3 text-sm font-semibold tracking-wide text-white uppercase transition hover:bg-road"
                >
                  Plan a route
                </Link>
                <Link
                  href="/live"
                  className="rounded-sm border border-asphalt/15 px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-concrete/60"
                >
                  Report an incident
                </Link>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="rounded-sm border border-asphalt/15 px-5 py-3 text-sm text-muted transition hover:bg-concrete/60"
                >
                  Sign out
                </button>
              </div>
            </section>

            <section className="border-t border-asphalt/10 pt-10">
              <h2 className="font-display text-2xl tracking-wide text-asphalt uppercase">
                My reports
              </h2>
              <p className="mt-2 max-w-xl text-muted">
                Incidents you posted to the live feed.
              </p>

              {reportsLoading ? (
                <p className="mt-6 text-muted">Loading your reports…</p>
              ) : reportsError ? (
                <p className="mt-6 text-sm text-alert">{reportsError}</p>
              ) : reports.length === 0 ? (
                <div className="mt-6 border border-dashed border-asphalt/20 bg-white/50 px-5 py-10 text-center">
                  <p className="font-display text-sm tracking-[0.18em] text-muted uppercase">
                    No reports yet
                  </p>
                  <Link
                    href="/live"
                    className="mt-4 inline-block text-sm font-medium text-amber transition hover:text-asphalt"
                  >
                    Report an incident →
                  </Link>
                </div>
              ) : (
                <ul className="mt-6 divide-y divide-asphalt/10 border-y border-asphalt/10">
                  {reports.map((item) => {
                    const meta = kindMeta[item.kind];
                    return (
                      <li
                        key={item.id}
                        className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between"
                      >
                        <div>
                          <span
                            className={`font-display text-xs tracking-[0.18em] uppercase ${meta.tone}`}
                          >
                            {meta.label}
                          </span>
                          <p className="mt-1 text-lg text-asphalt">
                            {item.message}
                          </p>
                          <p className="text-sm text-muted">{item.location}</p>
                        </div>
                        <time className="text-sm text-muted">
                          {item.minutesAgo === 0
                            ? "Just now"
                            : `${item.minutesAgo}m ago`}
                        </time>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="border-t border-asphalt/10 pt-10">
              <h2 className="font-display text-2xl tracking-wide text-asphalt uppercase">
                Saved routes
              </h2>
              <p className="mt-2 max-w-xl text-muted">
                Corridors you save from the planner appear here.
              </p>

              {routesLoading ? (
                <p className="mt-6 text-muted">Loading saved routes…</p>
              ) : routesError ? (
                <p className="mt-6 text-sm text-alert">
                  {routesError.includes("does not exist") ||
                  routesError.includes("schema cache")
                    ? "Database tables are missing. Run supabase/schema.sql in the Supabase SQL Editor."
                    : routesError}
                </p>
              ) : routes.length === 0 ? (
                <div className="mt-6 border border-dashed border-asphalt/20 bg-white/50 px-5 py-10 text-center">
                  <p className="font-display text-sm tracking-[0.18em] text-muted uppercase">
                    No saved routes yet
                  </p>
                  <Link
                    href="/plan"
                    className="mt-4 inline-block text-sm font-medium text-amber transition hover:text-asphalt"
                  >
                    Search a route to get started →
                  </Link>
                </div>
              ) : (
                <ul className="mt-6 divide-y divide-asphalt/10 border-y border-asphalt/10">
                  {routes.map((route) => (
                    <li
                      key={route.id}
                      className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between"
                    >
                      <div>
                        <p className="text-lg text-asphalt">
                          {route.origin} → {route.destination}
                        </p>
                        {route.miles != null && (
                          <p className="text-sm text-muted">
                            {route.miles} miles
                          </p>
                        )}
                      </div>
                      <time className="text-sm text-muted">
                        {new Date(route.created_at).toLocaleDateString()}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="border-t border-asphalt/10 pt-10">
              <h2 className="font-display text-2xl tracking-wide text-asphalt uppercase">
                Load profit history
              </h2>
              <p className="mt-2 max-w-xl text-muted">
                Scores you saved from the Money tool.
              </p>
              {analysesError ? (
                <p className="mt-4 text-sm text-muted">{analysesError}</p>
              ) : analyses.length === 0 ? (
                <div className="mt-6 border border-dashed border-asphalt/20 bg-white/50 px-5 py-10 text-center">
                  <p className="font-display text-sm tracking-[0.18em] text-muted uppercase">
                    No scores yet
                  </p>
                  <Link
                    href="/money"
                    className="mt-4 inline-block text-sm font-medium text-amber transition hover:text-asphalt"
                  >
                    Score a load →
                  </Link>
                </div>
              ) : (
                <ul className="mt-6 divide-y divide-asphalt/10 border-y border-asphalt/10">
                  {analyses.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between"
                    >
                      <div>
                        <p className="text-lg text-asphalt">
                          {[item.origin, item.destination]
                            .filter(Boolean)
                            .join(" → ") || `${item.miles} mi`}
                        </p>
                        <p className="text-sm text-muted">
                          Net ${Number(item.net_profit).toFixed(0)} · $
                          {Number(item.net_per_mile).toFixed(2)}/mi ·{" "}
                          <span className="uppercase">{item.score}</span>
                        </p>
                      </div>
                      <time className="text-sm text-muted">
                        {new Date(item.created_at).toLocaleDateString()}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section id="pro" className="border-t border-asphalt/10 pt-10">
              <h2 className="font-display text-2xl tracking-wide text-asphalt uppercase">
                TruckersLikeMe Pro
              </h2>
              <p className="mt-2 max-w-xl text-muted">
                Unlimited load checks, priority Find results, trip assistant
                extras, and screenshot OCR as we ship it. Free includes 2 saved
                load checks per month.
              </p>
              <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-muted">
                <li>Unlimited true-profit load checks</li>
                <li>Saved cost assumptions + history</li>
                <li>Verified-first parking ranking as the map fills in</li>
                <li>Cancel anytime when Stripe checkout is connected</li>
              </ul>
              <UpgradeToProButton isPro={isPro} stripeReady={stripeReady} />
            </section>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
