import { placeKey } from "@/lib/jobs-map";

const STORAGE_KEY = "tlm_shiply_scan_v1";

export type ShiplyScanSnapshot = {
  scannedAt: string;
  fingerprints: string[];
  jobCount: number;
};

export type ScanJobLike = {
  id?: string;
  href?: string | null;
  origin?: string | null;
  destination?: string | null;
  item?: string | null;
};

/** Stable key for the same Shiply listing across scans (ids from AI vary). */
export function jobFingerprint(job: ScanJobLike): string {
  const href = job.href?.trim();
  if (href) {
    try {
      const u = new URL(href, "https://www.shiply.com");
      return `href:${u.pathname}${u.search}`;
    } catch {
      return `href:${href.toLowerCase()}`;
    }
  }
  const o = placeKey(job.origin);
  const d = placeKey(job.destination);
  const item = (job.item || "").trim().toLowerCase();
  return `lane:${o}|${d}|${item}`;
}

export function readLastScanSnapshot(): ShiplyScanSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShiplyScanSnapshot;
    if (!parsed?.scannedAt || !Array.isArray(parsed.fingerprints)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLastScanSnapshot(jobs: ScanJobLike[]) {
  if (typeof window === "undefined") return;
  const fingerprints = jobs.map(jobFingerprint);
  const snapshot: ShiplyScanSnapshot = {
    scannedAt: new Date().toISOString(),
    fingerprints,
    jobCount: jobs.length,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function diffAgainstLastScan(
  previous: ShiplyScanSnapshot | null,
  jobs: ScanJobLike[],
) {
  if (!previous) {
    return {
      newJobs: jobs,
      newFingerprints: new Set(jobs.map(jobFingerprint)),
      newCount: jobs.length,
      isFirstScan: true,
    };
  }
  const prevSet = new Set(previous.fingerprints);
  const newFingerprints = new Set<string>();
  const newJobs: ScanJobLike[] = [];
  for (const job of jobs) {
    const fp = jobFingerprint(job);
    if (!prevSet.has(fp)) {
      newFingerprints.add(fp);
      newJobs.push(job);
    }
  }
  return {
    newJobs,
    newFingerprints,
    newCount: newJobs.length,
    isFirstScan: false,
  };
}

export function formatLastScan(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function scanSummaryMessage(
  diff: ReturnType<typeof diffAgainstLastScan>,
  total: number,
  lastAt: string,
): string {
  const when = formatLastScan(lastAt);
  if (diff.isFirstScan) {
    return total === 1
      ? "First scan — 1 job on this page."
      : `First scan — ${total} jobs on this page.`;
  }
  if (diff.newCount === 0) {
    return when
      ? `Last scan ${when} · no new jobs since then (${total} on page now).`
      : `No new jobs since your last scan (${total} on page now).`;
  }
  const noun = diff.newCount === 1 ? "new job" : "new jobs";
  return when
    ? `Last scan ${when} · ${diff.newCount} ${noun} since then (${total} on page).`
    : `${diff.newCount} ${noun} since your last scan (${total} on page).`;
}
