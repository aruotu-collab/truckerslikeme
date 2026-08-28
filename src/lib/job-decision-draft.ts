export const JOB_DECISION_DRAFT_KEY = "tlm_job_decision_draft_v1";

export type JobDecisionKind = "check" | "price";
export type JobDecisionInputMode = "manual" | "screenshot";

export type JobDecisionDraft = {
  inputMode: JobDecisionInputMode;
  currentLocation: string;
  driverCoords: { lat: number; lon: number } | null;
  origin: string;
  destination: string;
  loadedMiles: string;
  deadheadMiles: string;
  deadheadManual: boolean;
  loadedManual: boolean;
  quote: string;
  feePct: string;
  diesel: string;
  extractNote: string | null;
  shotPreview: string | null;
  geoNote: string | null;
  updatedAt: number;
};

export type JobDecisionDraftStore = {
  version: 1;
  check?: JobDecisionDraft;
  price?: JobDecisionDraft;
};

export function emptyJobDecisionDraft(): Omit<JobDecisionDraft, "updatedAt"> {
  return {
    inputMode: "manual",
    currentLocation: "",
    driverCoords: null,
    origin: "",
    destination: "",
    loadedMiles: "",
    deadheadMiles: "",
    deadheadManual: false,
    loadedManual: false,
    quote: "",
    feePct: "13",
    diesel: "1.45",
    extractNote: null,
    shotPreview: null,
    geoNote: null,
  };
}

function readStore(): JobDecisionDraftStore {
  if (typeof window === "undefined") return { version: 1 };
  try {
    const raw = localStorage.getItem(JOB_DECISION_DRAFT_KEY);
    if (!raw) return { version: 1 };
    const parsed = JSON.parse(raw) as JobDecisionDraftStore;
    if (parsed.version !== 1) return { version: 1 };
    return parsed;
  } catch {
    return { version: 1 };
  }
}

function writeStore(store: JobDecisionDraftStore) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(JOB_DECISION_DRAFT_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

export function readJobDecisionDraft(
  kind: JobDecisionKind,
): JobDecisionDraft | null {
  const store = readStore();
  return store[kind] ?? null;
}

export function writeJobDecisionDraft(
  kind: JobDecisionKind,
  draft: Omit<JobDecisionDraft, "updatedAt">,
) {
  const store = readStore();
  store[kind] = { ...draft, updatedAt: Date.now() };
  writeStore(store);
}

export function clearJobDecisionDraft(kind: JobDecisionKind) {
  const store = readStore();
  delete store[kind];
  writeStore(store);
}
