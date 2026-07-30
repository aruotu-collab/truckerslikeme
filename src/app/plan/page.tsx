import type { Metadata } from "next";
import { RoutePlanner } from "@/components/route-planner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Plan a route — TruckersLikeMe",
  description:
    "Search a corridor for fuel, parking, weigh stations, and trip tips.",
};

export default function PlanPage() {
  return (
    <div className="flex min-h-full flex-col bg-asphalt">
      <SiteHeader variant="solid" />
      <main className="flex-1">
        <RoutePlanner />
      </main>
      <SiteFooter />
    </div>
  );
}
