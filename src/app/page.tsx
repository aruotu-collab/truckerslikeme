import Link from "next/link";
import { CommunityCta } from "@/components/community-cta";
import { Hero } from "@/components/hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      {/* Solid header on mobile so hero text is never covered */}
      <div className="md:hidden">
        <SiteHeader variant="solid" />
      </div>
      <div className="hidden md:block">
        <SiteHeader />
      </div>
      <main className="flex-1">
        <Hero />
        <section className="border-y border-asphalt/10 bg-background py-12 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-2">
            <div>
              <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
                Live activity
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-wide text-asphalt uppercase sm:text-4xl">
                What&apos;s ahead on the haul
              </h2>
              <p className="mt-3 max-w-md text-muted">
                Risk-ranked driver reports, NWS weather, and EIA diesel — filtered
                to your corridor.
              </p>
              <Link
                href="/live"
                className="mt-6 inline-flex w-full items-center justify-center rounded-sm bg-asphalt px-5 py-3.5 text-sm font-semibold tracking-wide text-white uppercase transition hover:bg-road sm:w-auto sm:py-3"
              >
                Open live activity
              </Link>
            </div>
            <div>
              <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
                Route planner
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-wide text-asphalt uppercase sm:text-4xl">
                Plan the next corridor
              </h2>
              <p className="mt-3 max-w-md text-muted">
                Search origin to destination for fuel stops, parking, weigh
                stations, and trip tips.
              </p>
              <Link
                href="/plan"
                className="mt-6 inline-flex w-full items-center justify-center rounded-sm bg-amber px-5 py-3.5 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot sm:w-auto sm:py-3"
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
