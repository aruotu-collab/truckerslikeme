import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Country from CDN edge (Vercel / Cloudflare) — no GPS. */
export async function GET(request: Request) {
  const country =
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    null;

  if (!country || country === "XX" || country.length !== 2) {
    return NextResponse.json({ country: null });
  }

  return NextResponse.json({ country: country.toUpperCase() });
}
