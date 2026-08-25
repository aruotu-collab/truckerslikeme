import type { PlannedRoute } from "@/types";

export const PLAN_DRAFT_KEY = "tlm_plan_draft_v1";

export type PlanDraft = {
  route: PlannedRoute;
  discoverNote: string | null;
  updatedAt: number;
};

function normalizePlace(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function sameCorridor(
  a: { origin: string; destination: string },
  b: { origin: string; destination: string },
) {
  return (
    normalizePlace(a.origin) === normalizePlace(b.origin) &&
    normalizePlace(a.destination) === normalizePlace(b.destination)
  );
}

export function readPlanDraft(): PlanDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PLAN_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlanDraft;
    if (!parsed?.route?.origin || !parsed?.route?.destination) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePlanDraft(
  draft: Omit<PlanDraft, "updatedAt"> & { updatedAt?: number },
) {
  if (typeof window === "undefined") return;
  try {
    const payload: PlanDraft = {
      route: draft.route,
      discoverNote: draft.discoverNote,
      updatedAt: draft.updatedAt ?? Date.now(),
    };
    localStorage.setItem(PLAN_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearPlanDraft() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PLAN_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
