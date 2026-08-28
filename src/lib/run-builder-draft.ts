import type { IngestJobDraft } from "@/lib/job-ingest";
import {
  defaultRunPrefs,
  type RunFollowUp,
  type RunJob,
  type RunPrefs,
} from "@/lib/run-builder";
import type { VisibleShiplyJob } from "@/lib/run-shortlist";

export const RUN_BUILDER_DRAFT_KEY = "tlm_run_builder_draft_v1";
export const RUN_BUILDER_HOME_EVENT = "tlm-run-home";

export type HuntPath = "shiply" | "screenshots" | "manual";

export type ShiplyTabDraft = {
  sessionId: string | null;
  liveViewUrl: string | null;
  coach: string | null;
  scanned: VisibleShiplyJob[];
  selected: Record<string, boolean>;
  scanSummary: string | null;
  lastScanAt: string | null;
  newScanFingerprints: string[];
};

export type ScreenshotShotDraft = {
  id: string;
  dataUrl: string;
};

export type ManualTabDraft = {
  pending: IngestJobDraft[];
  selected: Record<string, boolean>;
  coach: string | null;
};

export type RunBuilderDraft = {
  version: 1;
  updatedAt: number;
  prefs: RunPrefs;
  huntPath: HuntPath;
  shiply: ShiplyTabDraft;
  screenshots: { shots: ScreenshotShotDraft[] };
  manual: ManualTabDraft;
  jobs: RunJob[];
  shiplySessionId: string | null;
  coach: string | null;
  followUp: RunFollowUp;
};

export const EMPTY_SHIPLY_DRAFT = (): ShiplyTabDraft => ({
  sessionId: null,
  liveViewUrl: null,
  coach: null,
  scanned: [],
  selected: {},
  scanSummary: null,
  lastScanAt: null,
  newScanFingerprints: [],
});

export const EMPTY_MANUAL_DRAFT = (): ManualTabDraft => ({
  pending: [],
  selected: {},
  coach: null,
});

export function defaultRunBuilderDraft(): RunBuilderDraft {
  return {
    version: 1,
    updatedAt: Date.now(),
    prefs: defaultRunPrefs(),
    huntPath: "shiply",
    shiply: EMPTY_SHIPLY_DRAFT(),
    screenshots: { shots: [] },
    manual: EMPTY_MANUAL_DRAFT(),
    jobs: [],
    shiplySessionId: null,
    coach: null,
    followUp: "best",
  };
}

export function readRunBuilderDraft(): RunBuilderDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RUN_BUILDER_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunBuilderDraft;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeRunBuilderDraft(
  draft: Omit<RunBuilderDraft, "updatedAt" | "version">,
) {
  if (typeof window === "undefined") return;
  try {
    const payload: RunBuilderDraft = {
      ...draft,
      version: 1,
      updatedAt: Date.now(),
    };
    localStorage.setItem(RUN_BUILDER_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearRunBuilderDraft() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RUN_BUILDER_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
