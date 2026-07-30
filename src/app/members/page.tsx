"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthGate } from "@/lib/auth-gate";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function MembersPage() {
  const router = useRouter();
  const { isSignedIn, user, loading, openGate, signOut } = useAuthGate();

  useEffect(() => {
    if (loading) return;
    if (!isSignedIn) {
      openGate("join-community");
    }
  }, [loading, isSignedIn, openGate]);

  const displayName =
    (typeof user?.user_metadata?.display_name === "string" &&
      user.user_metadata.display_name) ||
    user?.email?.split("@")[0] ||
    "Driver";

  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <SiteHeader variant="solid" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        {loading ? (
          <p className="text-muted">Loading your account…</p>
        ) : !isSignedIn ? (
          <div className="max-w-lg">
            <h1 className="font-display text-4xl tracking-wide text-asphalt uppercase">
              Members
            </h1>
            <p className="mt-3 text-muted">
              Sign in to view your profile, saved routes, and membership.
            </p>
            <button
              type="button"
              onClick={() => openGate("join-community")}
              className="mt-6 rounded-sm bg-amber px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot"
            >
              Sign in
            </button>
          </div>
        ) : (
          <div className="animate-fade-in space-y-12">
            <section>
              <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
                Your account
              </p>
              <h1 className="mt-2 font-display text-4xl tracking-wide text-asphalt uppercase sm:text-5xl">
                {displayName}
              </h1>
              <p className="mt-3 text-lg text-muted">{user?.email}</p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                <span>
                  Plan: <strong className="text-asphalt">Free</strong>
                </span>
                {joined && (
                  <span>
                    Joined: <strong className="text-asphalt">{joined}</strong>
                  </span>
                )}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/#plan"
                  className="rounded-sm bg-asphalt px-5 py-3 text-sm font-semibold tracking-wide text-white uppercase transition hover:bg-road"
                >
                  Plan a route
                </Link>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="rounded-sm border border-asphalt/15 px-5 py-3 text-sm text-muted transition hover:bg-concrete/60"
                >
                  Sign out
                </button>
              </div>
            </section>

            <section className="border-t border-asphalt/10 pt-10">
              <h2 className="font-display text-2xl tracking-wide text-asphalt uppercase">
                Saved routes
              </h2>
              <p className="mt-2 max-w-xl text-muted">
                Routes you save from the planner will show up here. Run the
                database schema in Supabase, then save a corridor to populate
                this list.
              </p>
              <div className="mt-6 border border-dashed border-asphalt/20 bg-white/50 px-5 py-10 text-center">
                <p className="font-display text-sm tracking-[0.18em] text-muted uppercase">
                  No saved routes yet
                </p>
                <Link
                  href="/#plan"
                  className="mt-4 inline-block text-sm font-medium text-amber transition hover:text-asphalt"
                >
                  Search a route to get started →
                </Link>
              </div>
            </section>

            <section className="border-t border-asphalt/10 pt-10">
              <h2 className="font-display text-2xl tracking-wide text-asphalt uppercase">
                TruckersLikeMe Pro
              </h2>
              <p className="mt-2 max-w-xl text-muted">
                Unlimited AI trip tips, advanced corridor planning, and premium
                alerts — coming soon.
              </p>
              <button
                type="button"
                disabled
                className="mt-5 cursor-not-allowed rounded-sm bg-amber/50 px-5 py-3 text-sm font-semibold tracking-wide text-asphalt/70 uppercase"
              >
                Upgrade — coming soon
              </button>
            </section>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
