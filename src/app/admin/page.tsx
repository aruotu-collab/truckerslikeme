"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthGate } from "@/lib/auth-gate";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

type MemberRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: "driver" | "admin";
  plan: "free" | "pro";
  created_at: string;
  ai_queries_used: number | null;
};

type Overview = {
  stats: {
    members: number;
    alerts: number;
    savedRoutes: number;
    visits24h: number;
    visits7d: number;
  };
  members: MemberRow[];
  recentAlerts: {
    id: string;
    kind: string;
    message: string;
    location: string;
    created_at: string;
  }[];
  recentRoutes: {
    id: string;
    origin: string;
    destination: string;
    miles: number | null;
    created_at: string;
  }[];
  errors?: { members?: string | null; visits?: string | null };
};

function timeAgo(iso: string) {
  const mins = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminPage() {
  const router = useRouter();
  const { isSignedIn, isAdmin, loading, openGate } = useAuthGate();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admin/overview", { cache: "no-store" });
    if (res.status === 401) {
      setError("Admin access required. Sign in as aruotu@gmail.com.");
      return;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not load admin data.");
      return;
    }
    setData((await res.json()) as Overview);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!isSignedIn) {
      openGate("join-community");
      return;
    }
    if (!isAdmin) {
      setError("This account is not an admin.");
      return;
    }
    void load();
  }, [loading, isSignedIn, isAdmin, openGate, load]);

  async function updateMember(
    userId: string,
    patch: { plan?: "free" | "pro"; role?: "driver" | "admin" },
  ) {
    setBusyId(userId);
    const res = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...patch }),
    });
    setBusyId(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Update failed.");
      return;
    }
    void load();
  }

  if (loading) {
    return (
      <div className="flex min-h-full flex-col bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-6xl flex-1 px-4 py-10">
          <p className="text-muted">Loading admin…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
              Admin
            </p>
            <h1 className="mt-2 font-display text-3xl tracking-wide text-asphalt uppercase sm:text-4xl">
              Monitor the corridor network
            </h1>
            <p className="mt-2 max-w-2xl text-muted">
              Your admin account has full driver features (Plan, Live, report,
              save) plus member management and traffic overview.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/live"
              className="rounded-sm border border-asphalt/15 px-4 py-2 text-sm font-semibold uppercase"
            >
              Live
            </Link>
            <Link
              href="/plan"
              className="rounded-sm bg-amber px-4 py-2 text-sm font-semibold text-asphalt uppercase"
            >
              Plan
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-sm bg-asphalt px-4 py-2 text-sm font-semibold text-white uppercase"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-6 border-l-4 border-alert bg-white px-4 py-3 text-alert">
            {error}{" "}
            {!isSignedIn && (
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => openGate("join-community")}
              >
                Sign in
              </button>
            )}
            {isSignedIn && !isAdmin && (
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => router.push("/")}
              >
                Go home
              </button>
            )}
          </p>
        )}

        {data && (
          <>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(
                [
                  { label: "Members", value: data.stats.members },
                  { label: "Visits 24h", value: data.stats.visits24h },
                  { label: "Visits 7d", value: data.stats.visits7d },
                  { label: "Driver reports", value: data.stats.alerts },
                  { label: "Saved routes", value: data.stats.savedRoutes },
                ] as const
              ).map((stat) => (
                <div
                  key={stat.label}
                  className="border-l-2 border-amber bg-white px-4 py-3"
                >
                  <p className="font-display text-3xl text-asphalt">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs tracking-wide text-muted uppercase">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {data.errors?.visits && (
              <p className="mt-4 text-sm text-muted">
                Visit stats need{" "}
                <code className="text-asphalt">schema-admin.sql</code> run in
                Supabase. Detailed traffic also lives in{" "}
                <a
                  className="text-amber underline"
                  href="https://analytics.google.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Analytics
                </a>
                .
              </p>
            )}

            <section className="mt-10">
              <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
                Members
              </h2>
              <ul className="mt-4 divide-y divide-asphalt/10 border-y border-asphalt/10">
                {data.members.map((member) => (
                  <li
                    key={member.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-asphalt">
                        {member.display_name || "Driver"}{" "}
                        <span className="text-xs tracking-wide text-muted uppercase">
                          {member.role} · {member.plan}
                        </span>
                      </p>
                      <p className="truncate text-sm text-muted">
                        {member.email || member.id}
                      </p>
                      <p className="text-xs text-muted">
                        Joined {timeAgo(member.created_at)} · AI uses{" "}
                        {member.ai_queries_used ?? 0}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === member.id}
                        onClick={() =>
                          void updateMember(member.id, {
                            plan: member.plan === "pro" ? "free" : "pro",
                          })
                        }
                        className="rounded-sm border border-asphalt/20 px-3 py-2 text-xs font-semibold uppercase"
                      >
                        {member.plan === "pro" ? "Set free" : "Set pro"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === member.id}
                        onClick={() =>
                          void updateMember(member.id, {
                            role: member.role === "admin" ? "driver" : "admin",
                          })
                        }
                        className="rounded-sm border border-asphalt/20 px-3 py-2 text-xs font-semibold uppercase"
                      >
                        {member.role === "admin" ? "Make driver" : "Make admin"}
                      </button>
                    </div>
                  </li>
                ))}
                {data.members.length === 0 && (
                  <li className="py-6 text-muted">No members yet.</li>
                )}
              </ul>
            </section>

            <div className="mt-10 grid gap-10 lg:grid-cols-2">
              <section>
                <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
                  Recent driver reports
                </h2>
                <ul className="mt-4 divide-y divide-asphalt/10 border-y border-asphalt/10">
                  {data.recentAlerts.map((alert) => (
                    <li key={alert.id} className="py-3">
                      <p className="text-xs tracking-wide text-amber uppercase">
                        {alert.kind} · {timeAgo(alert.created_at)}
                      </p>
                      <p className="mt-1 text-asphalt">{alert.message}</p>
                      <p className="text-sm text-muted">{alert.location}</p>
                    </li>
                  ))}
                  {data.recentAlerts.length === 0 && (
                    <li className="py-6 text-muted">No reports yet.</li>
                  )}
                </ul>
              </section>

              <section>
                <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
                  Recent saved routes
                </h2>
                <ul className="mt-4 divide-y divide-asphalt/10 border-y border-asphalt/10">
                  {data.recentRoutes.map((route) => (
                    <li key={route.id} className="py-3">
                      <p className="font-medium text-asphalt">
                        {route.origin} → {route.destination}
                      </p>
                      <p className="text-sm text-muted">
                        {route.miles != null ? `${route.miles} mi · ` : ""}
                        {timeAgo(route.created_at)}
                      </p>
                    </li>
                  ))}
                  {data.recentRoutes.length === 0 && (
                    <li className="py-6 text-muted">No saved routes yet.</li>
                  )}
                </ul>
              </section>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
