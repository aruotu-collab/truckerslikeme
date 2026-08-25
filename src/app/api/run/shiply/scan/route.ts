import { NextResponse } from "next/server";
import { shiplyConnectConfigured } from "@/lib/shiply-connect-config";
import { extractJobsFromShiplyCapture } from "@/lib/run-shortlist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!shiplyConnectConfigured()) {
    return NextResponse.json(
      { error: "Shiply connect is not configured." },
      { status: 503 },
    );
  }

  let body: {
    sessionId?: string;
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

  if (!body.sessionId?.trim()) {
    return NextResponse.json(
      { error: "Missing Shiply session." },
      { status: 400 },
    );
  }

  let browser;
  try {
    const { captureVisibleShiply, connectShiplyPage } = await import(
      "@/lib/shiply-browser"
    );
    const connected = await connectShiplyPage(body.sessionId.trim());
    browser = connected.browser;
    const capture = await captureVisibleShiply(connected.page);

    const extracted = await extractJobsFromShiplyCapture({
      images: [capture.screenshotBase64],
      pageText: capture.text,
      pageUrl: capture.url,
      start: body.start,
      mode: body.mode,
      home: body.home,
      destination: body.destination,
      vehicle: body.vehicle,
      forSelection: true,
    });

    return NextResponse.json({
      pageUrl: capture.url,
      jobs: extracted.jobs,
      coach: extracted.coach,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Scan failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}
