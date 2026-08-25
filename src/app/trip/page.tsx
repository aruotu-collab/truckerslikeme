import { Suspense } from "react";
import { TripPageClient } from "@/components/trip-page-client";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Trip tools | TruckersLikeMe",
  description:
    "Corridor live intel and route planning after you check a load.",
};

export default function TripPage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <SiteHeader variant="solid" />
      <Suspense
        fallback={
          <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 text-muted">
            Loading trip tools…
          </main>
        }
      >
        <TripPageClient />
      </Suspense>
      <SiteFooter />
    </div>
  );
}
