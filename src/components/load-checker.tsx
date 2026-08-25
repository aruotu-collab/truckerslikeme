"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuthGate } from "@/lib/auth-gate";
import type { ProfitResult } from "@/lib/profit";

const LOCATION_KEY = "tlm_last_location";
const CHECKS_KEY = "tlm_successful_checks";
const GEO_NUDGE_KEY = "tlm_geo_nudge_dismissed";

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

export function LoadChecker() {
  const { isSignedIn, isPro, openGate } = useAuthGate();
  const [location, setLocation] = useState("");
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const [showGeoNudge, setShowGeoNudge] = useState(false);
  const [text, setText] = useState("");
  const [miles, setMiles] = useState("");
  const [rateTotal, setRateTotal] = useState("");
  const [dieselPrice, setDieselPrice] = useState("3.85");
  const [mpg, setMpg] = useState("6.5");
  const [costPerMile, setCostPerMile] = useState("0.65");
  const [loading, setLoading] = useState(false);
  const [extractBusy, setExtractBusy] = useState(false);
  const [extractNotes, setExtractNotes] = useState<string[]>([]);
  const [shotPreview, setShotPreview] = useState<string | null>(null);
  const [marketLow, setMarketLow] = useState<number | null>(null);
  const [marketHigh, setMarketHigh] = useState<number | null>(null);
  const [marketCurrency, setMarketCurrency] = useState<string | null>(null);
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCATION_KEY);
      if (saved) setLocation(saved);
      const n = Number(localStorage.getItem(CHECKS_KEY) || "0");
      if (n >= 3 && !localStorage.getItem(GEO_NUDGE_KEY)) {
        setShowGeoNudge(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadPlanAndHistory = useCallback(() => {
    if (!isSignedIn) {
      setQuotaLabel("Try free — sign in to save (2 free checks / month)");
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
          if (d.isPro) setQuotaLabel("Pro — unlimited checks");
          else if (d.quota?.remaining != null)
            setQuotaLabel(`${d.quota.remaining} free checks left this month`);
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

  function rememberLocation(value: string) {
    setLocation(value);
    try {
      if (value.trim()) localStorage.setItem(LOCATION_KEY, value.trim());
    } catch {
      /* ignore */
    }
  }

  function bumpSuccessfulChecks() {
    try {
      const n = Number(localStorage.getItem(CHECKS_KEY) || "0") + 1;
      localStorage.setItem(CHECKS_KEY, String(n));
      if (n >= 3 && !localStorage.getItem(GEO_NUDGE_KEY)) {
        setShowGeoNudge(true);
      }
    } catch {
      /* ignore */
    }
  }

  function dismissGeoNudge() {
    try {
      localStorage.setItem(GEO_NUDGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowGeoNudge(false);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoNote("Location is not available on this device.");
      return;
    }
    setGeoBusy(true);
    setGeoNote(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const { reverseGeocodeLabel } = await import("@/lib/reverse-geocode");
          const place = await reverseGeocodeLabel(latitude, longitude);
          rememberLocation(place);
          setGeoNote("Using your current location for this check.");
        } catch {
          rememberLocation(
            `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
          );
          setGeoNote("Using your current coordinates.");
        } finally {
          setGeoBusy(false);
        }
      },
      () => {
        setGeoBusy(false);
        setGeoNote(
          "Could not read location. Type a city or place instead — that works fine.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );
  }

  async function extractFromImage(fileOrDataUrl: File | string) {
    setExtractBusy(true);
    setError(null);
    setExtractNotes([]);
    setMarketLow(null);
    setMarketHigh(null);
    setMarketCurrency(null);
    try {
      let dataUrl: string;
      if (typeof fileOrDataUrl === "string") {
        dataUrl = fileOrDataUrl;
      } else {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Could not read image"));
          reader.readAsDataURL(fileOrDataUrl);
        });
      }
      setShotPreview(dataUrl);

      const res = await fetch("/api/loads/extract-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const data = (await res.json()) as {
        extracted?: {
          origin: string | null;
          destination: string | null;
          miles: number | null;
          rateTotal: number | null;
          currency: string | null;
          item: string | null;
          quotes?: number[];
          lowestQuote?: number | null;
          highestQuote?: number | null;
          notes: string[];
          rawText: string | null;
        };
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not read that screenshot.");
        return;
      }
      const ex = data.extracted;
      if (!ex) {
        setError("No job details found in that image.");
        return;
      }

      const money = (n: number) => {
        const c = ex.currency;
        const sym = c === "GBP" ? "£" : c === "EUR" ? "€" : "$";
        return `${sym}${n}`;
      };

      const quotes = (ex.quotes ?? []).filter((q) => Number.isFinite(q) && q > 0);
      const low =
        ex.lowestQuote != null && Number.isFinite(ex.lowestQuote)
          ? ex.lowestQuote
          : quotes.length
            ? Math.min(...quotes)
            : null;
      const high =
        ex.highestQuote != null && Number.isFinite(ex.highestQuote)
          ? ex.highestQuote
          : quotes.length
            ? Math.max(...quotes)
            : null;

      const lines = [
        ex.item ? `Item: ${ex.item}` : null,
        ex.origin && ex.destination
          ? `${ex.origin} → ${ex.destination}`
          : ex.origin || ex.destination,
        ex.miles != null ? `Miles: ${ex.miles}` : null,
        ex.rateTotal != null ? `Rate: ${money(ex.rateTotal)}` : null,
        low != null && high != null
          ? `Market quotes: ${money(low)}–${money(high)}${quotes.length ? ` (${quotes.length} bids)` : ""}`
          : null,
        ex.rawText,
      ].filter(Boolean);
      setText(lines.join("\n"));
      if (ex.miles != null) setMiles(String(ex.miles));
      if (ex.rateTotal != null) {
        setRateTotal(String(ex.rateTotal));
      } else {
        setRateTotal("");
      }

      if (low != null) {
        setMarketLow(low);
        setMarketHigh(high);
        setMarketCurrency(ex.currency);
      }

      const notes = [...(ex.notes ?? [])];
      if (low != null && high != null) {
        notes.push(
          `Other providers bid ${money(low)}–${money(high)}. Enter your bid, or score the lowest to see if winning is even worth it.`,
        );
      } else if (ex.rateTotal == null) {
        notes.push(
          "No pay/quote found — enter the amount you’d bid, then Check load.",
        );
      }
      setExtractNotes(notes);
    } catch {
      setError("Could not process that screenshot.");
    } finally {
      setExtractBusy(false);
    }
  }

  function onPasteJob(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) void extractFromImage(file);
        return;
      }
    }
  }

  async function checkLoad(asPreview?: boolean) {
    setError(null);
    setRequiresPro(false);
    setResult(null);
    setIsPreview(false);

    if (!location.trim()) {
      setError("Tell us where you are now (city or area).");
      return;
    }

    const wantPreview = asPreview || !isSignedIn;
    rememberLocation(location);
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
          currentLocation: location.trim(),
        }),
      });
      const data = (await res.json()) as AnalyzeResponse;
      if (!res.ok) {
        setError(data.error || "Check failed.");
        setRequiresPro(Boolean(data.requiresPro));
        if (data.requiresAuth) openGate("join-community");
        return;
      }
      if (data.result) {
        setResult(data.result);
        bumpSuccessfulChecks();
      }
      if (data.corridor) setCorridor(data.corridor);
      setIsPreview(Boolean(data.preview));
      if (data.parse?.miles && !miles) setMiles(String(data.parse.miles));
      if (data.parse?.rateTotal && !rateTotal)
        setRateTotal(String(data.parse.rateTotal));
      if (data.quota) {
        if (data.quota.pro) setQuotaLabel("Pro — unlimited checks");
        else if (data.quota.remaining != null)
          setQuotaLabel(`${data.quota.remaining} free checks left this month`);
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

  const tripFindHref = `/find?near=${encodeURIComponent(
    corridor?.destination || location || "",
  )}&need=parking&when=overnight`;

  return (
    <div className="space-y-10">
      <section>
        <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
          Load checker
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-wide text-asphalt uppercase sm:text-5xl">
          Should I take this load?
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Tell us where you are, paste the offer, get a clear take / pass score
          after fuel and real costs — anywhere in the world.
        </p>
        {quotaLabel && (
          <p className="mt-3 text-sm text-muted">
            {quotaLabel}
            {!isPro && isSignedIn && (
              <>
                {" · "}
                <Link
                  href="/me#pro"
                  className="font-medium text-amber transition hover:text-asphalt"
                >
                  Upgrade to Pro
                </Link>
              </>
            )}
          </p>
        )}
      </section>

      {showGeoNudge && (
        <div className="border border-amber/40 bg-amber/10 px-4 py-4 sm:px-5">
          <p className="font-display text-sm tracking-wide text-asphalt uppercase">
            Make future checks faster
          </p>
          <p className="mt-2 text-sm text-muted">
            Allow TruckersLikeMe to use your location when you check a load, so
            we can calculate deadhead automatically. We only use it for that
            check — not continuous tracking.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                useCurrentLocation();
                dismissGeoNudge();
              }}
              className="rounded-sm bg-asphalt px-4 py-2.5 text-xs font-semibold tracking-wide text-white uppercase"
            >
              Use my current location
            </button>
            <button
              type="button"
              onClick={dismissGeoNudge}
              className="rounded-sm border border-asphalt/20 px-4 py-2.5 text-xs font-semibold tracking-wide text-asphalt uppercase"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <div>
            <label className="block">
              <span className="font-display text-xs tracking-[0.18em] text-muted uppercase">
                1. Where are you now?
              </span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Birmingham, UK · Lekki · Houston, TX"
                className="mt-2 w-full rounded-sm border border-asphalt/15 bg-white px-4 py-3 text-asphalt placeholder:text-muted/60 focus:border-amber focus:outline-none"
              />
            </label>
            <button
              type="button"
              disabled={geoBusy}
              onClick={() => useCurrentLocation()}
              className="mt-2 text-sm font-medium text-amber transition hover:text-asphalt disabled:opacity-60"
            >
              {geoBusy ? "Getting location…" : "Or use my current location"}
            </button>
            {geoNote && <p className="mt-1 text-xs text-muted">{geoNote}</p>}
          </div>

          <div onPaste={onPasteJob}>
            <label className="block">
              <span className="font-display text-xs tracking-[0.18em] text-muted uppercase">
                2. Paste the load, or paste / upload a screenshot
              </span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={7}
                placeholder={SAMPLE}
                className="mt-2 w-full resize-y rounded-sm border border-asphalt/15 bg-white px-4 py-3 text-asphalt placeholder:text-muted/60 focus:border-amber focus:outline-none"
              />
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="cursor-pointer text-sm font-medium text-amber transition hover:text-asphalt">
                {extractBusy ? "Reading screenshot…" : "Upload screenshot →"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={extractBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void extractFromImage(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => setText(SAMPLE)}
                className="text-sm font-medium text-amber transition hover:text-asphalt"
              >
                Fill sample load →
              </button>
            </div>
            <p className="mt-1 text-xs text-muted">
              Tip: copy a Shiply job screenshot and paste it here (Ctrl+V / ⌘V).
            </p>
            {shotPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shotPreview}
                alt="Job screenshot preview"
                className="mt-3 max-h-40 rounded-sm border border-asphalt/10 object-contain"
              />
            )}
            {extractNotes.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-sm text-muted">
                {extractNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </div>

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
                Total rate / quote
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={rateTotal}
                onChange={(e) => setRateTotal(e.target.value)}
                className="mt-1 w-full rounded-sm border border-asphalt/15 bg-white px-3 py-2.5 text-asphalt focus:border-amber focus:outline-none"
              />
              {marketLow != null && (
                <button
                  type="button"
                  onClick={() => setRateTotal(String(marketLow))}
                  className="mt-1.5 text-left text-sm font-medium text-amber transition hover:text-asphalt"
                >
                  Score at lowest bid (
                  {marketCurrency === "GBP"
                    ? "£"
                    : marketCurrency === "EUR"
                      ? "€"
                      : "$"}
                  {marketLow}
                  ) →
                </button>
              )}
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
                />
              </label>
            </div>
          </details>

          <button
            type="button"
            disabled={loading}
            onClick={() => void checkLoad(false)}
            className="w-full rounded-sm bg-amber px-5 py-3.5 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot disabled:opacity-60 sm:w-auto"
          >
            {loading ? "Checking…" : "Check load"}
          </button>

          {error && (
            <div className="border border-alert/30 bg-red-50 px-4 py-3 text-sm text-alert">
              <p>{error}</p>
              {requiresPro && (
                <Link
                  href="/me#pro"
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
                Your verdict lands here — take / pass, true $/mi, and trip
                suggestions after you check.
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
              {location && (
                <p className="mt-3 text-sm opacity-80">From: {location}</p>
              )}
              {(corridor?.origin || corridor?.destination) && (
                <p className="mt-1 text-sm opacity-80">
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
              </dl>

              <div className="mt-6 border-t border-current/15 pt-5">
                <p className="font-display text-xs tracking-[0.16em] uppercase opacity-80">
                  Trip assistant
                </p>
                <p className="mt-2 text-sm opacity-90">
                  Next: find truck parking near your destination or along the
                  haul.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={tripFindHref}
                    className="rounded-sm bg-asphalt px-4 py-2.5 text-xs font-semibold tracking-wide text-white uppercase"
                  >
                    Find parking
                  </Link>
                  <Link
                    href="/trip?tab=plan"
                    className="rounded-sm border border-current/30 px-4 py-2.5 text-xs font-semibold tracking-wide uppercase"
                  >
                    Open trip tools
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {isSignedIn && history.length > 0 && (
        <section className="border-t border-asphalt/10 pt-10">
          <h2 className="font-display text-2xl tracking-wide text-asphalt uppercase">
            Recent checks
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
                    Net {money(Number(item.net_profit))} · $
                    {Number(item.net_per_mile).toFixed(2)}/mi
                  </p>
                </div>
                <time className="text-sm text-muted">
                  {new Date(item.created_at).toLocaleDateString()}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
