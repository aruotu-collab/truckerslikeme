"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  countByStatus,
  emptyCourierPlan,
  newStopId,
  orderPendingFrom,
  readCourierPlan,
  writeCourierPlan,
  type CourierPlanState,
  type CourierStop,
  type CourierStopStatus,
} from "@/lib/courier-plan";

type ViewFrom = "depot" | "here";

async function geocodeLabel(query: string): Promise<{
  label: string;
  lat: number;
  lng: number;
} | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      display_name?: string;
      lat?: string;
      lon?: string;
    }[];
    const hit = data[0];
    if (!hit?.lat || !hit?.lon) return null;
    return {
      label: hit.display_name || q,
      lat: Number(hit.lat),
      lng: Number(hit.lon),
    };
  } catch {
    return null;
  }
}

function statusTone(status: CourierStopStatus) {
  switch (status) {
    case "delivered":
      return "border-emerald-300 bg-emerald-50 text-emerald-900";
    case "failed":
      return "border-alert/30 bg-red-50 text-alert";
    case "skipped":
      return "border-asphalt/15 bg-concrete/40 text-muted";
    default:
      return "border-amber/40 bg-amber/10 text-asphalt";
  }
}

function shortDrop(address: string) {
  const first = address.split(",")[0]?.trim() || address.trim();
  if (first.length <= 26) return first;
  return `${first.slice(0, 24)}…`;
}

