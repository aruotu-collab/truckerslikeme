"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMarket } from "@/lib/market-context";
import {
  deadheadBetweenPlaces,
  milesBetweenPlaces,
} from "@/lib/board-job-decision";
import {
  evaluateJob,
  suggestQuote,
  verdictCopy,
  type JobDecision,
} from "@/lib/job-decision";
import { outlineBtnClass } from "@/lib/ui-buttons";

type Kind = "check" | "price";
type InputMode = "manual" | "screenshot";

type Props = {
  kind: Kind;
  onBack: () => void;
};

type ExtractedJob = {
  origin: string | null;
  destination: string | null;
  miles: number | null;
  rateTotal: number | null;
  lowestQuote?: number | null;
  item: string | null;
  notes?: string[];
};

const LOCATION_KEY = "tlm_last_location";
const DEFAULT_DIESEL_UK = 1.45;
const DEFAULT_ECONOMY = 28;
const DEFAULT_CPM = 0.35;

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

export function JobDecisionPanel({ kind, onBack }: Props) {
  const { money } = useMarket();
  const [inputMode, setInputMode] = useState<InputMode>("manual");
  const [currentLocation, setCurrentLocation] = useState("");
  const [driverCoords, setDriverCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [loadedMiles, setLoadedMiles] = useState("");
  const [deadheadMiles, setDeadheadMiles] = useState("");
  const [deadheadManual, setDeadheadManual] = useState(false);
  const [loadedManual, setLoadedManual] = useState(false);
  const [quote, setQuote] = useState("");
  const [feePct, setFeePct] = useState("13");
  const [diesel, setDiesel] = useState(String(DEFAULT_DIESEL_UK));
  const [result, setResult] = useState<JobDecision | null>(null);
  const [suggestion, setSuggestion] = useState<ReturnType<
    typeof suggestQuote
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractBusy, setExtractBusy] = useState(false);
  const [extractNote, setExtractNote] = useState<string | null>(null);
  const [shotPreview, setShotPreview] = useState<string | null>(null);

  const title =
    kind === "check" ? "Is this job worth it?" : "What should I quote?";
  const eyebrow = kind === "check" ? "Check a job" : "Price my job";

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCATION_KEY);
      if (saved) setCurrentLocation(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (deadheadManual || !currentLocation.trim() || !origin.trim()) return;
    const est = deadheadBetweenPlaces(
      currentLocation,
      origin,
      driverCoords,
    );
    if (est != null) {
      setDeadheadMiles(String(est));
      setGeoNote(`~${est} empty miles from ${currentLocation.trim()} to pickup.`);
    }
  }, [currentLocation, origin, driverCoords, deadheadManual]);

  useEffect(() => {
    if (loadedManual || !origin.trim() || !destination.trim()) return;
    const est = milesBetweenPlaces(origin, destination);
    if (est != null) setLoadedMiles(String(est));
  }, [origin, destination, loadedManual]);

  async function useCurrentLocation() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Location isn’t available in this browser.");
      return;
    }
    setGeoBusy(true);
    setGeoNote(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 60_000,
        });
      });
      const { reverseGeocodePlace } = await import("@/lib/reverse-geocode");
      const place = await reverseGeocodePlace(
        pos.coords.latitude,
        pos.coords.longitude,
      );
      setCurrentLocation(place.label);
      setDriverCoords({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      });
      setDeadheadManual(false);
      try {
        localStorage.setItem(LOCATION_KEY, place.label);
      } catch {
        /* ignore */
      }
      setGeoNote("Location set — empty miles will update when you add pickup.");
    } catch {
      setError("Couldn’t read your location. Type where you are instead.");
    } finally {
      setGeoBusy(false);
    }
  }

  async function extractFromScreenshot(file: File) {
    setExtractBusy(true);
    setError(null);
    setExtractNote(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      setShotPreview(dataUrl);
      const res = await fetch("/api/loads/extract-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [dataUrl] }),
      });
      const data = (await res.json()) as {
        extracted?: ExtractedJob;
        error?: string;
      };
      if (!res.ok || !data.extracted) {
        setError(data.error || "Could not read that screenshot.");
        return;
      }
      const ex = data.extracted;
      if (ex.origin) {
        setOrigin(ex.origin);
        setDeadheadManual(false);
      }
      if (ex.destination) setDestination(ex.destination);
      if (ex.miles != null && ex.miles > 0) {
        setLoadedMiles(String(Math.round(ex.miles)));
        setLoadedManual(true);
      } else if (ex.origin && ex.destination) {
        setLoadedManual(false);
      }
      const rate =
        ex.rateTotal ??
        (ex.lowestQuote != null ? ex.lowestQuote : null);
      if (rate != null && rate > 0 && kind === "check") {
        setQuote(String(Math.round(rate)));
      }
      const parts = [
        ex.origin && ex.destination
          ? `${ex.origin} → ${ex.destination}`
          : null,
        ex.miles != null ? `${ex.miles} loaded mi` : null,
        rate != null ? `£${Math.round(rate)}` : null,
        ex.item,
      ].filter(Boolean);
      setExtractNote(
        parts.length
          ? `Read from screenshot: ${parts.join(" · ")}. Check the fields below.`
          : "Screenshot read — fill any missing fields below.",
      );
      setInputMode("manual");
    } catch {
      setError("Could not process that screenshot.");
    } finally {
      setExtractBusy(false);
    }
  }

  function run() {
    setError(null);
    const loaded = Number(loadedMiles);
    const deadhead = Number(deadheadMiles) || 0;
    if (!Number.isFinite(loaded) || loaded <= 0) {
      setError("Enter loaded miles for the job.");
      return;
    }
    const base = {
      loadedMiles: loaded,
      deadheadMiles: Math.max(0, deadhead),
      dieselPrice: Number(diesel) || DEFAULT_DIESEL_UK,
      economy: DEFAULT_ECONOMY,
      costPerMile: DEFAULT_CPM,
      fuelUnit: "litre" as const,
      economyUnit: "mpg" as const,
      shiplyFeePct: (Number(feePct) || 13) / 100,
    };

    if (kind === "price") {
      const s = suggestQuote(base);
      setSuggestion(s);
      setResult(s.atSuggested);
      return;
    }

    const q = Number(quote);
    if (!Number.isFinite(q) || q <= 0) {
      setError("Enter the customer quote or your intended bid.");
      return;
    }
    setSuggestion(null);
    setResult(evaluateJob({ ...base, quote: q }));
  }

  const verdict = useMemo(
    () => (result ? verdictCopy(result.verdict) : null),
    [result],
  );

  return (
    <section className="space-y-6 border border-asphalt/10 bg-white px-5 py-6 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-medium text-amber transition hover:text-asphalt"
      >
        ← All goals
      </button>

      <div>
        <p className="font-display text-xs tracking-[0.16em] text-amber uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-2 font-display text-2xl tracking-wide text-asphalt uppercase sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          {kind === "check"
            ? "Type where you are and the job details, upload a Shiply screenshot, or paste numbers. We’ll strip the fee, add empty miles, and show true net £ / mile / hour."
            : "Tell us where you are and the miles. We’ll suggest a quote that still pays after Shiply’s fee, fuel, and empty miles."}
        </p>
      </div>

      <div className="inline-flex border border-asphalt/15 bg-concrete/30 p-1">
        {(
          [
            { id: "manual" as const, label: "Type it in" },
            { id: "screenshot" as const, label: "Screenshot" },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setInputMode(m.id)}
            className={`rounded-sm px-4 py-2 text-xs font-semibold tracking-wide uppercase ${
              inputMode === m.id
                ? "bg-white text-asphalt shadow-sm ring-1 ring-amber/40"
                : "text-muted hover:bg-white/60"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {inputMode === "screenshot" ? (
        <div className="space-y-3 border border-dashed border-asphalt/20 bg-concrete/20 px-4 py-5">
          <p className="text-sm text-muted">
            Upload a Shiply job page or results row — we’ll read pickup,
            drop-off, miles, and quote into the form below.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label
              className={`cursor-pointer ${outlineBtnClass("amber")} disabled:opacity-60`}
            >
              {extractBusy ? "Reading…" : "Upload screenshot →"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={extractBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void extractFromScreenshot(file);
                  e.target.value = "";
                }}
              />
            </label>
            <label
              className={`cursor-pointer ${outlineBtnClass("muted")} sm:hidden`}
            >
              Take photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={extractBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void extractFromScreenshot(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {shotPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shotPreview}
              alt="Uploaded Shiply screenshot"
              className="max-h-40 border border-asphalt/15 object-contain"
            />
          ) : null}
          {extractNote ? (
            <p className="text-sm text-asphalt">{extractNote}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="block sm:col-span-2">
          <span className="text-xs tracking-wide text-muted uppercase">
            Where are you now?
          </span>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={currentLocation}
              onChange={(e) => {
                setCurrentLocation(e.target.value);
                setDriverCoords(null);
                setDeadheadManual(false);
                try {
                  if (e.target.value.trim()) {
                    localStorage.setItem(LOCATION_KEY, e.target.value.trim());
                  }
                } catch {
                  /* ignore */
                }
              }}
              placeholder="Warrington · Birmingham"
              className="w-full flex-1 rounded-sm border border-asphalt/15 px-3 py-2.5"
            />
            <button
              type="button"
              disabled={geoBusy}
              onClick={() => void useCurrentLocation()}
              title="Use current location"
              className={`${outlineBtnClass("amber")} shrink-0 disabled:opacity-60`}
            >
              {geoBusy ? "Locating…" : "Use my location"}
            </button>
          </div>
          {geoNote ? (
            <p className="mt-1.5 text-xs text-muted">{geoNote}</p>
          ) : null}
        </div>

        <label className="block">
          <span className="text-xs tracking-wide text-muted uppercase">
            Pickup
          </span>
          <input
            value={origin}
            onChange={(e) => {
              setOrigin(e.target.value);
              setDeadheadManual(false);
            }}
            placeholder="Bolton"
            className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
          />
        </label>
        <label className="block">
          <span className="text-xs tracking-wide text-muted uppercase">
            Drop-off
          </span>
          <input
            value={destination}
            onChange={(e) => {
              setDestination(e.target.value);
              setLoadedManual(false);
            }}
            placeholder="Manchester"
            className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
          />
        </label>
        <label className="block">
          <span className="text-xs tracking-wide text-muted uppercase">
            Loaded miles
          </span>
          <input
            type="number"
            min={1}
            value={loadedMiles}
            onChange={(e) => {
              setLoadedMiles(e.target.value);
              setLoadedManual(true);
            }}
            placeholder="120"
            className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
          />
          {!loadedManual && origin.trim() && destination.trim() ? (
            <p className="mt-1 text-[11px] text-muted">
              Estimated from towns — override if Shiply shows different miles.
            </p>
          ) : null}
        </label>
        <label className="block">
          <span className="text-xs tracking-wide text-muted uppercase">
            Empty miles to pickup
          </span>
          <input
            type="number"
            min={0}
            value={deadheadMiles}
            onChange={(e) => {
              setDeadheadMiles(e.target.value);
              setDeadheadManual(true);
            }}
            placeholder="25"
            className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
          />
          {!deadheadManual &&
          currentLocation.trim() &&
          origin.trim() &&
          deadheadMiles ? (
            <p className="mt-1 text-[11px] text-muted">
              Estimated from your location — override if you know the real
              deadhead.
            </p>
          ) : null}
        </label>
        {kind === "check" && (
          <label className="block">
            <span className="text-xs tracking-wide text-muted uppercase">
              Quote / your bid £
            </span>
            <input
              type="number"
              min={0}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="240"
              className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
            />
          </label>
        )}
        <label className="block">
          <span className="text-xs tracking-wide text-muted uppercase">
            Shiply fee %
          </span>
          <input
            type="number"
            min={0}
            max={30}
            value={feePct}
            onChange={(e) => setFeePct(e.target.value)}
            className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
          />
        </label>
        <label className="block">
          <span className="text-xs tracking-wide text-muted uppercase">
            Diesel £ / litre
          </span>
          <input
            type="number"
            step={0.01}
            value={diesel}
            onChange={(e) => setDiesel(e.target.value)}
            className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
          />
        </label>
      </div>

      {error && <p className="text-sm text-alert">{error}</p>}

      <button
        type="button"
        onClick={run}
        className="rounded-sm bg-amber px-5 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase"
      >
        {kind === "check" ? "Check this job →" : "Suggest my quote →"}
      </button>

      {suggestion && (
        <div className="space-y-3 border border-asphalt/10 bg-concrete/30 px-4 py-4">
          <p className="font-display text-xs tracking-[0.14em] text-amber uppercase">
            Suggested quote
          </p>
          <p className="font-display text-3xl tracking-wide text-asphalt">
            {money(suggestion.suggested)}
          </p>
          <p className="text-sm text-muted">{suggestion.note}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric
              label="At suggested"
              value={money(suggestion.atSuggested.estimatedNet)}
              hint={`${money(suggestion.atSuggested.netPerMile)}/mi · ${money(suggestion.atSuggested.netPerHour)}/hr`}
            />
            <Metric
              label="Floor"
              value={money(suggestion.floor)}
              hint={`Net ${money(suggestion.atFloor.estimatedNet)} · ${money(suggestion.atFloor.netPerMile)}/mi`}
            />
          </div>
        </div>
      )}

      {result && verdict && (
        <div className={`space-y-4 border px-4 py-4 ${verdict.tone}`}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="font-display text-xs tracking-[0.14em] uppercase opacity-80">
                Verdict
              </p>
              <p className="mt-1 font-display text-2xl tracking-wide uppercase">
                {verdict.title}
              </p>
            </div>
            <p className="font-mono text-sm font-semibold">
              Score {result.quality}/100
            </p>
          </div>
          <p className="text-sm">{result.summary}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Est. net" value={money(result.estimatedNet)} />
            <Metric label="£ / mile" value={money(result.netPerMile)} />
            <Metric label="£ / hour" value={money(result.netPerHour)} />
            <Metric
              label="Total miles"
              value={`${result.totalMiles}`}
              hint={`${result.loadedMiles} loaded · ${result.deadheadMiles} empty`}
            />
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <p>
              Quote {money(result.customerQuote)} · fee{" "}
              {money(result.shiplyFee)}
            </p>
            <p>Fuel ~{money(result.fuelCost)}</p>
            <p>Other costs ~{money(result.operatingCost)}</p>
          </div>
          {(origin || destination || currentLocation) && (
            <p className="text-xs opacity-80">
              {currentLocation ? `From ${currentLocation} · ` : ""}
              {[origin, destination].filter(Boolean).join(" → ")}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/map"
              className="rounded-sm bg-asphalt px-4 py-2 text-xs font-semibold tracking-wide text-white uppercase"
            >
              Find a backload on Job Board →
            </Link>
            <Link
              href="/run"
              className="rounded-sm border border-asphalt/20 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-asphalt uppercase"
            >
              Build a full run
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border border-asphalt/10 bg-white/70 px-3 py-2">
      <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-asphalt">
        {value}
      </p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
