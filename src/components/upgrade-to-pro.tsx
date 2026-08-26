"use client";

import { useState } from "react";
import Link from "next/link";
import { trackClick } from "@/lib/track-click";

export function UpgradeToProButton({
  isPro,
  stripeReady = true,
}: {
  isPro: boolean;
  stripeReady?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isPro) {
    return (
      <p className="mt-4 inline-flex rounded-sm border border-amber/40 bg-amber/10 px-4 py-2 text-sm font-semibold tracking-wide text-asphalt uppercase">
        Pro active
      </p>
    );
  }

  async function startCheckout() {
    trackClick("billing", "Upgrade to Pro");
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: "month" }),
      });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        alreadyPro?: boolean;
      };
      if (!res.ok) {
        setError(data.error || "Checkout failed.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("No checkout URL returned.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!stripeReady) {
    return (
      <div className="mt-5 max-w-lg space-y-3">
        <p className="text-sm text-muted">
          Self-serve checkout ships once Stripe is connected. Until then, free
          members get 2 saved load scores per month — and admins can grant Pro
          from the console.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-sm bg-amber px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot"
          >
            Check a load free
          </Link>
          <span className="inline-flex items-center rounded-sm border border-asphalt/15 px-5 py-3 text-sm text-muted">
            Pro checkout — coming with Stripe
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        disabled={loading}
        onClick={() => void startCheckout()}
        className="rounded-sm bg-amber px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot disabled:opacity-50"
      >
        {loading ? "Redirecting…" : "Upgrade to Pro"}
      </button>
      {error && <p className="mt-2 text-sm text-alert">{error}</p>}
    </div>
  );
}
