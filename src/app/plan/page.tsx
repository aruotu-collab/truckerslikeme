import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CourierPlanPanel } from "@/components/courier-plan-panel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Couriers | TruckersLikeMe",
  description:
    "Snap parcel labels, plan multi-drop courier routes from the depot or where you are, and mark deliveries as you go.",
};

type PlanSearch = {
  from?: string;
  to?: string;
  origin?: string;
  destination?: string;
};

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<PlanSearch> | PlanSearch;
}) {
  const sp = await Promise.resolve(searchParams);
  const from = (sp.from || sp.origin || "").trim();
  const to = (sp.to || sp.destination || "").trim();
  // Old corridor deep-links → Services · Along route
  if (from || to) {
    const q = new URLSearchParams({ need: "along" });
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    redirect(`/find?${q.toString()}`);
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <SiteHeader variant="solid" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <Suspense fallback={<p className="text-muted">Loading courier plan…</p>}>
          <CourierPlanPanel />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
