import { NextResponse } from "next/server";
import {
  captureVisibleShiply,
  connectShiplyPage,
  shiplyConnectConfigured,
} from "@/lib/shiply-browser";
import type { RunJob } from "@/lib/run-builder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function stripJsonFence(text: string) {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fence ? fence[1].trim() : trimmed;
}

async function extractFullJob(input: {
  imageBase64: string;
  pageText: string;
  pageUrl: string;
}): Promise<Partial<RunJob>> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");

  const prompt = `Extract ONE Shiply (or similar) job from this full job page.

Page URL: ${input.pageUrl}
Visible text: ${input.pageText.slice(0, 10000)}

Return ONLY JSON:
{
  "origin": string|null,
  "destination": string|null,
  "miles": number|null,
  "rateTotal": number|null,
  "item": string|null,
  "notes": string[]
}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: input.imageBase64 },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) return {};
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(stripJsonFence(text)) as Partial<RunJob>;
  } catch {
    return {};
  }
}

type SelectedJob = {
  id: string;
  origin?: string | null;
  destination?: string | null;
  miles?: number | null;
  rateTotal?: number | null;
  item?: string | null;
  href?: string | null;
  verdict?: RunJob["verdict"];
  reason?: string;
};

export async function POST(request: Request) {
  if (!shiplyConnectConfigured()) {
    return NextResponse.json(
      { error: "Shiply connect is not configured." },
      { status: 503 },
    );
  }

  let body: { sessionId?: string; jobs?: SelectedJob[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  const selected = (body.jobs ?? []).slice(0, 5);
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session." }, { status: 400 });
  }
  if (!selected.length) {
    return NextResponse.json(
      { error: "Select at least one job to analyse." },
      { status: 400 },
    );
  }

  let browser;
  try {
    const connected = await connectShiplyPage(sessionId);
    browser = connected.browser;
    const page = connected.page;
    const enriched: RunJob[] = [];

    for (const job of selected) {
      let detail: Partial<RunJob> = {};
      const href = job.href?.trim();
      if (href) {
        try {
          const absolute = href.startsWith("http")
            ? href
            : new URL(href, page.url() || "https://www.shiply.com/").toString();
          await page.goto(absolute, {
            waitUntil: "domcontentloaded",
            timeout: 45_000,
          });
          const capture = await captureVisibleShiply(page);
          detail = await extractFullJob({
            imageBase64: capture.screenshotBase64,
            pageText: capture.text,
            pageUrl: capture.url,
          });
        } catch {
          // Fall back to list-row summary
        }
      }

      enriched.push({
        id: job.id,
        origin: detail.origin ?? job.origin ?? null,
        destination: detail.destination ?? job.destination ?? null,
        miles:
          detail.miles != null && Number.isFinite(Number(detail.miles))
            ? Number(detail.miles)
            : job.miles ?? null,
        rateTotal:
          detail.rateTotal != null && Number.isFinite(Number(detail.rateTotal))
            ? Number(detail.rateTotal)
            : job.rateTotal ?? null,
        item: detail.item ?? job.item ?? null,
        verdict: job.verdict || "open",
        reason: job.reason || "Selected from Shiply connect",
        notes: Array.isArray(detail.notes)
          ? detail.notes.map(String).slice(0, 4)
          : ["Imported via Connect Shiply"],
      });
    }

    return NextResponse.json({ jobs: enriched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Import failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}
