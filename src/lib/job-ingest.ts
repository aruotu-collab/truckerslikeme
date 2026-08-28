import type { ClipboardEvent } from "react";
import { parseLoadText } from "@/lib/load-parse";
import { placeKey } from "@/lib/jobs-map";
import type { RunJob } from "@/lib/run-builder";
import type { VisibleShiplyJob } from "@/lib/run-shortlist";

export type JobIngestSource = "scan" | "screenshot" | "manual" | "paste";

export type IngestJobDraft = {
  id: string;
  origin: string | null;
  destination: string | null;
  miles: number | null;
  rateTotal: number | null;
  item: string | null;
  href?: string | null;
  source: JobIngestSource;
};

export const MAX_INGEST_SCREENSHOTS = 10;

export function ingestJobId(
  source: JobIngestSource,
  origin: string | null,
  destination: string | null,
  suffix = "",
): string {
  const o = placeKey(origin) || "x";
  const d = placeKey(destination) || "y";
  const tail = suffix || Date.now().toString(36);
  return `${source}-${o}-${d}-${tail}`;
}

export function visibleToIngestDraft(
  job: VisibleShiplyJob,
  source: JobIngestSource,
): IngestJobDraft {
  return {
    id: job.id,
    origin: job.origin,
    destination: job.destination,
    miles: job.miles,
    rateTotal: job.rateTotal,
    item: job.item,
    href: job.href ?? null,
    source,
  };
}

export function draftsToVisible(jobs: IngestJobDraft[]): VisibleShiplyJob[] {
  return jobs.map((j) => ({
    id: j.id,
    origin: j.origin,
    destination: j.destination,
    miles: j.miles,
    rateTotal: j.rateTotal,
    item: j.item,
    href: j.href ?? null,
    verdict: "open",
    reason: "",
  }));
}

export function draftsToRunJobs(jobs: IngestJobDraft[]): RunJob[] {
  return jobs.map((j) => ({
    id: j.id,
    origin: j.origin,
    destination: j.destination,
    miles: j.miles,
    rateTotal: j.rateTotal,
    item: j.item,
    verdict: "open",
    reason: sourceLabel(j.source),
  }));
}

export type ManualJobInput = {
  origin: string;
  destination: string;
  miles?: string;
  item?: string;
  href?: string;
  listedQuote?: string;
};

export function manualInputToDraft(
  input: ManualJobInput,
  source: JobIngestSource = "manual",
): IngestJobDraft | null {
  const origin = input.origin.trim();
  const destination = input.destination.trim();
  if (!origin || !destination) return null;

  const milesRaw = input.miles?.trim();
  const miles =
    milesRaw && Number.isFinite(Number(milesRaw))
      ? Math.round(Number(milesRaw))
      : null;

  const quoteRaw = input.listedQuote?.trim().replace(/[£$,]/g, "");
  const rateTotal =
    quoteRaw && Number.isFinite(Number(quoteRaw)) ? Number(quoteRaw) : null;

  return {
    id: ingestJobId(source, origin, destination),
    origin,
    destination,
    miles,
    rateTotal,
    item: input.item?.trim() || null,
    href: input.href?.trim() || null,
    source,
  };
}

function extractHref(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s)]+shiply[^\s)]+/i);
  return m?.[0] ?? null;
}

/** Split pasted text into per-job blocks. */
export function splitPasteBlocks(raw: string): string[] {
  const normalized = raw.replace(/\r/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;

  return normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        /(?:→|->|–|—)/.test(line) ||
        /\bto\b/i.test(line) ||
        /\d+\s*mi(?:les)?\b/i.test(line) ||
        /shiply\.com/i.test(line),
    );
}

export function parseBulkPaste(raw: string): IngestJobDraft[] {
  const blocks = splitPasteBlocks(raw);
  const rows: IngestJobDraft[] = [];

  for (const block of blocks) {
    const parsed = parseLoadText(block);
    let origin = parsed.origin;
    let destination = parsed.destination;

    if (!origin || !destination) {
      const simple = block.match(/^(.+?)\s+to\s+(.+?)(?:\s*[·|,.]|$)/i);
      if (simple) {
        origin = origin ?? simple[1].trim();
        destination = destination ?? simple[2].trim();
      }
    }

    if (!origin?.trim() || !destination?.trim()) continue;

    const href = extractHref(block);
    let item: string | null = null;
    const itemMatch = block.match(/(?:·|\||-)\s*([^·|]+?)(?:\s*·|\s*\d+\s*mi|$)/i);
    if (itemMatch && !/(→|->|to\s)/i.test(itemMatch[1])) {
      item = itemMatch[1].trim().slice(0, 120) || null;
    }

    rows.push({
      id: ingestJobId("paste", origin, destination),
      origin: origin.trim(),
      destination: destination.trim(),
      miles: parsed.miles,
      rateTotal: parsed.rateTotal,
      item,
      href,
      source: "paste",
    });
  }

  return dedupeIngestDrafts(rows);
}

export function dedupeIngestDrafts(jobs: IngestJobDraft[]): IngestJobDraft[] {
  const seen = new Set<string>();
  const out: IngestJobDraft[] = [];
  for (const j of jobs) {
    const key = `${placeKey(j.origin)}|${placeKey(j.destination)}|${(j.item || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(j);
  }
  return out;
}

export function mergeIngestDrafts(
  existing: IngestJobDraft[],
  incoming: IngestJobDraft[],
): IngestJobDraft[] {
  return dedupeIngestDrafts([...existing, ...incoming]);
}

export function sourceLabel(source: JobIngestSource): string {
  switch (source) {
    case "scan":
      return "Live scan";
    case "screenshot":
      return "Screenshot";
    case "manual":
      return "Manual";
    case "paste":
      return "Paste";
  }
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

export function filesFromList(list: FileList | null): File[] {
  return list ? Array.from(list) : [];
}

export function imagesFromPaste(e: ClipboardEvent): File[] {
  const items = e.clipboardData?.items;
  if (!items) return [];
  const files: File[] = [];
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
}
