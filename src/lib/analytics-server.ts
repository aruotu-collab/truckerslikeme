import { createHash } from "crypto";

export function hashVisitorIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.ANALYTICS_IP_SALT ?? "tlm-analytics";
  return createHash("sha256")
    .update(`${salt}:${ip.trim()}`)
    .digest("hex")
    .slice(0, 16);
}

export function clientIpFromRequest(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() ?? null;
}

export function countryFromRequest(request: Request): string | null {
  const raw =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry");
  if (!raw || raw === "XX" || raw.length !== 2) return null;
  return raw.toUpperCase();
}

export function referrerFromRequest(request: Request): string | null {
  const ref = request.headers.get("referer");
  return ref ? ref.slice(0, 500) : null;
}

export type VisitMeta = {
  country: string | null;
  ipHash: string | null;
  referrer: string | null;
};

export function visitMetaFromRequest(request: Request): VisitMeta {
  const ip = clientIpFromRequest(request);
  return {
    country: countryFromRequest(request),
    ipHash: hashVisitorIp(ip),
    referrer: referrerFromRequest(request),
  };
}
