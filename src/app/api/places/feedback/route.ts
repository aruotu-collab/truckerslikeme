import { NextResponse } from "next/server";
import { getSignedInUser } from "@/lib/billing-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = {
  placeId?: string;
  didPark?: boolean;
  overnight?: boolean;
  security?: boolean;
  priceNote?: string;
  notes?: string;
};

export async function POST(request: Request) {
  const { user } = await getSignedInUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.placeId || typeof body.didPark !== "boolean") {
    return NextResponse.json(
      { error: "placeId and didPark required." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server database not configured." },
      { status: 503 },
    );
  }

  const { error: fbError } = await admin.from("place_feedback").insert({
    place_id: body.placeId,
    user_id: user.id,
    did_park: body.didPark,
    overnight: body.overnight ?? null,
    security: body.security ?? null,
    price_note: body.priceNote ?? null,
    notes: body.notes ?? null,
  });

  if (fbError) {
    return NextResponse.json({ error: fbError.message }, { status: 500 });
  }

  const { data: place } = await admin
    .from("places")
    .select("confirm_yes, confirm_no, confidence")
    .eq("id", body.placeId)
    .maybeSingle();

  if (place) {
    const yes = Number(place.confirm_yes ?? 0) + (body.didPark ? 1 : 0);
    const no = Number(place.confirm_no ?? 0) + (body.didPark ? 0 : 1);
    let confidence = String(place.confidence ?? "web_found");
    if (yes >= 3 && no === 0) confidence = "tlm_verified";
    else if (yes >= 1) confidence = "driver_confirmed";
    else if (!body.didPark) confidence = "call_first";

    await admin
      .from("places")
      .update({
        confirm_yes: yes,
        confirm_no: no,
        confidence,
        overnight: body.overnight ?? undefined,
        security: body.security ?? undefined,
        price_note: body.priceNote ?? undefined,
        last_confirmed_at: body.didPark
          ? new Date().toISOString()
          : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.placeId);
  }

  return NextResponse.json({ ok: true });
}
