import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanRoutePanel } from "@/components/plan-route-panel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Plan route | TruckersLikeMe",
  description:
    "See fuel, parking, repair, and alerts along your haul — from origin to delivery.",
};

export default function PlanPage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <SiteHeader variant="solid" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <Suspense fallback={<p className="text-muted">Loading route planner…</p>}>
          <PlanRoutePanel />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
