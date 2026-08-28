"use client";

import { useState } from "react";
import {
  manualInputToDraft,
  mergeIngestDrafts,
  parseBulkPaste,
  type IngestJobDraft,
  type ManualJobInput,
} from "@/lib/job-ingest";
import { shortPlace } from "@/lib/jobs-map";
import { typeLabel } from "@/lib/typography";

const EMPTY_MANUAL: ManualJobInput = {
  origin: "",
  destination: "",
  miles: "",
  item: "",
  href: "",
  listedQuote: "",
};

type ManualMode = "form" | "paste";

type JobManualEntryFormProps = {
  onJobsAdded: (jobs: IngestJobDraft[]) => void;
  onCoach?: (message: string) => void;
  onError?: (message: string | null) => void;
};

export function JobManualEntryForm({
  onJobsAdded,
  onCoach,
  onError,
}: JobManualEntryFormProps) {
  const [manualMode, setManualMode] = useState<ManualMode>("form");
  const [manual, setManual] = useState<ManualJobInput>({ ...EMPTY_MANUAL });
  const [pasteText, setPasteText] = useState("");

  function addManualToList() {
    const draft = manualInputToDraft(manual, "manual");
    if (!draft) {
      onError?.("Pickup and drop-off are required.");
      return;
    }
    onJobsAdded([draft]);
    setManual({ ...EMPTY_MANUAL });
    onCoach?.(
      `Added ${shortPlace(draft.origin)} → ${shortPlace(draft.destination)} to the list.`,
    );
    onError?.(null);
  }

  function parsePasteToList() {
    const parsed = parseBulkPaste(pasteText);
    if (!parsed.length) {
      onError?.(
        "Could not parse any jobs — try one per line, e.g. Manchester → Liverpool · 120mi",
      );
      return;
    }
    onJobsAdded(parsed);
    onCoach?.(
      `Parsed ${parsed.length} job${parsed.length === 1 ? "" : "s"} from paste.`,
    );
    onError?.(null);
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex border border-asphalt/15 bg-white">
        {(
          [
            { id: "form" as const, label: "One job" },
            { id: "paste" as const, label: "Paste list" },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setManualMode(m.id)}
            className={`px-4 py-2 text-xs font-semibold uppercase ${
              manualMode === m.id
                ? "bg-amber text-asphalt"
                : "text-muted hover:bg-concrete/40"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {manualMode === "form" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={typeLabel}>Pickup</span>
            <input
              type="text"
              value={manual.origin}
              onChange={(e) =>
                setManual((m) => ({ ...m, origin: e.target.value }))
              }
              placeholder="Manchester"
              className="mt-1 w-full border border-asphalt/15 px-3 py-2.5 text-base text-asphalt outline-none focus:border-amber"
            />
          </label>
          <label className="block text-sm">
            <span className={typeLabel}>Drop-off</span>
            <input
              type="text"
              value={manual.destination}
              onChange={(e) =>
                setManual((m) => ({ ...m, destination: e.target.value }))
              }
              placeholder="Liverpool"
              className="mt-1 w-full border border-asphalt/15 px-3 py-2.5 text-base text-asphalt outline-none focus:border-amber"
            />
          </label>
          <label className="block text-sm">
            <span className={typeLabel}>Miles (optional)</span>
            <input
              type="number"
              min={0}
              value={manual.miles}
              onChange={(e) =>
                setManual((m) => ({ ...m, miles: e.target.value }))
              }
              placeholder="120"
              className="mt-1 w-full border border-asphalt/15 px-3 py-2.5 text-base text-asphalt outline-none focus:border-amber"
            />
          </label>
          <label className="block text-sm">
            <span className={typeLabel}>Listed quote £ (optional)</span>
            <input
              type="text"
              value={manual.listedQuote}
              onChange={(e) =>
                setManual((m) => ({ ...m, listedQuote: e.target.value }))
              }
              placeholder="240"
              className="mt-1 w-full border border-asphalt/15 px-3 py-2.5 text-base text-asphalt outline-none focus:border-amber"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className={typeLabel}>What is it (optional)</span>
            <input
              type="text"
              value={manual.item}
              onChange={(e) =>
                setManual((m) => ({ ...m, item: e.target.value }))
              }
              placeholder="Wardrobe delivery"
              className="mt-1 w-full border border-asphalt/15 px-3 py-2.5 text-base text-asphalt outline-none focus:border-amber"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className={typeLabel}>Shiply link (optional)</span>
            <input
              type="url"
              value={manual.href}
              onChange={(e) =>
                setManual((m) => ({ ...m, href: e.target.value }))
              }
              placeholder="https://www.shiply.com/..."
              className="mt-1 w-full border border-asphalt/15 px-3 py-2.5 text-base text-asphalt outline-none focus:border-amber"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={addManualToList}
              className="min-h-11 rounded-sm bg-asphalt px-4 py-2 text-xs font-semibold tracking-wide text-white uppercase"
            >
              Add to list →
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-muted">
            Paste one job per line. Examples:{" "}
            <code className="text-[11px]">Manchester → Liverpool · 120mi</code>,
            or copy rows from Shiply / WhatsApp.
          </p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            placeholder={`Manchester → Liverpool · 120mi · Wardrobe\nBolton → Leeds · 45mi\nWarrington → Chester`}
            className="w-full border border-asphalt/15 px-3 py-2.5 text-base text-asphalt outline-none focus:border-amber"
          />
          <button
            type="button"
            onClick={parsePasteToList}
            className="min-h-11 rounded-sm bg-asphalt px-4 py-2 text-xs font-semibold tracking-wide text-white uppercase"
          >
            Parse jobs →
          </button>
        </div>
      )}
    </div>
  );
}

/** Merge incoming manual drafts into an existing pending list. */
export function appendManualJobs(
  existing: IngestJobDraft[],
  incoming: IngestJobDraft[],
): IngestJobDraft[] {
  return mergeIngestDrafts(existing, incoming);
}
