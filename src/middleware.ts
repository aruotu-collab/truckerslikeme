import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const IP_COUNTRY_COOKIE = "tlm_ip_country";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  // Vercel provides request.geo / x-vercel-ip-country — no GPS permission needed.
  const country =
    request.geo?.country ||
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry");

  if (
    country &&
    country !== "XX" &&
    country.length === 2
  ) {
    response.cookies.set(IP_COUNTRY_COOKIE, country.toUpperCase(), {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run session refresh on app pages only.
     * Skip SEO/crawl assets so Google can fetch sitemap & robots cleanly.
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
