import { NextResponse } from "next/server";
import { discoverPlaces } from "@/lib/place-discover";
import { badgeRank, type PlaceKind, type PlaceResult } from "@/lib/places";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = {
  near?: string;
  kind?: PlaceKind;
  when?: string;
  truck?: string;
  priority?: string;
  freeText?: string;
};

function normalizeConfidence(
  raw: string | null | undefined,
  yes: number,
): PlaceResult["confidence"] {
  if (
    raw === "tlm_verified" ||
    raw === "driver_confirmed" ||
    raw === "web_found" ||
    raw === "call_first"
  ) {
    return raw;
  }
  if (yes >= 3) return "tlm_verified";
  if (yes >= 1) return "driver_confirmed";
  return "web_found";
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const near = body.near?.trim();
  if (!near) {
    return NextResponse.json(
      { error: "Tell us where you need this (city, port, area)." },
      { status: 400 },
    );
  }

  const kind: PlaceKind =
    body.kind === "diesel" || body.kind === "repair" ? body.kind : "parking";
  const when = body.when?.trim() || "tonight";
  const truck = body.truck?.trim() || "artic";
  const priority = body.priority?.trim() || "safe";

  const local: PlaceResult[] = [];
  const admin = createAdminClient();
  if (admin) {
    const areaHint = near.split(",")[0]?.trim() || near;
    const { data } = await admin
      .from("places")
      .select(
        "id, name, kind, address, area, overnight, security, phone, price_note, confidence, confirm_yes",
      )
      .ilike("area", `%${areaHint}%`)
      .eq("kind", kind)
      .limit(8);

    for (const row of data ?? []) {
      const yes = Number(row.confirm_yes ?? 0);
      local.push({
        id: row.id,
        name: row.name,
        kind,
        address: row.address,
        area: row.area,
        overnight: row.overnight,
        security: row.security,
        phone: row.phone,
        priceNote: row.price_note,
        confidence: normalizeConfidence(row.confidence, yes),
        source: "tlm_db",
        summary:
          yes > 0
            ? `${yes} driver confirmation(s) on TruckersLikeMe.`
            : null,
      });
    }
  }

  const discovered = await discoverPlaces({
    near,
    kind,
    when,
    truck,
    priority,
    freeText: body.freeText,
  });

  const merged = [...local];
  for (const p of discovered.places) {
    const key = p.name.toLowerCase();
    if (merged.some((m) => m.name.toLowerCase() === key)) continue;
    merged.push(p);
  }

  merged.sort((a, b) => badgeRank(a.confidence) - badgeRank(b.confidence));

  if (admin) {
    const areaHint = near.split(",")[0]?.trim() || near;
    for (const p of discovered.places.slice(0, 3)) {
      if (p.source === "fallback") continue;
      const { data: existing } = await admin
        .from("places")
        .select("id")
        .eq("name", p.name)
        .ilike("area", `%${areaHint}%`)
        .maybeSingle();
      if (existing?.id) continue;
      await admin.from("places").insert({
        name: p.name,
        kind,
        address: p.address ?? null,
        area: p.area || near,
        overnight: p.overnight ?? null,
        security: p.security ?? null,
        phone: p.phone ?? null,
        price_note: p.priceNote ?? null,
        source: p.source || "web",
        confidence: p.confidence,
        payload: { when, truck, priority },
      });
    }
  }

  return NextResponse.json({
    near,
    kind,
    provider: discovered.provider,
    results: merged.slice(0, 8),
  });
}
