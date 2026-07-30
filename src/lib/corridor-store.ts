import type { CorridorFocus } from "@/lib/intel/rank";
import { corridorFromSearch } from "@/lib/intel/rank";

const KEY = "tlm:last-corridor";

export function readLastCorridor(): CorridorFocus | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CorridorFocus;
    if (!parsed?.origin || !parsed?.destination) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLastCorridor(origin: string, destination: string) {
  if (typeof window === "undefined") return;
  const value = corridorFromSearch(origin, destination);
  window.localStorage.setItem(KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("tlm:corridor", { detail: value }));
}
