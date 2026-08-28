import type { Metadata } from "next";
import { RunBuilder } from "@/components/run-builder";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Build Run | TruckersLikeMe",
  description:
    "Shortlist Shiply jobs, fill gaps around booked work, check quotes, and build the most profitable day.",
};

export default function RunPage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <SiteHeader variant="solid" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <RunBuilder />
      </main>
      <SiteFooter />
    </div>
  );
}
