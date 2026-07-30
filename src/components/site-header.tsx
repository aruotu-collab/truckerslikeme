"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthGate } from "@/lib/auth-gate";

type SiteHeaderProps = {
  variant?: "overlay" | "solid";
};

export function SiteHeader({ variant = "solid" }: SiteHeaderProps) {
  const pathname = usePathname();
  const { isSignedIn, user, signOut, openGate } = useAuthGate();
  const solid = variant !== "overlay";
  const shortName =
    (typeof user?.user_metadata?.display_name === "string" &&
      user.user_metadata.display_name) ||
    user?.email?.split("@")[0] ||
    null;

  const planActive = pathname === "/plan";
  const liveActive = pathname === "/live";
  const membersActive = pathname === "/members";

  const btn =
    "inline-flex min-h-11 w-full items-center justify-center rounded-sm px-3 py-2.5 text-center text-sm font-semibold tracking-wide uppercase transition";

  return (
    <header
      className={
        solid
          ? "relative z-30 w-full max-w-full overflow-x-clip border-b border-white/10 bg-asphalt"
          : "absolute inset-x-0 top-0 z-30 w-full max-w-full overflow-x-clip"
      }
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-8 sm:py-4">
        {/* Brand + auth — never overflow the screen */}
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            className="min-w-0 flex-1 truncate font-display text-lg tracking-[0.06em] text-white uppercase sm:text-2xl"
          >
            Truckers<span className="text-amber-hot">Like</span>Me
          </Link>

          <div className="shrink-0">
            {isSignedIn ? (
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-sm border border-white/25 px-3 py-2 text-xs font-semibold tracking-wide text-white uppercase sm:px-4 sm:text-sm"
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openGate("join-community")}
                className="rounded-sm border border-white/30 px-3 py-2 text-xs font-semibold tracking-wide text-white uppercase sm:px-4 sm:text-sm"
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        {isSignedIn && shortName && (
          <Link
            href="/members"
            className="mt-1 block truncate text-sm text-white/80 transition hover:text-amber-hot"
            title={user?.email ?? undefined}
          >
            Welcome, {shortName}
          </Link>
        )}

        {/* Mobile + tablet: 2 equal buttons that always fit */}
        <nav
          className="mt-3 grid grid-cols-2 gap-2 md:hidden"
          aria-label="Main"
        >
          <Link
            href="/plan"
            className={`${btn} ${
              planActive
                ? "bg-amber text-asphalt"
                : "bg-amber/90 text-asphalt"
            }`}
          >
            Plan
          </Link>
          <Link
            href="/live"
            className={`${btn} ${
              liveActive
                ? "border border-amber bg-amber/15 text-amber-hot"
                : "border border-white/30 bg-white/10 text-white"
            }`}
          >
            Live
          </Link>
          {isSignedIn && (
            <Link
              href="/members"
              className={`${btn} col-span-2 ${
                membersActive
                  ? "border border-amber bg-amber/15 text-amber-hot"
                  : "border border-white/30 bg-white/10 text-white"
              }`}
            >
              Members
            </Link>
          )}
        </nav>

        {/* Desktop nav */}
        <nav
          className="mt-4 hidden flex-wrap items-center gap-2 md:flex"
          aria-label="Main"
        >
          <Link
            href="/plan"
            className={`${btn} w-auto px-5 ${
              planActive
                ? "bg-amber text-asphalt"
                : "bg-amber/90 text-asphalt hover:bg-amber-hot"
            }`}
          >
            Plan a route
          </Link>
          <Link
            href="/live"
            className={`${btn} w-auto px-5 ${
              liveActive
                ? "border border-amber bg-amber/15 text-amber-hot"
                : "border border-white/30 bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            Live activity
          </Link>
          {isSignedIn && (
            <Link
              href="/members"
              className={`${btn} w-auto px-5 ${
                membersActive
                  ? "border border-amber bg-amber/15 text-amber-hot"
                  : "border border-white/30 bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              Members
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
