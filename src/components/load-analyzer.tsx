"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuthGate } from "@/lib/auth-gate";
import type { ProfitResult } from "@/lib/profit";

type AnalyzeResponse = {
  result?: ProfitResult;
  parse?: {
    origin: string | null;
    destination: string | null;
    miles: number | null;
    rateTotal: number | null;
    ratePerMile: number | null;
    notes: string[];
  };
  corridor?: { origin: string | null; destination: string | null };
  assumptions?: {
    dieselPrice: number;
    mpg: number;
    costPerMile: number;
    tolls: number;
  };
  preview?: boolean;
  quota?: {
    pro: boolean;
    used: number;
    limit: number | null;
    remaining: number | null;
  } | null;
  error?: string;
  requiresAuth?: boolean;
  requiresPro?: boolean;
};

type HistoryItem = {
  id: string;
  origin: string | null;
  destination: string | null;
  miles: number;
  rate_total: number;
  net_profit: number;
  net_per_mile: number;
  score: string;
  created_at: string;
};

const scoreTone: Record<string, string> = {
  great: "text-emerald-700 bg-emerald-50 border-emerald-200",
  good: "text-sky-deep bg-sky-50 border-sky-200",
  marginal: "text-amber bg-amber/10 border-amber/30",
  skip: "text-alert bg-red-50 border-red-200",
};

const SAMPLE = `Dallas, TX → Atlanta, GA
Miles: 820
Linehaul: $2,460
$3.00 / mi`;

