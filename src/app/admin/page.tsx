"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthGate } from "@/lib/auth-gate";
import {
  AdminDashboard,
  type Overview,
} from "@/components/admin-dashboard";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

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
              Site monitor
            </h1>
            <p className="mt-2 max-w-2xl text-muted">
              Traffic, clicks, members, content, and ops — first-party analytics
              for truckerslikeme.com.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-sm border border-asphalt/15 px-4 py-2 text-sm font-semibold uppercase"
            >
              Home
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
          <AdminDashboard
            data={data}
            busyId={busyId}
            onRefresh={() => void load()}
            onUpdateMember={(id, patch) => void updateMember(id, patch)}
          />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
