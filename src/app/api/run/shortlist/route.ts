import { NextResponse } from "next/server";
import { extractJobsFromShiplyCapture } from "@/lib/run-shortlist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: {
    imageBase64?: string;
    images?: string[];
    start?: string;
    mode?: string;
    home?: string;
    destination?: string;
    vehicle?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const images = (
    Array.isArray(body.images) && body.images.length
      ? body.images
      : body.imageBase64
        ? [body.imageBase64]
        : []
  ).filter(Boolean);

  if (images.length === 0) {
    return NextResponse.json(
      { error: "Upload a Shiply results screenshot." },
      { status: 400 },
    );
  }

  try {
    const data = await extractJobsFromShiplyCapture({
      images,
      start: body.start,
      mode: body.mode,
      home: body.home,
      destination: body.destination,
      vehicle: body.vehicle,
    });
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Shortlist failed";
    const status = msg.includes("OPENAI_API_KEY")
      ? 503
      : msg.includes("too large")
        ? 413
        : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
