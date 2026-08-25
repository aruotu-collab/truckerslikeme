"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { checkDraftSummary, readCheckDraft } from "@/lib/check-draft";

/** Shown on Find / Plan so drivers can jump back to their saved check. */
export function ResumeCheckBanner() {
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    setSummary(checkDraftSummary(readCheckDraft()));
  }, []);

  if (!summary) return null;

  return (
    <div className="border border-amber/30 bg-amber/10 px-4 py-3">
      <p className="text-sm text-asphalt">
        <span className="font-semibold">Saved check:</span> {summary}
      </p>
      <Link
        href="/"
        className="mt-2 inline-block text-sm font-medium text-amber transition hover:text-asphalt"
      >
        Back to Check Load →
      </Link>
    </div>
  );
}