export function CourierPlanPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<CourierPlanState>(emptyCourierPlan);
  const [hydrated, setHydrated] = useState(false);
  const [viewFrom, setViewFrom] = useState<ViewFrom>("depot");
  const [manualAddress, setManualAddress] = useState("");
  const [manualRecipient, setManualRecipient] = useState("");
  const [manualRef, setManualRef] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setPlan(readCourierPlan());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeCourierPlan(plan);
  }, [plan, hydrated]);

  const counts = useMemo(() => countByStatus(plan.stops), [plan.stops]);

  const pendingStops = useMemo(() => {
    const start =
      viewFrom === "here" && plan.hereLat != null && plan.hereLng != null
        ? { lat: plan.hereLat, lng: plan.hereLng }
        : plan.depotLat != null && plan.depotLng != null
          ? { lat: plan.depotLat, lng: plan.depotLng }
          : null;
    return orderPendingFrom(plan.stops, start).filter(
      (s) => s.status === "pending",
    );
  }, [plan, viewFrom]);

  const finishedStops = useMemo(
    () => plan.stops.filter((s) => s.status !== "pending"),
    [plan.stops],
  );

  function patch(partial: Partial<CourierPlanState>) {
    setPlan((prev) => ({ ...prev, ...partial }));
  }

  async function setDepot(label: string) {
    setBusy("depot");
    setError(null);
    const geo = await geocodeLabel(label);
    patch({
      depot: geo?.label || label.trim(),
      depotLat: geo?.lat ?? null,
      depotLng: geo?.lng ?? null,
    });
    setBusy(null);
  }

  async function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Location not available — type where you are.");
      return;
    }
    setBusy("here");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { reverseGeocodePlace } = await import("@/lib/reverse-geocode");
          const place = await reverseGeocodePlace(
            pos.coords.latitude,
            pos.coords.longitude,
          );
          patch({
            hereLabel: place.label,
            hereLat: pos.coords.latitude,
            hereLng: pos.coords.longitude,
          });
          setViewFrom("here");
          setNote("Location set — pending stops order from where you are.");
        } catch {
          patch({
            hereLabel: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
            hereLat: pos.coords.latitude,
            hereLng: pos.coords.longitude,
          });
          setViewFrom("here");
        }
        setBusy(null);
      },
      () => {
        setError("Could not read GPS. Type your location instead.");
        setBusy(null);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30_000 },
    );
  }

  async function addStopFromAddress(address: string, extra?: Partial<CourierStop>) {
    const trimmed = address.trim();
    if (!trimmed) {
      setError("Need a delivery address.");
      return;
    }
    setBusy("add");
    setError(null);
    const geo = await geocodeLabel(trimmed);
    const stop: CourierStop = {
      id: newStopId(),
      address: geo?.label || trimmed,
      recipient: extra?.recipient ?? null,
      parcelRef: extra?.parcelRef ?? null,
      notes: extra?.notes ?? null,
      status: "pending",
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      deliveredAt: null,
      createdAt: new Date().toISOString(),
    };
    setPlan((prev) => ({ ...prev, stops: [...prev.stops, stop] }));
    setManualAddress("");
    setManualRecipient("");
    setManualRef("");
    setNote(`Added stop · ${stop.address}`);
    setBusy(null);
  }

  async function onSnapFile(file: File) {
    setBusy("snap");
    setError(null);
    setNote(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/courier/extract-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const data = (await res.json()) as {
        address?: string | null;
        recipient?: string | null;
        parcelRef?: string | null;
        notes?: string[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not read that label.");
        return;
      }
      if (!data.address) {
        setError("No address found — type it below.");
        return;
      }
      await addStopFromAddress(data.address, {
        recipient: data.recipient ?? null,
        parcelRef: data.parcelRef ?? null,
        notes: data.notes?.length ? data.notes.join(" · ") : null,
      });
    } catch {
      setError("Snap failed. Try again or type the address.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function setStopStatus(id: string, status: CourierStopStatus) {
    setPlan((prev) => ({
      ...prev,
      stops: prev.stops.map((s) =>
        s.id === id
          ? {
              ...s,
              status,
              deliveredAt:
                status === "delivered" ? new Date().toISOString() : null,
            }
          : s,
      ),
    }));
    if (status === "delivered") {
      setNote("Marked delivered — remaining plan updates automatically.");
    }
  }

  function removeStop(id: string) {
    setPlan((prev) => ({
      ...prev,
      stops: prev.stops.filter((s) => s.id !== id),
    }));
  }

  function clearDelivered() {
    setPlan((prev) => ({
      ...prev,
      stops: prev.stops.filter((s) => s.status !== "delivered"),
    }));
    setNote("Cleared delivered stops from this plan.");
  }

  function optimizeOrder() {
    const start =
      viewFrom === "here" && plan.hereLat != null && plan.hereLng != null
        ? { lat: plan.hereLat, lng: plan.hereLng }
        : plan.depotLat != null && plan.depotLng != null
          ? { lat: plan.depotLat, lng: plan.depotLng }
          : null;
    if (!start) {
      setError(
        viewFrom === "here"
          ? "Set your current location first."
          : "Set a depot address we can place on the map first.",
      );
      return;
    }
    setPlan((prev) => ({
      ...prev,
      stops: orderPendingFrom(prev.stops, start),
    }));
    setNote(
      viewFrom === "here"
        ? "Reordered remaining drops from where you are."
        : "Reordered remaining drops from the depot.",
    );
  }

  if (!hydrated) {
    return <p className="text-sm text-muted">Loading courier plan…</p>;
  }

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="font-display text-xs tracking-[0.18em] text-amber uppercase">
          Plan route{" "}
          <span className="normal-case tracking-normal text-muted">
            for couriers
          </span>
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-wide text-asphalt uppercase sm:text-4xl">
          Deliver the van
        </h1>
        <p className="mt-3 text-base text-muted sm:text-lg">
          Snap parcel labels at the depot, build the drop order, then work the
          list from the depot or from where you are now. Mark each drop when
          it&apos;s done — the remaining plan stays live.
        </p>
      </header>

      <section className="grid gap-4 border border-asphalt/10 bg-white p-4 sm:grid-cols-2 sm:p-5">
        <label className="block">
          <span className="font-display text-xs tracking-[0.14em] text-muted uppercase">
            Depot (load point)
          </span>
          <input
            type="text"
            value={plan.depot}
            onChange={(e) => patch({ depot: e.target.value })}
            onBlur={() => {
              if (plan.depot.trim()) void setDepot(plan.depot);
            }}
            placeholder="Depot / hub address"
            className="mt-2 w-full border border-asphalt/15 px-3 py-2.5 text-sm text-asphalt outline-none focus:border-amber"
          />
        </label>
        <div>
          <span className="font-display text-xs tracking-[0.14em] text-muted uppercase">
            Where I am now
          </span>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={plan.hereLabel}
              onChange={(e) =>
                patch({
                  hereLabel: e.target.value,
                  hereLat: null,
                  hereLng: null,
                })
              }
              onBlur={async () => {
                if (!plan.hereLabel.trim()) return;
                setBusy("here");
                const geo = await geocodeLabel(plan.hereLabel);
                if (geo) {
                  patch({
                    hereLabel: geo.label,
                    hereLat: geo.lat,
                    hereLng: geo.lng,
                  });
                }
                setBusy(null);
              }}
              placeholder="Town / street, or use GPS"
              className="w-full border border-asphalt/15 px-3 py-2.5 text-sm text-asphalt outline-none focus:border-amber"
            />
            <button
              type="button"
              disabled={busy === "here"}
              onClick={() => void useMyLocation()}
              className="shrink-0 rounded-sm bg-asphalt px-3 py-2.5 text-[11px] font-semibold tracking-wide text-white uppercase disabled:opacity-60"
            >
              {busy === "here" ? "Locating…" : "Use GPS"}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4 border border-asphalt/10 bg-white p-4 sm:p-5">
        <div>
          <p className="font-display text-xs tracking-[0.14em] text-amber uppercase">
            Add parcels
          </p>
          <p className="mt-1 text-sm text-muted">
            Two ways in: snap a label, or enter the drop by hand.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onSnapFile(f);
            }}
          />
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => fileRef.current?.click()}
            className="rounded-sm bg-amber px-4 py-2.5 text-[11px] font-semibold tracking-wide text-asphalt uppercase disabled:opacity-60"
          >
            {busy === "snap" ? "Reading label…" : "Snap label"}
          </button>
        </div>

        <div className="space-y-3 border-t border-asphalt/10 pt-4">
          <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
            Or add manually
          </p>
          <label className="block">
            <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">
              Delivery address *
            </span>
            <input
              type="text"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addStopFromAddress(manualAddress, {
                    recipient: manualRecipient.trim() || null,
                    parcelRef: manualRef.trim() || null,
                  });
                }
              }}
              placeholder="Street, town, postcode"
              className="mt-1.5 w-full border border-asphalt/15 px-3 py-2.5 text-sm outline-none focus:border-amber"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                Recipient (optional)
              </span>
              <input
                type="text"
                value={manualRecipient}
                onChange={(e) => setManualRecipient(e.target.value)}
                placeholder="Name on the parcel"
                className="mt-1.5 w-full border border-asphalt/15 px-3 py-2.5 text-sm outline-none focus:border-amber"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                Parcel / tracking ref (optional)
              </span>
              <input
                type="text"
                value={manualRef}
                onChange={(e) => setManualRef(e.target.value)}
                placeholder="Barcode or consignment id"
                className="mt-1.5 w-full border border-asphalt/15 px-3 py-2.5 text-sm outline-none focus:border-amber"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={busy === "add" || !manualAddress.trim()}
            onClick={() =>
              void addStopFromAddress(manualAddress, {
                recipient: manualRecipient.trim() || null,
                parcelRef: manualRef.trim() || null,
              })
            }
            className="rounded-sm bg-asphalt px-4 py-2.5 text-[11px] font-semibold tracking-wide text-white uppercase disabled:opacity-50"
          >
            {busy === "add" ? "Adding…" : "Add parcel"}
          </button>
        </div>

        {error ? <p className="text-sm text-alert">{error}</p> : null}
        {note ? (
          <p role="status" className="text-sm text-asphalt">
            {note}
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
              Today&apos;s drops
            </h2>
            <p className="mt-1 text-sm text-muted">
              {counts.pending} left · {counts.delivered} delivered
              {counts.failed ? ` · ${counts.failed} failed` : ""}
              {counts.skipped ? ` · ${counts.skipped} skipped` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div
              className="inline-flex border border-asphalt/15 bg-white"
              role="toolbar"
              aria-label="View from"
            >
              {(
                [
                  { id: "depot" as const, label: "From depot" },
                  { id: "here" as const, label: "From here" },
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={viewFrom === v.id}
                  onClick={() => setViewFrom(v.id)}
                  className={`px-3 py-2 text-[10px] font-semibold tracking-wide uppercase ${
                    viewFrom === v.id
                      ? "bg-amber text-asphalt"
                      : "text-asphalt/70 hover:bg-concrete/50"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={optimizeOrder}
              className="rounded-sm border border-asphalt/20 bg-white px-3 py-2 text-[10px] font-semibold tracking-wide uppercase"
            >
              Reorder remaining
            </button>
            {counts.delivered > 0 ? (
              <button
                type="button"
                onClick={clearDelivered}
                className="rounded-sm border border-asphalt/20 px-3 py-2 text-[10px] font-semibold tracking-wide text-muted uppercase"
              >
                Clear delivered
              </button>
            ) : null}
          </div>
        </div>

        {!plan.stops.length ? (
          <div className="border border-dashed border-asphalt/20 bg-white px-5 py-10 text-center text-sm text-muted">
            No parcels yet — snap labels at the depot to build today&apos;s
            route.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingStops.length > 0 ? (
              <div className="border border-amber/40 bg-[#fff8e8] px-4 py-3">
                <p className="text-[10px] font-semibold tracking-wide text-amber uppercase">
                  Delivery chain ·{" "}
                  {viewFrom === "here" ? "from where you are" : "from depot"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-asphalt">
                  <span className="rounded-sm bg-asphalt px-2 py-1 text-[10px] font-semibold tracking-wide text-white uppercase">
                    {viewFrom === "here"
                      ? shortDrop(plan.hereLabel || "Here")
                      : shortDrop(plan.depot || "Depot")}
                  </span>
                  {pendingStops.map((stop, i) => (
                    <span key={stop.id} className="inline-flex items-center gap-1.5">
                      <span className="font-display text-amber" aria-hidden>
                        →
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-sm border border-asphalt/15 bg-white px-2 py-1">
                        <span className="font-mono text-[10px] font-bold text-amber">
                          {i + 1}
                        </span>
                        <span className="font-medium">
                          {shortDrop(stop.address)}
                        </span>
                      </span>
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Deliver in this order — 1 first, then 2, and so on. Use{" "}
                  <span className="font-semibold text-asphalt">
                    Reorder remaining
                  </span>{" "}
                  after you move or finish a drop.
                </p>
              </div>
            ) : (
              <p className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                No pending drops left in the chain — all done or parked below.
              </p>
            )}
            <ol className="space-y-2">
              {pendingStops.map((stop, i) => (
                <li
                  key={stop.id}
                  className={`border bg-white px-4 py-3 ${statusTone(stop.status)}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-asphalt">
                        <span className="mr-2 font-mono text-[10px] text-amber">
                          {i + 1}
                        </span>
                        {stop.address}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        <span className="font-semibold uppercase tracking-wide">
                          pending
                        </span>
                        {stop.recipient ? ` · ${stop.recipient}` : ""}
                        {stop.parcelRef ? ` · #${stop.parcelRef}` : ""}
                        {stop.notes ? ` · ${stop.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setStopStatus(stop.id, "delivered")}
                        className="rounded-sm bg-[#2f6b4f] px-2.5 py-1.5 text-[10px] font-semibold tracking-wide text-white uppercase"
                      >
                        Delivered
                      </button>
                      <button
                        type="button"
                        onClick={() => setStopStatus(stop.id, "failed")}
                        className="rounded-sm border border-alert/30 bg-red-50 px-2.5 py-1.5 text-[10px] font-semibold text-alert uppercase"
                      >
                        Failed
                      </button>
                      <button
                        type="button"
                        onClick={() => setStopStatus(stop.id, "skipped")}
                        className="rounded-sm border border-asphalt/20 px-2.5 py-1.5 text-[10px] font-semibold tracking-wide uppercase"
                      >
                        Skip for now
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStop(stop.id)}
                        className="rounded-sm px-2.5 py-1.5 text-[10px] font-semibold tracking-wide text-muted uppercase hover:text-alert"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            {finishedStops.length > 0 ? (
              <div>
                <p className="mb-2 text-[10px] font-semibold tracking-wide text-muted uppercase">
                  Done / parked ({finishedStops.length})
                </p>
                <ul className="space-y-2">
                  {finishedStops.map((stop) => (
                    <li
                      key={stop.id}
                      className={`border bg-white px-4 py-3 ${statusTone(stop.status)}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-asphalt">
                            {stop.address}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            <span className="font-semibold uppercase tracking-wide">
                              {stop.status}
                            </span>
                            {stop.recipient ? ` · ${stop.recipient}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setStopStatus(stop.id, "pending")}
                            className="rounded-sm border border-asphalt/20 px-2.5 py-1.5 text-[10px] font-semibold tracking-wide uppercase"
                          >
                            Back to pending
                          </button>
                          <button
                            type="button"
                            onClick={() => removeStop(stop.id)}
                            className="rounded-sm px-2.5 py-1.5 text-[10px] font-semibold tracking-wide text-muted uppercase hover:text-alert"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
        <p className="text-xs text-muted">
          <strong className="font-semibold text-asphalt">From depot</strong> =
          full day load order.{" "}
          <strong className="font-semibold text-asphalt">From here</strong> =
          what&apos;s sensible next from your live position after each drop.
          Skipped stops stay on the list so you can finish them later.
        </p>
      </section>
    </div>
  );
}
