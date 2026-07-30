"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthGate } from "@/lib/auth-gate";
import { HScroll } from "@/components/h-scroll";

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

  const linkBase =
    "inline-flex shrink-0 items-center justify-center rounded-sm px-4 py-3 text-sm font-semibold tracking-wide uppercase transition";

  const planClass =
    pathname === "/plan"
      ? "bg-amber text-asphalt"
      : "bg-amber/90 text-asphalt hover:bg-amber-hot";
  const liveClass =
    pathname === "/live"
      ? "border border-amber bg-amber/15 text-amber-hot"
      : "border border-white/30 bg-white/10 text-white hover:bg-white/20";
  const membersClass =
    pathname === "/members"
      ? "border border-amber bg-amber/15 text-amber-hot"
      : "border border-white/30 bg-white/10 text-white hover:bg-white/20";

  return (
    <header
      className={
        solid
          ? "relative z-30 border-b border-white/10 bg-asphalt [--h-scroll-fade:#1a1d23]"
          : "absolute inset-x-0 top-0 z-30 [--h-scroll-fade:transparent]"
      }
    >
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-8 sm:py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/"
              className="block font-display text-xl tracking-[0.08em] text-white uppercase sm:text-2xl"
            >
              Truckers<span className="text-amber-hot">Like</span>Me
            </Link>
            {isSignedIn && shortName && (
              <Link
                href="/members"
                className="mt-1 block text-sm text-white/80 transition hover:text-amber-hot"
                title={user?.email ?? undefined}
              >
                Welcome, {shortName}
              </Link>
            )}
          </div>

          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <Link href="/plan" className={`${linkBase} ${planClass}`}>
              Plan a route
            </Link>
            <Link href="/live" className={`${linkBase} ${liveClass}`}>
              Live activity
            </Link>
            {isSignedIn ? (
              <>
                <Link href="/members" className={`${linkBase} ${membersClass}`}>
                  Members
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className={`${linkBase} border border-white/25 text-white hover:bg-white/10`}
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => openGate("join-community")}
                className={`${linkBase} border border-white/30 text-white hover:bg-white/10`}
              >
                Sign in
              </button>
            )}
          </div>

          <div className="shrink-0 md:hidden">
            {isSignedIn ? (
              <button
                type="button"
                onClick={() => void signOut()}
                className={`${linkBase} border border-white/25 text-white`}
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openGate("join-community")}
                className={`${linkBase} border border-white/30 text-white`}
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        {/* Mobile web nav — big taps, scroll if needed, not a native tab bar */}
        <nav className="mt-3 md:hidden" aria-label="Main">
          <HScroll role="navigation" aria-label="Site pages">
            <Link href="/plan" className={`${linkBase} ${planClass}`}>
              Plan a route
            </Link>
            <Link href="/live" className={`${linkBase} ${liveClass}`}>
              Live activity
            </Link>
            {isSignedIn && (
              <Link href="/members" className={`${linkBase} ${membersClass}`}>
                Members
              </Link>
            )}
          </HScroll>
        </nav>
      </div>
    </header>
  );
}
