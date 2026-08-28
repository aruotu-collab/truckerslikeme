import type { Metadata } from "next";
import { MyJobsPanel } from "@/components/my-jobs-panel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "My Jobs | TruckersLikeMe",
  description:
    "Track Shiply bids, won jobs, today's run, and deliveries — your pipeline after you start bidding.",
};

export default function JobsPage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <SiteHeader variant="solid" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <MyJobsPanel />
      </main>
      <SiteFooter />
    </div>
  );
}
