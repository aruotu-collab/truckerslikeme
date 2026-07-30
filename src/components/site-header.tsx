"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthGate } from "@/lib/auth-gate";

type SiteHeaderProps = {
  variant?: "overlay" | "solid";
};

export function SiteHeader({ variant = "overlay" }: SiteHeaderProps) {
  const pathname = usePathname();
  const { isSignedIn, user, signOut, openGate } = useAuthGate();
  const solid = variant === "solid";
  const shortName =
    (typeof user?.user_metadata?.display_name === "string" &&
      user.user_metadata.display_name) ||
    user?.email?.split("@")[0] ||
    null;

  const linkBase =
    "rounded-sm px-3 py-2 text-xs font-semibold tracking-wide uppercase transition sm:px-4 sm:text-sm";

  return (
    <header
      className={
        solid
          ? "relative z-30 border-b border-asphalt/10 bg-asphalt"
          : "absolute inset-x-0 top-0 z-30"
      }
    >
      <div className="app-header-inner mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-8 sm:py-4">
        <div className="min-w-0 shrink-0">
          <Link
            href="/"
            className="block font-display text-base tracking-[0.08em] text-white uppercase sm:text-2xl"
          >
            Truckers<span className="text-amber-hot">Like</span>Me
          </Link>
          {isSignedIn && shortName && (
            <Link
              href="/members"
              className="mt-0.5 block max-w-[9rem] truncate text-[11px] text-white/75 transition hover:text-amber-hot sm:max-w-none sm:text-sm"
              title={user?.email ?? undefined}
            >
              Welcome, {shortName}
            </Link>
          )}
        </div>

        <nav className="ml-auto hidden items-center justify-end gap-2 md:flex md:gap-3">
          <Link
            href="/plan"
            className={`${linkBase} ${
              pathname === "/plan"
                ? "bg-amber text-asphalt"
                : "bg-amber/90 text-asphalt hover:bg-amber-hot"
            }`}
          >
            Plan a route
          </Link>
          <Link
            href="/live"
            className={`${linkBase} ${
              pathname === "/live"
                ? "border border-amber bg-amber/15 text-amber-hot"
                : "border border-white/30 bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            Live activity
          </Link>
          {isSignedIn ? (
            <>
              <Link
                href="/members"
                className={`${linkBase} ${
                  pathname === "/members"
                    ? "border border-amber bg-amber/15 text-amber-hot"
                    : "border border-white/30 bg-white/10 font-medium text-white hover:bg-white/20"
                }`}
              >
                Members
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-sm border border-white/25 bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/20"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => openGate("join-community")}
              className="rounded-sm border border-white/30 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Sign in
            </button>
          )}
        </nav>

        <div className="ml-auto flex shrink-0 items-center md:hidden">
          {isSignedIn ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-sm border border-white/25 bg-white/10 px-3 py-2 text-xs text-white"
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openGate("join-community")}
              className="rounded-sm border border-white/30 px-3 py-2 text-xs font-medium text-white"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
