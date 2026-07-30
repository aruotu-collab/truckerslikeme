"use client";

import Link from "next/link";
import { useAuthGate } from "@/lib/auth-gate";

type SiteHeaderProps = {
  variant?: "overlay" | "solid";
};

export function SiteHeader({ variant = "overlay" }: SiteHeaderProps) {
  const { isSignedIn, user, signOut, openGate } = useAuthGate();
  const solid = variant === "solid";

  return (
    <header
      className={
        solid
          ? "relative z-30 border-b border-asphalt/10 bg-asphalt"
          : "absolute inset-x-0 top-0 z-30"
      }
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="shrink-0 font-display text-lg tracking-[0.08em] text-white uppercase sm:text-2xl"
        >
          Truckers<span className="text-amber-hot">Like</span>Me
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <Link
            href="/#plan"
            className="rounded-sm bg-amber px-3 py-1.5 text-xs font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot sm:px-4 sm:text-sm"
          >
            Plan a route
          </Link>
          <Link
            href="/#live"
            className="rounded-sm border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-white/20 sm:px-4 sm:text-sm"
          >
            See live activity
          </Link>
          {isSignedIn ? (
            <>
              <Link
                href="/members"
                className="hidden max-w-[14rem] truncate text-xs text-white/85 transition hover:text-amber-hot sm:inline sm:text-sm"
                title={user?.email ?? undefined}
              >
                {user?.email}
              </Link>
              <Link
                href="/members"
                className="rounded-sm border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 sm:text-sm"
              >
                Members
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-sm border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white transition hover:bg-white/20 sm:text-sm"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => openGate("join-community")}
              className="rounded-sm border border-white/30 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10 sm:text-sm"
            >
              Sign in
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
