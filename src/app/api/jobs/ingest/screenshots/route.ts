import { NextResponse } from "next/server";
import { extractJobsFromShiplyCapture } from "@/lib/run-shortlist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

const MAX_IMAGES = 10;

export async function POST(request: Request) {
  let body: {
    images?: string[];
    start?: string;
    vehicle?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const images = (body.images ?? []).filter(Boolean).slice(0, MAX_IMAGES);
  if (!images.length) {
    return NextResponse.json(
      { error: "Upload at least one Shiply results screenshot." },
      { status: 400 },
    );
  }

  try {
    const data = await extractJobsFromShiplyCapture({
      images,
      start: body.start,
      mode: "profit",
      vehicle: body.vehicle || "van",
      completeList: true,
    });
    return NextResponse.json({
      jobs: data.jobs,
      coach: data.coach,
      source: "screenshot" as const,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not read screenshots.";
    const status = msg.includes("OPENAI_API_KEY")
      ? 503
      : msg.includes("too large")
        ? 413
        : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
