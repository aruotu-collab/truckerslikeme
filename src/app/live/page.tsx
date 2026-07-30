import type { Metadata } from "next";
import { LiveActivity } from "@/components/live-activity";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Live activity — TruckersLikeMe",
  description:
    "Risk-ranked corridor intel: driver reports, NWS weather, and EIA diesel.",
};

export default function LivePage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <SiteHeader variant="solid" />
      <main className="flex-1">
        <LiveActivity />
      </main>
      <SiteFooter />
    </div>
  );
}
