import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Me — TruckersLikeMe",
  description: "Your TruckersLikeMe profile, saved checks, and Pro membership.",
};

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
