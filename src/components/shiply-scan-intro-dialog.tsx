"use client";

import { outlineBtnClass } from "@/lib/ui-buttons";

export const SHIPLY_SCAN_BENEFITS = [
  "Log into Shiply in our secure browser — you search, we read what's on screen",
  "Pull jobs onto your Hunt board with real Shiply links",
  "Compare chains, enter quotes, and track bids in My Jobs",
  "Free — screenshots and manual entry still work without an account",
] as const;

type ShiplyScanIntroDialogProps = {
  open: boolean;
  onClose: () => void;
  onSignIn: () => void;
};

export function ShiplyScanIntroDialog({
  open,
  onClose,
  onSignIn,
}: ShiplyScanIntroDialogProps) {
  if (!open) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-asphalt/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shiply-scan-intro-title"
      onClick={onClose}
    >
      <div
        className="animate-slide-up w-full max-w-md border border-asphalt/10 bg-background p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display text-xs tracking-[0.2em] text-amber uppercase">
          Scan Shiply
        </p>
        <h2
          id="shiply-scan-intro-title"
          className="mt-2 font-display text-2xl tracking-wide text-asphalt uppercase"
        >
          Sign in free to scan
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          A free account unlocks live Shiply scanning. Here&apos;s what you get:
        </p>
        <ul className="mt-4 space-y-2.5 text-sm text-asphalt">
          {SHIPLY_SCAN_BENEFITS.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-amber" aria-hidden>
                ✓
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSignIn}
            className="min-h-11 rounded-sm bg-asphalt px-4 py-2.5 text-xs font-semibold tracking-wide text-white uppercase"
          >
            Sign in free →
          </button>
          <button
            type="button"
            onClick={onClose}
            className={outlineBtnClass("muted")}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
