import { NextResponse } from "next/server";
import { buildLiveFeed } from "@/lib/intel/feed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const feed = await buildLiveFeed();
    return NextResponse.json(feed, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        items: [],
        updatedAt: new Date().toISOString(),
        sources: [],
        error: err instanceof Error ? err.message : "Feed failed",
      },
      { status: 500 },
    );
  }
}
