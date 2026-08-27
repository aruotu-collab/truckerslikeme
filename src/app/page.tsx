import type { Metadata } from "next";
import { MarketingHome } from "@/components/marketing-home";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "TruckersLikeMe — Shiply shows jobs. We tell you what to take.",
  description:
    "True profit after Shiply fees, empty miles, and fuel. Job Board, Build My Run, Plan Route, and manage your bids.",
};

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <SiteHeader variant="solid" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <MarketingHome />
      </main>
      <SiteFooter />
    </div>
  );
}
