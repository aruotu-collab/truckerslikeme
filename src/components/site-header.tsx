"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuthGate } from "@/lib/auth-gate";
import { useMarket } from "@/lib/market-context";
import { trackClick } from "@/lib/track-click";
import { HScroll } from "@/components/h-scroll";
import { TrackedLink } from "@/components/tracked-link";

type SiteHeaderProps = {
  variant?: "overlay" | "solid";
};

/** Main app sections — short labels, one job each. */
const primaryNav: {
  href: string;
  label: string;
  title: string;
  match: (pathname: string, need: string | null) => boolean;
}[] = [
  {
    href: "/",
    label: "Home",
    title: "Home",
    match: (pathname) => pathname === "/",
  },
  {
    href: "/map",
    label: "Job Board",
    title: "Scan Shiply, hunt jobs, compare chains",
    match: (pathname) => pathname.startsWith("/map"),
  },
  {
    href: "/jobs",
    label: "My Jobs",
    title: "Track bidding, wins, and today's run",
    match: (pathname) => pathname.startsWith("/jobs"),
  },
  {
    href: "/run",
    label: "Build Run",
    title: "Profit check from screenshots — not the live board",
    match: (pathname) => pathname.startsWith("/run"),
  },
  {
    href: "/plan",
    label: "Couriers",
    title: "Multi-drop courier planning",
    match: (pathname) => pathname.startsWith("/plan"),
  },
  {
    href: "/find",
    label: "Services",
    title: "Parking, fuel, repair along your route",
    match: (pathname, need) =>
      pathname.startsWith("/find") ||
      pathname.startsWith("/trip") ||
      need === "parking" ||
      need === "diesel" ||
      need === "repair" ||
      need === "along",
  },
];

function NavScroll({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const need = searchParams.get("need");

  return (
    <HScroll
      aria-label="Main"
      role="navigation"
      hint=""
      fades={false}
      className="px-0"
    >
      {primaryNav.map((item) => {
        const active = item.match(pathname, need);
        return (
          <TrackedLink
            key={item.href}
            href={item.href}
            title={item.title}
            trackEvent="nav"
            trackLabel={item.label}
            className={`shrink-0 rounded-sm px-3 py-2.5 text-xs font-semibold tracking-normal uppercase transition sm:px-4 sm:py-2.5 sm:text-sm sm:tracking-wide ${
              active
                ? "bg-white text-asphalt ring-1 ring-amber"
                : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            {item.label}
          </TrackedLink>
        );
      })}
      {isAdmin && (
        <TrackedLink
          href="/admin"
          trackEvent="nav"
          trackLabel="Admin"
          className={`shrink-0 rounded-sm px-3 py-2.5 text-xs font-semibold tracking-normal uppercase transition sm:px-4 sm:py-2.5 sm:text-sm sm:tracking-wide ${
            pathname.startsWith("/admin")
              ? "bg-white text-asphalt ring-1 ring-amber"
              : "text-white/80 hover:bg-white/10 hover:text-white"
          }`}
        >
          Admin
        </TrackedLink>
      )}
    </HScroll>
  );
}

function NavScrollFallback() {
  return (
    <div className="flex gap-2 overflow-hidden px-0.5 pb-2">
      {primaryNav.map((item) => (
        <span
          key={item.href}
          className="shrink-0 rounded-sm px-3.5 py-2.5 text-xs font-semibold tracking-wide text-white/50 uppercase sm:text-sm"
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function SiteHeader({ variant = "solid" }: SiteHeaderProps) {
  const { isSignedIn, isAdmin, user, signOut, openGate } = useAuthGate();
  const { market, resolved } = useMarket();
  const solid = variant !== "overlay";
  const headerRef = useRef<HTMLElement | null>(null);
  const shortName =
    (typeof user?.user_metadata?.display_name === "string" &&
      user.user_metadata.display_name) ||
    user?.email?.split("@")[0] ||
    null;

  useEffect(() => {
    if (!solid) {
      document.documentElement.style.setProperty("--site-header-h", "0px");
      return;
    }
    const el = headerRef.current;
    if (!el) return;
    const sync = () => {
      document.documentElement.style.setProperty(
        "--site-header-h",
        `${el.offsetHeight}px`,
      );
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.setProperty("--site-header-h", "0px");
    };
  }, [solid]);

  return (
    <header
      ref={headerRef}
      className={
        solid
          ? "sticky top-0 z-40 w-full max-w-full overflow-x-clip border-b border-white/10 bg-asphalt"
          : "absolute inset-x-0 top-0 z-40 w-full max-w-full overflow-x-clip"
      }
    >
      {/* Brand + account */}
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-8 sm:py-3">
        <div className="min-w-0 flex-1">
          <Link
            href="/"
            className="block font-display text-base tracking-[0.06em] text-white uppercase sm:text-xl"
          >
            <span className="block truncate">
              Truckers<span className="text-amber-hot">Like</span>Me
              {resolved ? (
                <span className="hidden text-white sm:inline">
                  {" "}
                  - {market.countryLabel}
                </span>
              ) : null}
            </span>
          </Link>
          <p className="mt-0.5 hidden truncate text-xs text-white/45 sm:block">
            Shiply shows jobs · We tell you what to take
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {isSignedIn && shortName ? (
            <Link
              href="/me"
              className="hidden max-w-[9rem] truncate rounded-sm border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white/90 transition hover:border-amber/50 hover:text-amber-hot sm:inline-block"
              title={user?.email ?? undefined}
            >
              {shortName}
              {isAdmin ? " · Admin" : ""}
            </Link>
          ) : null}

          {isSignedIn ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-sm px-3 py-2 text-xs font-semibold tracking-normal text-white/70 uppercase transition hover:text-white sm:px-2.5 sm:text-sm sm:tracking-wide"
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                trackClick("auth", "Sign in");
                openGate("join-community");
              }}
              className="rounded-sm border border-white/25 px-3 py-2 text-xs font-semibold tracking-normal text-white uppercase transition hover:border-amber/60 hover:text-amber-hot sm:px-3 sm:text-sm sm:tracking-wide"
            >
              Sign in
            </button>
          )}
        </div>
      </div>

      {/* Main menus — stay with logo while scrolling */}
      <div className="border-t border-white/10">
        <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-1.5 sm:px-8 sm:py-2">
          <Suspense fallback={<NavScrollFallback />}>
            <NavScroll isAdmin={isAdmin} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
