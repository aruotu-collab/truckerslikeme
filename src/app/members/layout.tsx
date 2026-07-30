import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Members — TruckersLikeMe",
  description: "Your TruckersLikeMe profile, saved routes, and membership.",
};

export default function MembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
