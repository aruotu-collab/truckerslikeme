"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CorridorSupportPlace, PlannedRoute } from "@/types";

export type MapLayer =
  | "all"
  | "fuel"
  | "parking"
  | "repair"
  | "lodging"
  | "weigh"
  | "alert";

type MapMarker = {
  id: string;
  layer: Exclude<MapLayer, "all">;
  label: string;
  detail: string;
  mile: number;
};

const layerColor: Record<Exclude<MapLayer, "all">, string> = {
  fuel: "#3d6b4f",
  parking: "#e09b1e",
  repair: "#8fb4c9",
  lodging: "#c5ccd4",
  weigh: "#4a6f86",
  alert: "#c45c26",
};

const layerLabel: Record<Exclude<MapLayer, "all">, string> = {
  fuel: "Fuel",
  parking: "Parking",
  repair: "Repair",
  lodging: "Lodging",
  weigh: "Weigh",
  alert: "Alert",
};

const PATH_D = "M28 170 C 90 150, 120 60, 200 90 S 320 40, 372 70";

type RouteMapProps = {
  route: PlannedRoute;
  supportPlaces?: CorridorSupportPlace[];
  layer?: MapLayer;
  onLayerChange?: (layer: MapLayer) => void;
};

function buildMarkers(
  route: PlannedRoute,
  supportPlaces: CorridorSupportPlace[],
): MapMarker[] {
  const fromStops: MapMarker[] = route.stops.map((stop) => ({
    id: `stop-${stop.id}`,
    layer: stop.type,
    label: stop.label,
    detail: stop.detail,
    mile: stop.mile,
  }));

  const fromSupport: MapMarker[] = supportPlaces.map((place) => ({
    id: `support-${place.id}`,
    layer: place.kind,
    label: place.name,
    detail: place.detail,
    mile: place.mile,
  }));

  // Prefer support parking over duplicate stop parking near the same mile
  const merged = [...fromSupport, ...fromStops];
  const seen = new Set<string>();
  return merged
    .filter((m) => {
      const key = `${m.layer}:${Math.round(m.mile / 8)}`;
      if (seen.has(key) && m.layer === "parking") return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.mile - b.mile);
}

export function RouteMap({
  route,
  supportPlaces = [],
  layer: controlledLayer,
  onLayerChange,
}: RouteMapProps) {
  const pathId = useId();
  const pathRef = useRef<SVGPathElement | null>(null);
  const [pathLen, setPathLen] = useState(0);
  const [internalLayer, setInternalLayer] = useState<MapLayer>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const layer = controlledLayer ?? internalLayer;

  function setLayer(next: MapLayer) {
    if (onLayerChange) onLayerChange(next);
    else setInternalLayer(next);
  }

  const markers = useMemo(
    () => buildMarkers(route, supportPlaces),
    [route, supportPlaces],
  );

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    setPathLen(path.getTotalLength());
  }, []);

  const visible = useMemo(
    () => (layer === "all" ? markers : markers.filter((m) => m.layer === layer)),
    [markers, layer],
  );

  const nextService = visible[0] ?? null;
  const selected =
    visible.find((m) => m.id === selectedId) ?? nextService ?? null;

  const positioned = visible.map((marker) => {
    const t = Math.min(0.98, Math.max(0.02, marker.mile / Math.max(route.miles, 1)));
    if (pathLen > 0 && pathRef.current) {
      const point = pathRef.current.getPointAtLength(t * pathLen);
      return { ...marker, x: point.x, y: point.y, t };
    }
    // SSR / first paint fallback along the corridor arc
    const x = 28 + t * 344;
    const y = 170 - Math.sin(t * Math.PI) * 100 - t * 40;
    return { ...marker, x, y, t };
  });

  const layerCounts = useMemo(() => {
    const counts: Record<Exclude<MapLayer, "all">, number> = {
      fuel: 0,
      parking: 0,
      repair: 0,
      lodging: 0,
      weigh: 0,
      alert: 0,
    };
    for (const m of markers) counts[m.layer] += 1;
    return counts;
  }, [markers]);

  const filterChips: { id: MapLayer; label: string }[] = [
    { id: "all", label: "All" },
    { id: "fuel", label: "Fuel" },
    { id: "parking", label: "Parking" },
    { id: "repair", label: "Repair" },
    { id: "lodging", label: "Lodging" },
    { id: "weigh", label: "Weigh" },
  ];

  return (
    <div className="relative overflow-hidden rounded-sm border border-white/10 bg-road">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#4a6f86_0%,transparent_45%),radial-gradient(circle_at_80%_70%,#2c313a_0%,transparent_40%)]" />
        <div className="highway-lines absolute inset-x-8 top-1/2 h-1 opacity-70" />
      </div>

      <div className="relative p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-display text-sm tracking-[0.18em] text-chrome uppercase">
            Corridor map
          </p>
          <p className="text-xs text-chrome">
            {markers.length} services · by mile
          </p>
        </div>

        <div
          className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Filter map services"
        >
          {filterChips.map((chip) => {
            const active = layer === chip.id;
            const count =
              chip.id === "all"
                ? markers.length
                : layerCounts[chip.id as Exclude<MapLayer, "all">];
            if (chip.id !== "all" && count === 0) return null;
            return (
              <button
                key={chip.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setLayer(chip.id);
                  setSelectedId(null);
                }}
                className={`shrink-0 border-b-2 px-1 pb-2 text-sm font-semibold tracking-wide uppercase transition ${
                  active
                    ? "border-white text-white"
                    : "border-transparent text-chrome hover:text-white"
                }`}
              >
                {chip.label}
                <span
                  className={`ml-1.5 text-xs font-normal ${
                    active ? "text-amber" : "text-chrome/70"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="mb-4 border-l-2 border-amber pl-3">
            <p className="font-display text-[11px] tracking-[0.18em] text-amber uppercase">
              {selected.id === nextService?.id ? "Next up" : "Selected"} · mi{" "}
              {selected.mile}
            </p>
            <p className="mt-1 text-sm text-white">
              <span className="mr-2 text-xs tracking-wider text-chrome uppercase">
                {layerLabel[selected.layer]}
              </span>
              {selected.label}
            </p>
            <p className="mt-0.5 text-xs text-chrome">{selected.detail}</p>
            {nextService && selected.id === nextService.id && route.miles > 0 && (
              <p className="mt-1 text-xs text-amber-hot">
                ~{Math.max(0, Math.round((selected.mile / route.miles) * route.hours * 10) / 10)}{" "}
                hrs into the haul
              </p>
            )}
          </div>
        )}

        <svg
          viewBox="0 0 400 220"
          className="h-auto w-full"
          role="img"
          aria-label={`Route map from ${route.origin} to ${route.destination} with corridor services`}
        >
          <path
            ref={pathRef}
            id={pathId}
            d={PATH_D}
            fill="none"
            stroke="#e09b1e"
            strokeWidth="3"
            strokeDasharray="10 8"
            opacity="0.9"
          />
          <circle cx="28" cy="170" r="8" fill="#f0b429" />
          <circle cx="372" cy="70" r="8" fill="#f0b429" />
          <text x="28" y="196" fill="#c5ccd4" fontSize="11" textAnchor="middle">
            {route.origin.split(",")[0]}
          </text>
          <text x="372" y="56" fill="#c5ccd4" fontSize="11" textAnchor="middle">
            {route.destination.split(",")[0]}
          </text>

          {positioned.map((point) => {
            const active = selected?.id === point.id;
            return (
              <g
                key={point.id}
                className="cursor-pointer"
                onClick={() => setSelectedId(point.id)}
              >
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={active ? 9 : 6}
                  fill={layerColor[point.layer]}
                  stroke="#1a1d23"
                  strokeWidth="2"
                  opacity={active ? 1 : 0.92}
                />
                {active && (
                  <text
                    x={point.x}
                    y={point.y - 14}
                    fill="#edf1f4"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    mi {point.mile}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <ul className="mt-4 grid grid-cols-3 gap-2 text-xs text-chrome sm:grid-cols-6">
          {(Object.keys(layerLabel) as Exclude<MapLayer, "all">[]).map((key) => (
            <li key={key} className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ background: layerColor[key] }}
              />
              {layerLabel[key]}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
