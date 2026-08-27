"use client";

import { CorridorRibbon } from "@/components/corridor-ribbon";
import { TrackedLink } from "@/components/tracked-link";
import { DEMO_CORRIDOR } from "@/lib/corridor-ribbon-shared";
import { useAuthGate } from "@/lib/auth-gate";
import { trackClick } from "@/lib/track-click";

const pillars = [
  {
    eyebrow: "Decide",
    title: "Is it worth it?",
    body: "Strip Shiply’s fee, add empty miles, see true net £ / mile / hour before you bid.",
    href: "/run",
    cta: "Check a job",
  },
  {
    eyebrow: "Hunt",
    title: "Map the board",
    body: "Scan Shiply, compare lanes, and build the most profitable day from where you are.",
    href: "/map",
    cta: "Map Jobs",
  },
  {
    eyebrow: "Execute",
    title: "Run the haul",
    body: "Plan fuel, parking, and repair along the corridor — not guesswork at midnight.",
    href: "/plan",
    cta: "Plan route",
  },
];

export function MarketingHome() {
  const { openGate, isSignedIn } = useAuthGate();

  return (
    <div className="space-y-16 sm:space-y-20">
      {/* Hero */}
      <section className="relative overflow-hidden border border-asphalt/10 bg-asphalt px-6 py-14 text-white sm:px-10 sm:py-20">
        <div className="relative z-10 max-w-3xl">
          <p className="font-display text-sm tracking-[0.22em] text-amber uppercase">
            Built for Shiply drivers
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[1.05] tracking-wide uppercase sm:text-5xl lg:text-6xl">
            Shiply shows what&apos;s listed.
            <span className="mt-2 block text-amber">
              We tell you what to take.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
            Stop bidding blind. See true profit after Shiply&apos;s cut, empty
            miles, and fuel — then hunt, chain, and plan the haul that actually
            pays.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <TrackedLink
              href="/map"
              trackEvent="cta"
              trackLabel="Map Jobs hero"
              className="rounded-sm bg-amber px-6 py-3.5 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot"
            >
              Map Jobs →
            </TrackedLink>
            <TrackedLink
              href="/run"
              trackEvent="cta"
              trackLabel="Build My Run hero"
              className="rounded-sm border border-white/30 px-6 py-3.5 text-sm font-semibold tracking-wide text-white uppercase transition hover:border-amber hover:text-amber-hot"
            >
              Build My Run
            </TrackedLink>
            {!isSignedIn && (
              <button
                type="button"
                onClick={() => {
                  trackClick("cta", "Sign in free");
                  openGate("join-community");
                }}
                className="rounded-sm px-6 py-3.5 text-sm font-semibold tracking-wide text-white/70 uppercase transition hover:text-white"
              >
                Sign in free
              </button>
            )}
          </div>
        </div>
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber/10 blur-3xl"
          aria-hidden
        />
      </section>

      {/* Live product strip — verdict + corridor */}
      <section className="space-y-6">
        <div className="border border-emerald-200 bg-emerald-50 px-5 py-6 sm:px-6 lg:max-w-xl">
          <p className="font-display text-xs tracking-[0.16em] text-emerald-800 uppercase">
            Before you bid
          </p>
          <p className="mt-3 font-display text-2xl tracking-wide text-asphalt uppercase">
            Bolton → Manchester · £240 quote
          </p>
          <p className="mt-2 text-sm text-emerald-900">
            After 13% Shiply fee, 25 mi deadhead, fuel & costs:
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase text-muted">
                Est. net
              </dt>
              <dd className="text-xl font-semibold text-asphalt">£68</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase text-muted">
                £ / mile
              </dt>
              <dd className="text-xl font-semibold text-alert">£0.47</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase text-muted">
                Verdict
              </dt>
              <dd className="text-lg font-semibold text-alert">Pass alone</dd>
            </div>
          </dl>
          <TrackedLink
            href="/run"
            trackEvent="cta"
            trackLabel="Check any job"
            className="mt-5 inline-block text-sm font-semibold text-amber transition hover:text-asphalt"
          >
            Check any job in Build My Run →
          </TrackedLink>
        </div>

        <div className="overflow-hidden border border-asphalt/10 bg-white">
          <div className="border-b border-asphalt/10 px-4 py-4 sm:px-6">
            <p className="font-display text-xs tracking-[0.16em] text-muted uppercase">
              Plan the corridor
            </p>
            <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-emerald-700 text-xs font-bold text-white">
                  A
                </span>
                <div>
                  <p className="font-display text-sm tracking-wide text-asphalt uppercase">
                    {DEMO_CORRIDOR.origin}
                  </p>
                  <p className="text-xs text-muted">Pickup · mi 0</p>
                </div>
              </div>
              <div className="hidden text-muted sm:block" aria-hidden>
                →
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-alert text-xs font-bold text-white">
                  B
                </span>
                <div>
                  <p className="font-display text-sm tracking-wide text-asphalt uppercase">
                    {DEMO_CORRIDOR.destination}
                  </p>
                  <p className="text-xs text-muted">
                    Delivery · mi {DEMO_CORRIDOR.miles}
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted">
              ~{DEMO_CORRIDOR.miles} mi · {DEMO_CORRIDOR.stops.length} fuel,
              parking, and repair stops along the haul
            </p>
          </div>
          <CorridorRibbon
            origin={DEMO_CORRIDOR.origin}
            destination={DEMO_CORRIDOR.destination}
            totalMiles={DEMO_CORRIDOR.miles}
            stops={DEMO_CORRIDOR.stops}
            hideEndpoints
            showDetail
            density="comfortable"
            scrollControls
            hint="Swipe or use arrows to browse all stops"
            footer="Example corridor — plan your own route for live stops near your haul."
          />
          <div className="border-t border-asphalt/10 px-4 py-3 sm:px-5">
            <TrackedLink
              href="/plan"
              trackEvent="cta"
              trackLabel="Plan your own route"
              className="text-sm font-semibold text-amber transition hover:text-asphalt"
            >
              Plan your own route →
            </TrackedLink>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section>
        <p className="font-display text-xs tracking-[0.18em] text-amber uppercase">
          How it works
        </p>
        <h2 className="mt-2 font-display text-3xl tracking-wide text-asphalt uppercase sm:text-4xl">
          Decide · Hunt · Execute
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {pillars.map((p) => (
            <TrackedLink
              key={p.href}
              href={p.href}
              trackEvent="cta"
              trackLabel={p.cta}
              className="group border border-asphalt/15 bg-white px-5 py-6 transition hover:border-amber hover:bg-amber/5"
            >
              <p className="font-display text-xs tracking-[0.16em] text-amber uppercase">
                {p.eyebrow}
              </p>
              <p className="mt-3 font-display text-xl tracking-wide text-asphalt uppercase">
                {p.title}
              </p>
              <p className="mt-2 text-sm leading-snug text-muted">{p.body}</p>
              <p className="mt-4 text-xs font-semibold tracking-wide text-amber uppercase group-hover:text-asphalt">
                {p.cta} →
              </p>
            </TrackedLink>
          ))}
        </div>
      </section>

      {/* Pain / payoff */}
      <section className="border border-asphalt/10 bg-concrete/30 px-6 py-10 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-2xl tracking-wide text-asphalt uppercase sm:text-3xl">
            The headline quote is never the number that matters
          </h2>
          <p className="mt-4 text-lg text-muted">
            Shiply takes a cut. You run empty to the pickup. Diesel moves every
            week. TruckersLikeMe works in{" "}
            <strong className="text-asphalt">your bid</strong>,{" "}
            <strong className="text-asphalt">your empty miles</strong>, and{" "}
            <strong className="text-asphalt">your day total</strong> — so you
            stop chasing jobs that look good and lose money.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <TrackedLink
              href="/jobs"
              trackEvent="cta"
              trackLabel="My Jobs"
              className="rounded-sm border border-asphalt/15 bg-white px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase hover:border-amber"
            >
              My Jobs
            </TrackedLink>
            <TrackedLink
              href="/find"
              trackEvent="cta"
              trackLabel="Nearest Services"
              className="rounded-sm border border-asphalt/15 bg-white px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase hover:border-amber"
            >
              Nearest Services
            </TrackedLink>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="text-center">
        <p className="font-display text-3xl tracking-wide text-asphalt uppercase sm:text-4xl">
          Let the money choose the day
        </p>
        <p className="mx-auto mt-3 max-w-lg text-muted">
          Open Map Jobs, scan what&apos;s on Shiply near you, and build the run
          that finishes profitably — wherever that is.
        </p>
        <TrackedLink
          href="/map"
          trackEvent="cta"
          trackLabel="Start on Map Jobs"
          className="mt-6 inline-block rounded-sm bg-amber px-8 py-4 text-sm font-semibold tracking-wide text-asphalt uppercase"
        >
          Start on Map Jobs →
        </TrackedLink>
      </section>
    </div>
  );
}
