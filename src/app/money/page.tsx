import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LoadAnalyzer } from "@/components/load-analyzer";

export const metadata = {
  title: "Load profit score | TruckersLikeMe",
  description:
    "Paste a rate confirmation and see true profit after fuel and real operating costs.",
};

export default function MoneyPage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <SiteHeader variant="solid" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <LoadAnalyzer />
      </main>
      <SiteFooter />
    </div>
  );
}
