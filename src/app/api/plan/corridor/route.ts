import { NextResponse } from "next/server";
import { discoverCorridorStops } from "@/lib/place-discover";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  origin?: string;
  destination?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const origin = body.origin?.trim();
  const destination = body.destination?.trim();
  if (!origin || !destination) {
    return NextResponse.json(
      { error: "Need both from and to for corridor discovery." },
      { status: 400 },
    );
  }

  const result = await discoverCorridorStops({ origin, destination });

  return NextResponse.json({
    origin,
    destination,
    miles: result.miles,
    hours: result.hours,
    notes: result.notes,
    provider: result.provider,
    stops: result.stops.map((s, i) => ({
      id: `live-${s.kind}-${i}-${s.mile}`,
      type: s.kind,
      label: s.name,
      detail: s.detail || s.area || "",
      mile: s.mile,
      status: "good" as const,
    })),
  });
}
