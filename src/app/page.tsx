import { CommunityCta } from "@/components/community-cta";
import { Hero } from "@/components/hero";
import { LiveActivity } from "@/components/live-activity";
import { RoutePlanner } from "@/components/route-planner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <LiveActivity />
        <RoutePlanner />
        <CommunityCta />
      </main>
      <SiteFooter />
    </>
  );
}
