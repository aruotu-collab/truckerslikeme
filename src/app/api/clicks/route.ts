import { NextResponse } from "next/server";
import { visitMetaFromRequest } from "@/lib/analytics-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      event?: string;
      label?: string;
      path?: string;
      country?: string | null;
      referrer?: string | null;
      userId?: string | null;
    };
    const eventName = (body.event || "click").slice(0, 80);
    const label = (body.label || "unknown").slice(0, 120);
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
    if (!admin) return NextResponse.json({ ok: true });

    await admin.from("click_events").insert({
      event_name: eventName,
      label,
      path,
      country,
      user_id: userId,
      referrer,
      ip_hash: meta.ipHash,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
