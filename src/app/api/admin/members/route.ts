import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Service role key missing on server." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    userId?: string;
    plan?: "free" | "pro";
    role?: "driver" | "admin";
  };

  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const patch: Record<string, string> = {};
  if (body.plan === "free" || body.plan === "pro") patch.plan = body.plan;
  if (body.role === "driver" || body.role === "admin") patch.role = body.role;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await admin
    .from("profiles")
    .update(patch)
    .eq("id", body.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.role === "driver" || body.role === "admin") {
    await admin.auth.admin.updateUserById(body.userId, {
      app_metadata: { role: body.role },
    });
  }

  return NextResponse.json({ ok: true });
}
