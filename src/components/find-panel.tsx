"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthGate } from "@/lib/auth-gate";
import { useMarket } from "@/lib/market-context";
import {
  confidenceMeta,
  type PlaceConfidence,
  type PlaceKind,
  type PlaceResult,
} from "@/lib/places";

const truckOptions = [
  { id: "van", label: "Van" },
  { id: "rigid", label: "Rigid" },
  { id: "artic", label: "Artic" },
  { id: "40ft", label: "40ft container" },
] as const;

const whenOptions = [
  { id: "now", label: "Now" },
  { id: "tonight", label: "Tonight" },
  { id: "overnight", label: "Overnight" },
  { id: "tomorrow", label: "Tomorrow" },
] as const;

const priorityOptions = [
  { id: "safe", label: "Safe & secure" },
  { id: "cheap", label: "Cheapest" },
  { id: "closest", label: "Closest" },
  { id: "overnight", label: "Overnight OK" },
] as const;

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-sm px-3 py-2 text-sm font-semibold tracking-wide uppercase transition ${
        active
          ? "bg-amber text-asphalt"
          : "border border-asphalt/15 bg-white text-asphalt hover:bg-concrete/50"
      }`}
    >
      {children}
    </button>
  );
}

export function FindPanel() {
  const params = useSearchParams();
  const { isSignedIn, openGate } = useAuthGate();
  const { setFromCountryCode } = useMarket();
  const [near, setNear] = useState("");
  const [kind, setKind] = useState<PlaceKind>("parking");
  const [truck, setTruck] = useState("artic");
  const [when, setWhen] = useState("overnight");
  const [priority, setPriority] = useState("safe");
  const [freeText, setFreeText] = useState("");
  const [showDescribe, setShowDescribe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null);

  useEffect(() => {
    const n = params.get("near");
    const need = params.get("need");
    const w = params.get("when");
    if (n) setNear(n);
    if (need === "diesel" || need === "repair" || need === "parking") {
      setKind(need);
    }
    if (w) setWhen(w);
  }, [params]);

  const title = useMemo(() => {
    if (kind === "diesel") return "Nearest fuel";
    if (kind === "repair") return "Nearest repair";
    return "Nearest parking";
  }, [kind]);

  async function runSearch() {
    setError(null);
    setResults([]);
    if (!near.trim()) {
      setError("Enter a place — city, port, yard, or area.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          near: near.trim(),
          kind,
          when,
          truck,
          priority,
          freeText: freeText.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        results?: PlaceResult[];
        provider?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Search failed.");
        return;
      }
      setResults(data.results ?? []);
      setProvider(data.provider ?? null);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function sendFeedback(placeId: string, didPark: boolean) {
    if (!isSignedIn) {
      openGate("join-community");
      return;
    }
    setFeedbackBusy(placeId);
    try {
      await fetch("/api/places/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, didPark }),
      });
    } finally {
      setFeedbackBusy(null);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Location not available — type a place instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { reverseGeocodePlace } = await import("@/lib/reverse-geocode");
          const place = await reverseGeocodePlace(
            pos.coords.latitude,
            pos.coords.longitude,
          );
          setNear(place.label);
          if (place.countryCode) setFromCountryCode(place.countryCode);
          setError(null);
        } catch {
          setNear(
            `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
          );
        }
      },
      () => setError("Could not read location. Type a place instead."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="font-display text-sm tracking-[0.2em] text-amber uppercase">
          Near you
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-wide text-asphalt uppercase sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          We check TruckersLikeMe first, then the open web — and we never call a
          web result “safe” without a badge.
        </p>
      </section>

      <section className="space-y-5">
        <div>
          <label className="block">
            <span className="font-display text-xs tracking-[0.16em] text-muted uppercase">
              Near
            </span>
            <input
              type="text"
              value={near}
              onChange={(e) => setNear(e.target.value)}
              placeholder="Lekki Deep Sea Port · Birmingham · Houston"
              className="mt-2 w-full rounded-sm border border-asphalt/15 bg-white px-4 py-3 text-asphalt focus:border-amber focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => useCurrentLocation()}
            className="mt-2 text-sm font-medium text-amber transition hover:text-asphalt"
          >
            Or use my current location
          </button>
        </div>

        <div>
          <p className="font-display text-xs tracking-[0.16em] text-muted uppercase">
            For my
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {truckOptions.map((c) => (
              <Chip
                key={c.id}
                active={truck === c.id}
                onClick={() => setTruck(c.id)}
              >
                {c.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="font-display text-xs tracking-[0.16em] text-muted uppercase">
            When
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {whenOptions.map((c) => (
              <Chip key={c.id} active={when === c.id} onClick={() => setWhen(c.id)}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="font-display text-xs tracking-[0.16em] text-muted uppercase">
            What matters most
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {priorityOptions.map((c) => (
              <Chip
                key={c.id}
                active={priority === c.id}
                onClick={() => setPriority(c.id)}
              >
                {c.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowDescribe((v) => !v)}
            className="text-sm font-medium text-amber transition hover:text-asphalt"
          >
            {showDescribe ? "Hide description" : "Or describe what you need →"}
          </button>
          {showDescribe && (
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              rows={3}
              placeholder="Guarded spot for a loaded reefer until 5am…"
              className="mt-2 w-full rounded-sm border border-asphalt/15 bg-white px-4 py-3 text-asphalt focus:border-amber focus:outline-none"
            />
          )}
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void runSearch()}
          className="w-full rounded-sm bg-amber px-5 py-3.5 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot disabled:opacity-60 sm:w-auto"
        >
          {loading ? "Searching…" : "Show me where"}
        </button>

        {error && (
          <p className="border border-alert/30 bg-red-50 px-4 py-3 text-sm text-alert">
            {error}
          </p>
        )}
      </section>

      {results.length > 0 && (
        <section className="space-y-4 border-t border-asphalt/10 pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl tracking-wide text-asphalt uppercase">
              Results
            </h2>
            {provider && (
              <p className="text-xs tracking-wide text-muted uppercase">
                Source: {provider === "fallback" ? "guided tips" : provider}
              </p>
            )}
          </div>
          <ul className="space-y-4">
            {results.map((place, idx) => {
              const conf = (place.confidence ||
                "web_found") as PlaceConfidence;
              const meta = confidenceMeta[conf] ?? confidenceMeta.web_found;
              return (
                <li
                  key={place.id || `${place.name}-${idx}`}
                  className="border border-asphalt/10 bg-white px-4 py-4 sm:px-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-medium text-asphalt">
                        {place.name}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {[place.address, place.area]
                          .filter(Boolean)
                          .join(" · ") || near}
                      </p>
                    </div>
                    <span
                      className={`rounded-sm border px-2 py-1 text-[11px] font-semibold tracking-wide uppercase ${meta.tone}`}
                      title={meta.hint}
                    >
                      {meta.label}
                    </span>
                  </div>
                  {place.summary && (
                    <p className="mt-3 text-sm text-muted">{place.summary}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
                    {place.overnight != null && (
                      <span>
                        Overnight:{" "}
                        {place.overnight ? "reported yes" : "unclear / no"}
                      </span>
                    )}
                    {place.security != null && (
                      <span>
                        Security: {place.security ? "reported" : "unknown"}
                      </span>
                    )}
                    {place.phone && <span>Tel: {place.phone}</span>}
                    {place.distanceNote && <span>{place.distanceNote}</span>}
                  </div>
                  {place.id && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="mr-2 self-center text-xs text-muted">
                        Did you manage to use this?
                      </span>
                      <button
                        type="button"
                        disabled={feedbackBusy === place.id}
                        onClick={() => void sendFeedback(place.id!, true)}
                        className="rounded-sm border border-asphalt/15 px-3 py-2 text-xs font-semibold uppercase"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        disabled={feedbackBusy === place.id}
                        onClick={() => void sendFeedback(place.id!, false)}
                        className="rounded-sm border border-asphalt/15 px-3 py-2 text-xs font-semibold uppercase"
                      >
                        No
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
