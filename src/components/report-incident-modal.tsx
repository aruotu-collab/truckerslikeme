"use client";

import { FormEvent, useState } from "react";
import type { ActivityKind, LiveActivity } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { useAuthGate } from "@/lib/auth-gate";

const kinds: { value: ActivityKind; label: string }[] = [
  { value: "traffic", label: "Traffic" },
  { value: "parking", label: "Parking" },
  { value: "delay", label: "Delay" },
  { value: "fuel", label: "Fuel" },
  { value: "weather", label: "Weather" },
  { value: "route", label: "Route" },
];

type ReportIncidentModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmitted: (item: LiveActivity) => void;
};

export function ReportIncidentModal({
  open,
  onClose,
  onSubmitted,
}: ReportIncidentModalProps) {
  const { user } = useAuthGate();
  const [kind, setKind] = useState<ActivityKind>("traffic");
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedMessage = message.trim();
    const trimmedLocation = location.trim();
    if (!trimmedMessage || !trimmedLocation) {
      setError("Add both a short description and a location.");
      return;
    }

    setBusy(true);
    const item: LiveActivity = {
      id: `local-${Date.now()}`,
      kind,
      message: trimmedMessage,
      location: trimmedLocation,
      minutesAgo: 0,
    };

    try {
      const supabase = createClient();
      if (supabase && user) {
        const { error: insertError } = await supabase.from("alerts").insert({
          user_id: user.id,
          kind,
          message: trimmedMessage,
          location: trimmedLocation,
        });
        // Table may not exist yet — still show in the live feed locally.
        if (insertError) {
          console.warn("alerts insert skipped:", insertError.message);
        }
      }

      onSubmitted(item);
      setMessage("");
      setLocation("");
      setKind("traffic");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-asphalt/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-incident-title"
      onClick={onClose}
    >
      <div
        className="animate-slide-up w-full max-w-md border border-asphalt/10 bg-background p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display text-xs tracking-[0.2em] text-amber uppercase">
          Driver report
        </p>
        <h2
          id="report-incident-title"
          className="mt-2 font-display text-3xl tracking-wide text-asphalt uppercase"
        >
          Report an incident
        </h2>
        <p className="mt-3 text-muted">
          Share what you&apos;re seeing so other drivers on the corridor get a
          heads-up.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs tracking-wide text-muted uppercase">
              Type
            </span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ActivityKind)}
              className="w-full rounded-sm border border-asphalt/15 bg-white px-4 py-3 text-asphalt outline-none transition focus:border-amber"
            >
              {kinds.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs tracking-wide text-muted uppercase">
              What&apos;s happening
            </span>
            <input
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-sm border border-asphalt/15 bg-white px-4 py-3 text-asphalt outline-none transition focus:border-amber"
              placeholder="Heavy traffic on I-40 westbound"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs tracking-wide text-muted uppercase">
              Location
            </span>
            <input
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-sm border border-asphalt/15 bg-white px-4 py-3 text-asphalt outline-none transition focus:border-amber"
              placeholder="Near Oklahoma City, OK"
            />
          </label>

          {error && <p className="text-sm text-alert">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-sm bg-amber px-4 py-3 text-sm font-semibold tracking-wide text-asphalt uppercase transition hover:bg-amber-hot disabled:opacity-60"
          >
            {busy ? "Posting…" : "Post to live activity"}
          </button>
        </form>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-sm border border-asphalt/15 px-4 py-3 text-sm text-muted transition hover:bg-concrete/60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
