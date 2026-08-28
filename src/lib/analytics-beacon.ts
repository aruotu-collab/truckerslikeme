/** Reliable first-party analytics POST — sendBeacon first (mobile-friendly), fetch fallback. */
export async function postAnalyticsBeacon(
  url: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const body = JSON.stringify(payload);

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return true;
    }
  } catch {
    // fall through to fetch
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    });
    return res.ok;
  } catch {
    return false;
  }
}
