"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMarket } from "@/lib/market-context";
import {
  evaluateJob,
  suggestQuote,
  verdictCopy,
  type JobDecision,
} from "@/lib/job-decision";

type Kind = "check" | "price";

type Props = {
  kind: Kind;
  onBack: () => void;
};

const DEFAULT_DIESEL_UK = 1.45;
const DEFAULT_ECONOMY = 28;
const DEFAULT_CPM = 0.35;

export function JobDecisionPanel({ kind, onBack }: Props) {
  const { money } = useMarket();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [loadedMiles, setLoadedMiles] = useState("");
  const [deadheadMiles, setDeadheadMiles] = useState("");
  const [quote, setQuote] = useState("");
  const [feePct, setFeePct] = useState("13");
  const [diesel, setDiesel] = useState(String(DEFAULT_DIESEL_UK));
  const [result, setResult] = useState<JobDecision | null>(null);
  const [suggestion, setSuggestion] = useState<ReturnType<
    typeof suggestQuote
  > | null>(null);
  const [error, setError] = useState<string | null>(null);

  const title =
    kind === "check" ? "Is this job worth it?" : "What should I quote?";
  const eyebrow = kind === "check" ? "Check a job" : "Price my job";

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
            ? "Paste the numbers from a Shiply job. We’ll strip the fee, add empty miles, and show true net £ / mile / hour."
            : "Tell us the miles. We’ll suggest a quote that still pays after Shiply’s fee, fuel, and empty miles."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs tracking-wide text-muted uppercase">
            Pickup
          </span>
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
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
            onChange={(e) => setDestination(e.target.value)}
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
            onChange={(e) => setLoadedMiles(e.target.value)}
            placeholder="120"
            className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
          />
        </label>
        <label className="block">
          <span className="text-xs tracking-wide text-muted uppercase">
            Empty miles to pickup
          </span>
          <input
            type="number"
            min={0}
            value={deadheadMiles}
            onChange={(e) => setDeadheadMiles(e.target.value)}
            placeholder="25"
            className="mt-1 w-full rounded-sm border border-asphalt/15 px-3 py-2.5"
          />
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
          {(origin || destination) && (
            <p className="text-xs opacity-80">
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
