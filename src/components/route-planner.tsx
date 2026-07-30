"use client";

import { useEffect, useMemo, useState } from "react";
import { citySuggestions, sampleRoute } from "@/lib/mock-data";
import { useAuthGate } from "@/lib/auth-gate";
import { saveRoute } from "@/lib/supabase/data";
import { RouteMap } from "@/components/route-map";
import type { PlannedRoute } from "@/types";

export function RoutePlanner() {
  const { isSignedIn, user, openGate } = useAuthGate();
  const [origin, setOrigin] = useState("Dallas, TX");
  const [destination, setDestination] = useState("Chicago, IL");
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [aiUsed, setAiUsed] = useState(false);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [awaitingAuthToSave, setAwaitingAuthToSave] = useState(false);

  const canSearch = origin.trim() && destination.trim();

  const statusCounts = useMemo(() => {
    if (!route) return null;
    return {
      fuel: route.stops.filter((s) => s.type === "fuel").length,
      parking: route.stops.filter((s) => s.type === "parking").length,
      alerts: route.stops.filter((s) => s.type === "alert").length,
    };
  }, [route]);

  useEffect(() => {
    if (isSignedIn && awaitingAuthToSave && route && user) {
      setAwaitingAuthToSave(false);
      void persistRoute(route);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, awaitingAuthToSave, route, user]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!canSearch) return;
    setRoute({
      ...sampleRoute,
      origin: origin.trim(),
      destination: destination.trim(),
    });
    setAiReply(null);
    setSaved(false);
    setSaveError(null);
  }

  async function persistRoute(planned: PlannedRoute) {
    if (!user) return;
    setSaveBusy(true);
    setSaveError(null);
    const { error } = await saveRoute({ user, route: planned });
    setSaveBusy(false);
    if (error) {
      setSaveError(error);
      setSaved(false);
      return;
    }
    setSaved(true);
  }

  function handleSave() {
    if (!route) return;
    if (!isSignedIn) {
      setAwaitingAuthToSave(true);
      openGate("save-route");
      return;
    }
    void persistRoute(route);
  }

  function handleAskAi() {
    if (aiUsed) {
      if (!openGate("ask-ai")) return;
    }
    setAiUsed(true);
    setAiReply(
      `For ${origin} → ${destination} (~925 mi via I-35/I-44/I-55): fuel early at Pilot #701 Ardmore (I-35 Ex 33; Gulf diesel usually under Midwest EIA ~$5.20). Overnight at Petro Joplin (I-44 Ex 4, ~465 spaces) before lots fill mid-afternoon. Watch MoDOT’s St. Clair WB scale rebuild on I-44. Into Chicago, budget I-80 Joliet congestion and intermodal waits over 2 hours — confirm detention terms before you accept the load.`,
    );
  }

  return (
    <section id="plan" className="scroll-mt-8 bg-asphalt py-20 text-white sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
            Route planner
          </p>
          <h2 className="mt-3 font-display text-4xl tracking-wide uppercase sm:text-5xl">
            Search a corridor. See the road ahead.
          </h2>
          <p className="mt-3 text-chrome">
            No account needed to search. Sign up when you want to save the trip
            or ask AI for more than one free tip.
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="mt-10 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs tracking-wide text-chrome uppercase">
              Origin
            </span>
            <input
              list="city-suggestions"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full rounded-sm border border-white/15 bg-road px-4 py-3 text-white outline-none transition focus:border-amber"
              placeholder="Dallas, TX"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs tracking-wide text-chrome uppercase">
              Destination
            </span>
            <input
              list="city-suggestions"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full rounded-sm border border-white/15 bg-road px-4 py-3 text-white outline-none transition focus:border-amber"
              placeholder="Chicago, IL"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={!canSearch}
              className="w-full rounded-sm bg-amber px-6 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              Search route
            </button>
          </div>
          <datalist id="city-suggestions">
            {citySuggestions.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
        </form>

        {route && (
          <div className="animate-fade-in mt-12 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <p className="font-display text-2xl tracking-wide uppercase sm:text-3xl">
                    {route.origin} → {route.destination}
                  </p>
                  <p className="mt-1 text-chrome">
                    {route.miles} miles · ~{route.hours} driving hours
                    {statusCounts &&
                      ` · ${statusCounts.fuel} fuel · ${statusCounts.parking} parking · ${statusCounts.alerts} alerts`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleAskAi}
                    className="rounded-sm border border-amber/50 bg-amber/10 px-4 py-2 text-sm text-amber-hot transition hover:bg-amber/20"
                  >
                    Ask AI once
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saveBusy || saved}
                    className="rounded-sm bg-white px-4 py-2 text-sm font-semibold text-asphalt transition hover:bg-concrete disabled:opacity-70"
                  >
                    {saveBusy
                      ? "Saving…"
                      : saved
                        ? "Route saved"
                        : "Save this route"}
                  </button>
                </div>
              </div>

              {saveError && (
                <p className="mt-4 text-sm text-alert">{saveError}</p>
              )}
              {saved && !saveError && (
                <p className="mt-4 text-sm text-amber-hot">
                  Saved to your Members page.
                </p>
              )}

              <ul className="mt-6 space-y-4">
                {route.insights.map((insight) => (
                  <li
                    key={insight}
                    className="border-l-2 border-amber pl-4 text-chrome"
                  >
                    {insight}
                  </li>
                ))}
              </ul>

              {aiReply && (
                <div className="mt-8 border border-amber/30 bg-amber/5 p-5">
                  <p className="font-display text-xs tracking-[0.18em] text-amber uppercase">
                    AI trip tip
                  </p>
                  <p className="mt-2 leading-relaxed text-white/90">{aiReply}</p>
                  {aiUsed && (
                    <p className="mt-3 text-sm text-chrome">
                      Free guest tip used. Sign in for more AI answers.
                    </p>
                  )}
                </div>
              )}

              <ol className="mt-8 space-y-0">
                {route.stops.map((stop, index) => (
                  <li
                    key={stop.id}
                    className="grid grid-cols-[auto_1fr] gap-4 border-t border-white/10 py-4"
                  >
                    <div className="pt-1 text-right font-display text-sm text-amber">
                      mi {stop.mile}
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        <span className="mr-2 font-display text-xs tracking-wider text-chrome uppercase">
                          {stop.type}
                        </span>
                        {stop.label}
                      </p>
                      <p className="mt-1 text-sm text-chrome">{stop.detail}</p>
                      {index < route.stops.length - 1 && (
                        <div className="mt-3 h-px w-full bg-gradient-to-r from-white/20 to-transparent" />
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <RouteMap route={route} />
          </div>
        )}
      </div>
    </section>
  );
}
