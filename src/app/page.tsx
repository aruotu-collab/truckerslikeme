import Link from "next/link";
import { CommunityCta } from "@/components/community-cta";
import { Hero } from "@/components/hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <div className="flex min-h-full w-full max-w-full flex-col overflow-x-clip">
      <SiteHeader variant="solid" />
      <main className="w-full max-w-full flex-1 overflow-x-clip">
        <Hero />
        <section className="border-y border-asphalt/10 bg-background py-8 sm:py-20">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:gap-10 sm:px-8 lg:grid-cols-3">
            <div className="min-w-0">
              <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
                Live activity
              </p>
              <h2 className="mt-3 font-display text-2xl leading-snug tracking-wide break-words text-asphalt uppercase sm:text-3xl">
                What&apos;s ahead
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted">
                Risk-ranked parking, fuel, weather, and delays.
              </p>
              <Link
                href="/live"
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-asphalt px-5 py-3.5 text-sm font-semibold tracking-wide text-white uppercase transition hover:bg-road sm:w-auto"
              >
                Open live
              </Link>
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
                Load money
              </p>
              <h2 className="mt-3 font-display text-2xl leading-snug tracking-wide break-words text-asphalt uppercase sm:text-3xl">
                True profit score
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted">
                Paste a rate conf. See take-home after fuel and real costs.
              </p>
              <Link
                href="/money"
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-amber px-5 py-3.5 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot sm:w-auto"
              >
                Score a load
              </Link>
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
                Route planner
              </p>
              <h2 className="mt-3 font-display text-2xl leading-snug tracking-wide break-words text-asphalt uppercase sm:text-3xl">
                Plan the corridor
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted">
                Fuel, parking, weigh, and repair before you roll.
              </p>
              <Link
                href="/plan"
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-sm border border-asphalt/20 px-5 py-3.5 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-concrete/60 sm:w-auto"
              >
                Plan a route
              </Link>
            </div>
          </div>
        </section>
        <CommunityCta />
      </main>
      <SiteFooter />
    </div>
  );
}
