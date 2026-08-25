import type { Metadata } from "next";
import { JobsMapPanel } from "@/components/jobs-map-panel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Map Jobs | TruckersLikeMe",
  description:
    "Tube-style map of Shiply search results — see every job as a line, open listings, mark wins and bids.",
};

export default function MapJobsPage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <SiteHeader variant="solid" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <JobsMapPanel />
      </main>
      <SiteFooter />
    </div>
  );
}
