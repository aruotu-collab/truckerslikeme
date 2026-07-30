import Link from "next/link";
import { CommunityCta } from "@/components/community-cta";
import { Hero } from "@/components/hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col overflow-x-clip">
      <SiteHeader variant="solid" />
      <main className="flex-1">
        <Hero />
        <section className="border-y border-asphalt/10 bg-background py-10 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 sm:gap-10 sm:px-8 lg:grid-cols-2">
            <div>
              <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
                Live activity
              </p>
              <h2 className="mt-3 font-display text-3xl leading-tight tracking-wide text-asphalt uppercase sm:text-4xl">
                What&apos;s ahead on the haul
              </h2>
              <p className="mt-3 max-w-md text-base text-muted sm:text-lg">
                Risk-ranked parking, fuel, weather, and delays — glanceable when
                you need it.
              </p>
              <Link
                href="/live"
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-asphalt px-5 py-4 text-base font-semibold tracking-wide text-white uppercase transition hover:bg-road sm:w-auto"
              >
                Open live activity
              </Link>
            </div>
            <div>
              <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
                Route planner
              </p>
              <h2 className="mt-3 font-display text-3xl leading-tight tracking-wide text-asphalt uppercase sm:text-4xl">
                Plan the next corridor
              </h2>
              <p className="mt-3 max-w-md text-base text-muted sm:text-lg">
                Fuel, parking, weigh, and repair along your route before you roll.
              </p>
              <Link
                href="/plan"
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-amber px-5 py-4 text-base font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot sm:w-auto"
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
