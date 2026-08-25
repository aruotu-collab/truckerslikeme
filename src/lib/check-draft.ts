import type { ProfitResult } from "@/lib/profit";

export const CHECK_DRAFT_KEY = "tlm_check_draft_v1";

export type CheckDraft = {
  location: string;
  text: string;
  miles: string;
  rateTotal: string;
  dieselPrice: string;
  mpg: string;
  costPerMile: string;
  extractNotes: string[];
  extractFound: string[];
  extractMissing: string[];
  jobReady: boolean;
  marketLow: number | null;
  marketHigh: number | null;
  marketCurrency: string | null;
  result: ProfitResult | null;
  corridor: { origin: string | null; destination: string | null } | null;
  isPreview: boolean;
  updatedAt: number;
};

export function readCheckDraft(): CheckDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHECK_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CheckDraft;
  } catch {
    return null;
  }
}

export function writeCheckDraft(draft: Omit<CheckDraft, "updatedAt">) {
  if (typeof window === "undefined") return;
  try {
    const payload: CheckDraft = { ...draft, updatedAt: Date.now() };
    localStorage.setItem(CHECK_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function clearCheckDraft() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CHECK_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function checkDraftSummary(draft: CheckDraft | null): string | null {
  if (!draft) return null;
  const route = [draft.corridor?.origin, draft.corridor?.destination]
    .filter(Boolean)
    .join(" → ");
  if (route) return route;
  if (draft.result?.label) return `Last check: ${draft.result.label}`;
  if (draft.text.trim()) return "Saved load check";
  return null;
}
