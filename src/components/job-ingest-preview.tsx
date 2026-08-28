"use client";

import { shortPlace } from "@/lib/jobs-map";
import {
  sourceLabel,
  type IngestJobDraft,
} from "@/lib/job-ingest";
import { typeLabel } from "@/lib/typography";

type JobIngestPreviewProps = {
  jobs: IngestJobDraft[];
  selected: Record<string, boolean>;
  newFingerprints?: Set<string>;
  fingerprint?: (job: IngestJobDraft) => string;
  onToggle: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onAddAll: () => void;
  onAddSelected: () => void;
  onClearReview?: () => void;
  addBlocked?: boolean;
  addBlockedHint?: string;
  onAddBlocked?: () => void;
  disabled?: boolean;
  reviewLabel?: string;
  addAllLabel?: string;
  addSelectedLabel?: string;
  clearReviewLabel?: string;
};

export function JobIngestPreview({
  jobs,
  selected,
  newFingerprints,
  fingerprint,
  onToggle,
  onSelectAll,
  onAddAll,
  onAddSelected,
  onClearReview,
  addBlocked,
  addBlockedHint = "Sign in free to add live-scanned jobs to Hunt.",
  onAddBlocked,
  disabled,
  reviewLabel = "Review before adding",
  addAllLabel,
  addSelectedLabel = "Add selected only",
  clearReviewLabel = "Clear review",
}: JobIngestPreviewProps) {
  if (!jobs.length) return null;

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const allSelected = selectedCount === jobs.length;
  const addAllText =
    addAllLabel ?? `Add all ${jobs.length} to board →`;

  return (
    <div className="space-y-3 border-t border-asphalt/10 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={typeLabel}>
          {reviewLabel} ({selectedCount} of {jobs.length} selected)
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
          />
          Select all
        </label>
      </div>

      <ul className="max-h-52 space-y-2 overflow-y-auto">
        {jobs.map((job) => {
          const isNew =
            fingerprint && newFingerprints?.has(fingerprint(job));
          return (
            <li key={job.id}>
              <label className="flex cursor-pointer gap-3 border border-asphalt/10 bg-white px-3 py-2.5 hover:bg-concrete/20">
                <input
                  type="checkbox"
                  className="mt-1 shrink-0"
                  checked={Boolean(selected[job.id])}
                  onChange={(e) => onToggle(job.id, e.target.checked)}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-asphalt">
                    {shortPlace(job.origin)} → {shortPlace(job.destination)}
                    {isNew ? (
                      <span className="ml-2 rounded-sm bg-amber px-1.5 py-0.5 text-[10px] font-semibold uppercase text-asphalt">
                        New
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {[
                      sourceLabel(job.source),
                      job.item,
                      job.miles != null ? `${job.miles} mi` : null,
                      job.href ? "Shiply link" : "No Shiply link",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {addBlocked ? (
        <p className="border border-amber/40 bg-amber/10 px-3 py-2.5 text-xs leading-relaxed text-asphalt">
          {addBlockedHint}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || !jobs.length}
          onClick={() => (addBlocked ? onAddBlocked?.() : onAddAll())}
          className="min-h-11 rounded-sm bg-amber px-4 py-2 text-xs font-semibold tracking-wide text-asphalt uppercase disabled:opacity-60"
        >
          {addBlocked ? "Sign in free to add →" : addAllText}
        </button>
        <button
          type="button"
          disabled={disabled || selectedCount === 0}
          onClick={() => (addBlocked ? onAddBlocked?.() : onAddSelected())}
          className="min-h-11 rounded-sm border-2 border-asphalt/30 bg-white px-4 py-2 text-xs font-semibold tracking-wide uppercase disabled:opacity-60"
        >
          {addSelectedLabel}
        </button>
        {onClearReview ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onClearReview}
            className="min-h-11 rounded-sm border-2 border-asphalt/15 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-muted uppercase hover:border-asphalt/30 hover:text-asphalt disabled:opacity-60"
          >
            {clearReviewLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
