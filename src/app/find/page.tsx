import type { Metadata } from "next";
import { Suspense } from "react";
import { FindPanel } from "@/components/find-panel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Services | TruckersLikeMe",
  description:
    "Parking, fuel, and repair near you — or along a From→To haul corridor.",
};

export default function FindPage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <SiteHeader variant="solid" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <Suspense fallback={<p className="text-muted">Loading find…</p>}>
          <FindPanel />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
