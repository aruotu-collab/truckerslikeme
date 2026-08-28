import { NextResponse } from "next/server";
import { visitMetaFromRequest } from "@/lib/analytics-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      path?: string;
      country?: string | null;
      referrer?: string | null;
      userId?: string | null;
    };
    const path = (body.path || "/").slice(0, 200);
    const meta = visitMetaFromRequest(request);
    const country = meta.country ?? body.country?.slice(0, 2).toUpperCase() ?? null;
    const referrer = (body.referrer ?? meta.referrer)?.slice(0, 500) ?? null;

    let userId: string | null = body.userId ?? null;
    const supabase = await createClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) userId = user.id;
    }

    const admin = createAdminClient();
    if (!admin) {
      console.error("[visits] SUPABASE_SERVICE_ROLE_KEY missing — visit not recorded");
      return NextResponse.json({ ok: false, reason: "no_admin_client" }, { status: 503 });
    }

    const { error: insertError } = await admin.from("page_visits").insert({
      path,
      country,
      user_id: userId,
      referrer,
      ip_hash: meta.ipHash,
    });

    if (insertError) {
      // Older DBs may only have path + visited_at until schema-analytics.sql runs.
      const { error: fallbackError } = await admin
        .from("page_visits")
        .insert({ path });
      if (fallbackError) {
        console.error("[visits] insert failed:", insertError.message, fallbackError.message);
        return NextResponse.json({ ok: false }, { status: 500 });
      }
    }

    if (userId) {
      const { error: profileError } = await admin
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", userId);
      if (profileError) {
        console.warn("[visits] last_seen_at update failed:", profileError.message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[visits] unexpected error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