function money(n: number) {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function LoadAnalyzer() {
  const { isSignedIn, isPro, openGate } = useAuthGate();
  const [text, setText] = useState("");
  const [miles, setMiles] = useState("");
  const [rateTotal, setRateTotal] = useState("");
  const [dieselPrice, setDieselPrice] = useState("3.85");
  const [mpg, setMpg] = useState("6.5");
  const [costPerMile, setCostPerMile] = useState("0.65");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresPro, setRequiresPro] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [result, setResult] = useState<ProfitResult | null>(null);
  const [corridor, setCorridor] = useState<{
    origin: string | null;
    destination: string | null;
  } | null>(null);
  const [quotaLabel, setQuotaLabel] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const loadPlanAndHistory = useCallback(() => {
    if (!isSignedIn) {
      setQuotaLabel("Try free now — sign in to save history (2 free / month)");
      setHistory([]);
      return;
    }
    fetch("/api/me/plan")
      .then((r) => r.json())
      .then(
        (d: {
          isPro?: boolean;
          quota?: { remaining: number | null };
          assumptions?: {
            mpg?: number;
            costPerMile?: number;
            dieselPriceOverride?: number | null;
          } | null;
        }) => {
          if (d.isPro) setQuotaLabel("Pro — unlimited analyses");
          else if (d.quota?.remaining != null)
            setQuotaLabel(`${d.quota.remaining} free analyses left this month`);
          if (d.assumptions?.mpg) setMpg(String(d.assumptions.mpg));
          if (d.assumptions?.costPerMile)
            setCostPerMile(String(d.assumptions.costPerMile));
          if (d.assumptions?.dieselPriceOverride != null)
            setDieselPrice(String(d.assumptions.dieselPriceOverride));
        },
      )
      .catch(() => {});

    fetch("/api/loads/history")
      .then((r) => r.json())
      .then((d: { items?: HistoryItem[] }) => setHistory(d.items ?? []))
      .catch(() => setHistory([]));
  }, [isSignedIn]);

  useEffect(() => {
    loadPlanAndHistory();
  }, [loadPlanAndHistory]);

  async function runAnalyze(asPreview?: boolean) {
    setError(null);
    setRequiresPro(false);
    setResult(null);
    setIsPreview(false);

    const wantPreview = asPreview || !isSignedIn;
    if (!isSignedIn && !wantPreview) {
      openGate("join-community");
      setError("Sign in to save this analysis.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/loads/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim() || undefined,
          miles: miles ? Number(miles) : undefined,
          rateTotal: rateTotal ? Number(rateTotal) : undefined,
          dieselPrice: dieselPrice ? Number(dieselPrice) : undefined,
          mpg: mpg ? Number(mpg) : undefined,
          costPerMile: costPerMile ? Number(costPerMile) : undefined,
          preview: wantPreview,
        }),
      });
      const data = (await res.json()) as AnalyzeResponse;
      if (!res.ok) {
        setError(data.error || "Analysis failed.");
        setRequiresPro(Boolean(data.requiresPro));
        if (data.requiresAuth) openGate("join-community");
        return;
      }
      if (data.result) setResult(data.result);
      if (data.corridor) setCorridor(data.corridor);
      setIsPreview(Boolean(data.preview));
      if (data.parse?.miles && !miles) setMiles(String(data.parse.miles));
      if (data.parse?.rateTotal && !rateTotal)
        setRateTotal(String(data.parse.rateTotal));
      if (data.quota) {
        if (data.quota.pro) setQuotaLabel("Pro — unlimited analyses");
        else if (data.quota.remaining != null)
          setQuotaLabel(
            `${data.quota.remaining} free analyses left this month`,
          );
      }
      if (isSignedIn && !data.preview) {
        void fetch("/api/loads/history")
          .then((r) => r.json())
          .then((d: { items?: HistoryItem[] }) => setHistory(d.items ?? []));
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-10">
      <section>
        <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
          Load money
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-wide text-asphalt uppercase sm:text-5xl">
          True profit score
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Paste a rate confirmation. We pull miles and pay, subtract fuel and
          real operating costs, and tell you take it or pass — before you book.
        </p>
        {quotaLabel && (
          <p className="mt-3 text-sm text-muted">
            {quotaLabel}
            {!isPro && isSignedIn && (
              <>
                {" · "}
                <Link
                  href="/members#pro"
                  className="font-medium text-amber transition hover:text-asphalt"
                >
                  Upgrade to Pro
                </Link>
              </>
            )}
          </p>
        )}
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <label className="block">
            <span className="font-display text-xs tracking-[0.18em] text-muted uppercase">
              Paste rate conf / load offer
            </span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={SAMPLE}
              className="mt-2 w-full resize-y rounded-sm border border-asphalt/15 bg-white px-4 py-3 text-asphalt placeholder:text-muted/60 focus:border-amber focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => setText(SAMPLE)}
            className="text-sm font-medium text-amber transition hover:text-asphalt"
          >
            Fill sample load →
          </button>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs tracking-wide text-muted uppercase">
                Miles
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={miles}
                onChange={(e) => setMiles(e.target.value)}
                className="mt-1 w-full rounded-sm border border-asphalt/15 bg-white px-3 py-2.5 text-asphalt focus:border-amber focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs tracking-wide text-muted uppercase">
                Total rate ($)
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={rateTotal}
                onChange={(e) => setRateTotal(e.target.value)}
                className="mt-1 w-full rounded-sm border border-asphalt/15 bg-white px-3 py-2.5 text-asphalt focus:border-amber focus:outline-none"
              />
            </label>
          </div>

          <details className="border border-asphalt/10 bg-white/60 px-4 py-3">
            <summary className="cursor-pointer font-display text-xs tracking-[0.16em] text-muted uppercase">
              Cost assumptions
            </summary>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <label className="block">
                <span className="text-xs text-muted">Diesel $/gal</span>
                <input
                  type="number"
                  step="0.01"
                  value={dieselPrice}
                  onChange={(e) => setDieselPrice(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-asphalt/15 px-2 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted">MPG</span>
                <input
                  type="number"
                  step="0.1"
                  value={mpg}
                  onChange={(e) => setMpg(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-asphalt/15 px-2 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted">Other $/mi</span>
                <input
                  type="number"
                  step="0.01"
                  value={costPerMile}
                  onChange={(e) => setCostPerMile(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-asphalt/15 px-2 py-2 text-sm"
                  title="Truck payment, insurance, maintenance"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-muted">
              “Other $/mi” covers payment, insurance, maintenance — not fuel.
              Signed-in uses are saved to your profile.
            </p>
          </details>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => void runAnalyze(false)}
              className="rounded-sm bg-amber px-5 py-3.5 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot disabled:opacity-60"
            >
              {loading
                ? "Calculating…"
                : isSignedIn
                  ? "Score this load"
                  : "Try free score"}
            </button>
            {isSignedIn && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void runAnalyze(true)}
                className="rounded-sm border border-asphalt/15 px-5 py-3.5 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-concrete/60 disabled:opacity-60"
              >
                Preview only
              </button>
            )}
          </div>

          {error && (
            <div className="border border-alert/30 bg-red-50 px-4 py-3 text-sm text-alert">
              <p>{error}</p>
              {requiresPro && (
                <Link
                  href="/members#pro"
                  className="mt-2 inline-block font-semibold uppercase tracking-wide text-asphalt"
                >
                  Upgrade to Pro →
                </Link>
              )}
            </div>
          )}
        </div>

        <div>
          {!result ? (
            <div className="flex h-full min-h-[280px] items-center border border-dashed border-asphalt/20 bg-white/40 px-6 py-10">
              <p className="text-muted">
                Your score lands here: take-home per mile, fuel burn, and a clear
                take / pass call.
              </p>
            </div>
          ) : (
            <div
              className={`animate-fade-in border px-5 py-6 sm:px-6 ${
                scoreTone[result.score] ?? "border-asphalt/15 bg-white"
              }`}
            >
              {isPreview && (
                <p className="mb-3 text-xs font-semibold tracking-wide uppercase opacity-80">
                  Preview — not saved
                  {!isSignedIn && (
                    <>
                      {" · "}
                      <button
                        type="button"
                        onClick={() => openGate("join-community")}
                        className="underline"
                      >
                        Sign in to save
                      </button>
                    </>
                  )}
                </p>
              )}
              <p className="font-display text-sm tracking-[0.2em] uppercase opacity-80">
                Verdict
              </p>
              <p className="mt-1 font-display text-4xl tracking-wide uppercase">
                {result.label}
              </p>
              <p className="mt-2 text-base leading-relaxed opacity-90">
                {result.summary}
              </p>

              {(corridor?.origin || corridor?.destination) && (
                <p className="mt-4 text-sm opacity-80">
                  {[corridor.origin, corridor.destination]
                    .filter(Boolean)
                    .join(" → ")}
                </p>
              )}

              <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-current/15 pt-5">
                <div>
                  <dt className="text-xs uppercase tracking-wide opacity-70">
                    Gross RPM
                  </dt>
                  <dd className="mt-1 text-2xl font-medium">
                    ${result.ratePerMile.toFixed(2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide opacity-70">
                    True $/mi
                  </dt>
                  <dd className="mt-1 text-2xl font-medium">
                    ${result.netPerMile.toFixed(2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide opacity-70">
                    Net profit
                  </dt>
                  <dd className="mt-1 text-xl font-medium">
                    {money(result.netProfit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide opacity-70">
                    Net / hour
                  </dt>
                  <dd className="mt-1 text-xl font-medium">
                    {money(result.netPerHour)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide opacity-70">
                    Fuel
                  </dt>
                  <dd className="mt-1 text-lg">
                    {money(result.fuelCost)}{" "}
                    <span className="text-sm opacity-70">
                      ({result.fuelGallons} gal)
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide opacity-70">
                    After fuel $/mi
                  </dt>
                  <dd className="mt-1 text-lg">
                    ${result.afterFuelPerMile.toFixed(2)}
                  </dd>
                </div>
              </dl>

              <p className="mt-5 text-xs opacity-70">
                Assumes {result.hoursEstimate}h drive time at ~52 mph average.
                Costs exclude detention risks and empty miles.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                {isPreview && isSignedIn && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void runAnalyze(false)}
                    className="rounded-sm bg-asphalt px-4 py-2.5 text-xs font-semibold tracking-wide text-white uppercase"
                  >
                    Save to history
                  </button>
                )}
                <Link
                  href="/find?need=along"
                  className="rounded-sm bg-asphalt px-4 py-2.5 text-xs font-semibold tracking-wide text-white uppercase"
                >
                  Along route services
                </Link>
                <Link
                  href="/live"
                  className="rounded-sm border border-current/30 px-4 py-2.5 text-xs font-semibold tracking-wide uppercase"
                >
                  Check live intel
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {isSignedIn && history.length > 0 && (
        <section className="border-t border-asphalt/10 pt-10">
          <h2 className="font-display text-2xl tracking-wide text-asphalt uppercase">
            Recent scores
          </h2>
          <ul className="mt-6 divide-y divide-asphalt/10 border-y border-asphalt/10">
            {history.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between"
              >
                <div>
                  <p className="text-lg text-asphalt">
                    {[item.origin, item.destination]
                      .filter(Boolean)
                      .join(" → ") || `${item.miles} mi load`}
                  </p>
                  <p className="text-sm text-muted">
                    {item.miles} mi · Gross {money(Number(item.rate_total))} ·
                    Net {money(Number(item.net_profit))} (
                    ${Number(item.net_per_mile).toFixed(2)}/mi)
                  </p>
                </div>
                <div className="text-sm">
                  <span className="font-display tracking-wide text-asphalt uppercase">
                    {item.score}
                  </span>
                  <time className="ml-3 text-muted">
                    {new Date(item.created_at).toLocaleDateString()}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
