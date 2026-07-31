import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { path?: string };
    const path = (body.path || "/").slice(0, 200);
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ ok: true });
    await admin.from("page_visits").insert({ path });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
