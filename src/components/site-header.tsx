"use client";

import Link from "next/link";
import { useAuthGate } from "@/lib/auth-gate";

export function SiteHeader() {
  const { isSignedIn, user, signOut, openGate } = useAuthGate();

  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="shrink-0 font-display text-lg tracking-[0.08em] text-white uppercase sm:text-2xl"
        >
          Truckers<span className="text-amber-hot">Like</span>Me
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <a
            href="#plan"
            className="rounded-sm bg-amber px-3 py-1.5 text-xs font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot sm:px-4 sm:text-sm"
          >
            Plan a route
          </a>
          <a
            href="#live"
            className="rounded-sm border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-white/20 sm:px-4 sm:text-sm"
          >
            See live activity
          </a>
          {isSignedIn ? (
            <>
              <span
                className="hidden max-w-[14rem] truncate text-xs text-white/85 sm:inline sm:text-sm"
                title={user?.email ?? undefined}
              >
                {user?.email}
              </span>
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
