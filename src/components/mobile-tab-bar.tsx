"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthGate } from "@/lib/auth-gate";

const tabs = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  { href: "/plan", label: "Plan", match: (p: string) => p.startsWith("/plan") },
  { href: "/live", label: "Live", match: (p: string) => p.startsWith("/live") },
  {
    href: "/members",
    label: "Members",
    match: (p: string) => p.startsWith("/members"),
  },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();
  const { isSignedIn, openGate } = useAuthGate();

  return (
    <nav
      aria-label="Primary"
      className="mobile-tab-bar fixed inset-x-0 bottom-0 z-40 border-t border-asphalt/15 bg-asphalt/95 text-white backdrop-blur-md md:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const isMembers = tab.href === "/members";

          if (isMembers && !isSignedIn) {
            return (
              <button
                key={tab.href}
                type="button"
                onClick={() => openGate("join-community")}
                className="flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold tracking-wide uppercase transition"
              >
                <span
                  className={`h-1 w-6 rounded-full ${active ? "bg-amber" : "bg-transparent"}`}
                />
                <span className={active ? "text-amber-hot" : "text-chrome"}>
                  Sign in
                </span>
              </button>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold tracking-wide uppercase transition"
            >
              <span
                className={`h-1 w-6 rounded-full ${active ? "bg-amber" : "bg-transparent"}`}
              />
              <span className={active ? "text-amber-hot" : "text-chrome"}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
