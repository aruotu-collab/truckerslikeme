import { NextResponse } from "next/server";
import {
  createShiplySession,
  shiplyConnectConfigured,
} from "@/lib/shiply-browser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({
    enabled: shiplyConnectConfigured(),
  });
}

export async function POST(request: Request) {
  if (!shiplyConnectConfigured()) {
    return NextResponse.json(
      {
        error:
          "Shiply connect is not configured yet. Add BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID, or use screenshots.",
        enabled: false,
      },
      { status: 503 },
    );
  }

  let body: { contextId?: string | null } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const session = await createShiplySession({
      contextId: body.contextId,
    });
    return NextResponse.json({
      enabled: true,
      sessionId: session.sessionId,
      liveViewUrl: session.liveViewUrl,
      contextId: session.contextId,
      tip: "Log into Shiply in the browser below, run your search, then scan the results list.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not start Shiply session.";
    return NextResponse.json({ error: msg, enabled: true }, { status: 502 });
  }
}
