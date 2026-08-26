"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuthGate } from "@/lib/auth-gate";
import { useMarket } from "@/lib/market-context";
import { HScroll } from "@/components/h-scroll";

type SiteHeaderProps = {
  variant?: "overlay" | "solid";
};

const primaryNav = [
  {
    href: "/run",
    label: "Build My Run",
    match: (pathname: string) => pathname.startsWith("/run"),
  },
  {
    href: "/map",
    label: "Map Jobs",
    match: (pathname: string) => pathname.startsWith("/map"),
  },
  {
    href: "/plan",
    label: "Plan Route",
    match: (pathname: string) =>
      pathname.startsWith("/plan") && !pathname.startsWith("/plan/"),
  },
  {
    href: "/find",
    label: "Nearest Services",
    match: (pathname: string, need: string | null) =>
      pathname.startsWith("/find") ||
      pathname.startsWith("/trip") ||
      (need != null &&
        (need === "parking" || need === "diesel" || need === "repair")),
  },
  {
    href: "/jobs",
    label: "My Jobs",
    match: (pathname: string) => pathname.startsWith("/jobs"),
  },
] as const;

function NavScroll({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const need = searchParams.get("need");

  return (
    <div className="[--h-scroll-fade:#1a1d23]">
      <HScroll
        aria-label="Main"
        role="navigation"
        hint=""
        className="px-0"
      >
        {primaryNav.map((item) => {
          const active = item.match(pathname, need);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-sm px-3.5 py-2.5 text-xs font-semibold tracking-wide uppercase transition sm:px-4 sm:text-sm ${
                active
                  ? "bg-amber text-asphalt"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/me"
          className={`shrink-0 rounded-sm px-3.5 py-2.5 text-xs font-semibold tracking-wide uppercase transition sm:px-4 sm:text-sm ${
            pathname.startsWith("/me") || pathname.startsWith("/members")
              ? "bg-amber text-asphalt"
              : "text-white/80 hover:bg-white/10 hover:text-white"
          }`}
        >
          Me
        </Link>
        {isAdmin && (
          <Link
            href="/admin"
            className={`shrink-0 rounded-sm px-3.5 py-2.5 text-xs font-semibold tracking-wide uppercase transition sm:px-4 sm:text-sm ${
              pathname.startsWith("/admin")
                ? "bg-amber text-asphalt"
                : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            Admin
          </Link>
        )}
      </HScroll>
    </div>
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
  const shortName =
    (typeof user?.user_metadata?.display_name === "string" &&
      user.user_metadata.display_name) ||
    user?.email?.split("@")[0] ||
    null;

  return (
    <header
      className={
        solid
          ? "relative z-30 w-full max-w-full overflow-x-clip border-b border-white/10 bg-asphalt"
          : "absolute inset-x-0 top-0 z-30 w-full max-w-full overflow-x-clip"
      }
    >
      {/* Brand + account */}
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-8 sm:py-3.5">
        <div className="min-w-0 shrink">
          <Link
            href="/"
            className="block font-display text-lg tracking-[0.06em] text-white uppercase sm:text-xl"
          >
            <span className="whitespace-nowrap">
              Truckers<span className="text-amber-hot">Like</span>Me
              {resolved ? (
                <span className="text-white"> - {market.countryLabel}</span>
              ) : null}
            </span>
          </Link>
          <p className="mt-0.5 hidden truncate text-xs text-white/45 sm:block">
            Shiply shows jobs · We tell you what to take
          </p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
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
              className="rounded-sm px-2.5 py-1.5 text-xs font-semibold tracking-wide text-white/70 uppercase transition hover:text-white sm:text-sm"
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openGate("join-community")}
              className="rounded-sm border border-white/25 px-3 py-1.5 text-xs font-semibold tracking-wide text-white uppercase transition hover:border-amber/60 hover:text-amber-hot sm:text-sm"
            >
              Sign in
            </button>
          )}
        </div>
      </div>

      {/* Sliding section menu under the logo — same on mobile and desktop */}
      <div className="border-t border-white/10">
        <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-2 sm:px-8">
          <Suspense fallback={<NavScrollFallback />}>
            <NavScroll isAdmin={isAdmin} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
