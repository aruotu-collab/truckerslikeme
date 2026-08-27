/** Courier multi-drop plan — local draft until we sync to account. */

export type CourierStopStatus =
  | "pending"
  | "delivered"
  | "failed"
  | "skipped";

export type CourierStop = {
  id: string;
  address: string;
  recipient: string | null;
  parcelRef: string | null;
  notes: string | null;
  status: CourierStopStatus;
  lat: number | null;
  lng: number | null;
  deliveredAt: string | null;
  createdAt: string;
};

export type CourierPlanState = {
  depot: string;
  depotLat: number | null;
  depotLng: number | null;
  hereLabel: string;
  hereLat: number | null;
  hereLng: number | null;
  stops: CourierStop[];
  updatedAt: string;
};

const STORAGE_KEY = "tlm-courier-plan-v1";

export function emptyCourierPlan(): CourierPlanState {
  return {
    depot: "",
    depotLat: null,
    depotLng: null,
    hereLabel: "",
    hereLat: null,
    hereLng: null,
    stops: [],
    updatedAt: new Date().toISOString(),
  };
}

export function readCourierPlan(): CourierPlanState {
  if (typeof window === "undefined") return emptyCourierPlan();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCourierPlan();
    const parsed = JSON.parse(raw) as CourierPlanState;
    if (!parsed || !Array.isArray(parsed.stops)) return emptyCourierPlan();
    return {
      ...emptyCourierPlan(),
      ...parsed,
      stops: parsed.stops.map((s) => ({
        ...s,
        recipient: s.recipient ?? null,
        parcelRef: s.parcelRef ?? null,
        notes: s.notes ?? null,
        lat: s.lat ?? null,
        lng: s.lng ?? null,
        deliveredAt: s.deliveredAt ?? null,
      })),
    };
  } catch {
    return emptyCourierPlan();
  }
}

export function writeCourierPlan(plan: CourierPlanState) {
  if (typeof window === "undefined") return;
  const next = { ...plan, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function newStopId() {
  return `cstop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function haversineMi(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Nearest-neighbor order for pending stops from a start point. */
export function orderPendingFrom(
  stops: CourierStop[],
  start: { lat: number; lng: number } | null,
): CourierStop[] {
  const pending = stops.filter((s) => s.status === "pending");
  const rest = stops.filter((s) => s.status !== "pending");
  if (!start || pending.every((s) => s.lat == null || s.lng == null)) {
    return [...pending, ...rest];
  }

  const remaining = [...pending];
  const ordered: CourierStop[] = [];
  let cursor = start;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i]!;
      if (s.lat == null || s.lng == null) {
        if (bestDist === Infinity) bestIdx = i;
        continue;
      }
      const d = haversineMi(cursor, { lat: s.lat, lng: s.lng });
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]!;
    ordered.push(next);
    if (next.lat != null && next.lng != null) {
      cursor = { lat: next.lat, lng: next.lng };
    }
  }
  return [...ordered, ...rest];
}

export function countByStatus(stops: CourierStop[]) {
  return {
    pending: stops.filter((s) => s.status === "pending").length,
    delivered: stops.filter((s) => s.status === "delivered").length,
    failed: stops.filter((s) => s.status === "failed").length,
    skipped: stops.filter((s) => s.status === "skipped").length,
  };
}
