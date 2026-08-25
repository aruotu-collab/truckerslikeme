"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthGate } from "@/lib/auth-gate";
import { useMarket } from "@/lib/market-context";

type SiteHeaderProps = {
  variant?: "overlay" | "solid";
};

const primaryNav = [
  {
    href: "/",
    label: "Check",
    match: (p: string) =>
      p === "/" || p.startsWith("/check") || p.startsWith("/money"),
  },
  {
    href: "/find",
    label: "Find",
    match: (p: string) => p.startsWith("/find"),
  },
  {
    href: "/trip",
    label: "Trip",
    match: (p: string) =>
      p.startsWith("/trip") || p.startsWith("/live") || p.startsWith("/plan"),
  },
  {
    href: "/me",
    label: "Me",
    match: (p: string) => p.startsWith("/me") || p.startsWith("/members"),
  },
] as const;

export function SiteHeader({ variant = "solid" }: SiteHeaderProps) {
  const pathname = usePathname();
  const { isSignedIn, isAdmin, user, signOut, openGate } = useAuthGate();
  const { market, resolved } = useMarket();
  const solid = variant !== "overlay";
  const shortName =
    (typeof user?.user_metadata?.display_name === "string" &&
      user.user_metadata.display_name) ||
    user?.email?.split("@")[0] ||
    null;

  const linkBase =
    "shrink-0 text-sm font-semibold tracking-wide text-white/75 uppercase transition hover:text-white";
  const linkActive = "text-amber-hot";

  return (
    <header
      className={
        solid
          ? "relative z-30 w-full max-w-full overflow-x-clip border-b border-white/10 bg-asphalt"
          : "absolute inset-x-0 top-0 z-30 w-full max-w-full overflow-x-clip"
      }
    >
      {/* Primary bar — brand left, nav + account right (ZeroSpenders-style) */}
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-8 sm:py-3.5">
        <div className="min-w-0 shrink">
          <Link
            href="/"
            className="block truncate font-display text-lg tracking-[0.06em] text-white uppercase sm:text-xl"
          >
            Truckers<span className="text-amber-hot">Like</span>Me
            {resolved ? (
              <span className="text-white/70"> - {market.countryLabel}</span>
            ) : null}
          </Link>
          <p className="mt-0.5 hidden truncate text-xs text-white/45 sm:block">
            Load decisions · Places drivers trust
          </p>
        </div>

        <nav
          className="ml-auto hidden min-w-0 items-center gap-5 md:flex"
          aria-label="Main"
        >
          {primaryNav.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${linkBase} ${active ? linkActive : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={`${linkBase} ${
                pathname.startsWith("/admin") ? linkActive : ""
              }`}
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
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

      {/* Secondary bar — compact horizontal links on small screens only */}
      <div className="border-t border-white/10 md:hidden">
        <nav
          className="h-scroll mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-3 py-2 sm:px-8"
          aria-label="Sections"
        >
          {primaryNav.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-sm px-3 py-2 text-xs font-semibold tracking-wide uppercase transition ${
                  active
                    ? "bg-amber text-asphalt"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={`shrink-0 rounded-sm px-3 py-2 text-xs font-semibold tracking-wide uppercase transition ${
                pathname.startsWith("/admin")
                  ? "bg-amber text-asphalt"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              Admin
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
