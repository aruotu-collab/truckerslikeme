import { NextResponse } from "next/server";
import { shiplyConnectConfigured } from "@/lib/shiply-connect-config";
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
}

rateTotal = customer budget / suggested pay if shown — never quote-count.`;

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
  const selected = (body.jobs ?? []).slice(0, 4);
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
    const {
      captureVisibleShiply,
      connectShiplyPage,
      extractJobAnchors,
      matchHrefToJob,
      openShiplyJob,
    } = await import("@/lib/shiply-playwright");
    const connected = await connectShiplyPage(sessionId);
    browser = connected.browser;
    const page = connected.page;
    const resultsUrl = page.url();
    const anchors = await extractJobAnchors(page);
    const enriched: RunJob[] = [];
    const errors: string[] = [];

    for (const job of selected) {
      let detail: Partial<RunJob> = {};
      let opened = false;
      const href = job.href?.trim() || matchHrefToJob(job, anchors);
      try {
        // Return to results between jobs so row-clicks still work
        if (resultsUrl && page.url() !== resultsUrl) {
          await page.goto(resultsUrl, {
            waitUntil: "domcontentloaded",
            timeout: 45_000,
          });
        }
        await openShiplyJob(page, { ...job, href });
        opened = true;
        const capture = await captureVisibleShiply(page);
        detail = await extractFullJob({
          imageBase64: capture.screenshotBase64,
          pageText: capture.text,
          pageUrl: capture.url,
        });
      } catch (err) {
        errors.push(
          err instanceof Error
            ? err.message
            : `Could not open ${job.item || job.id}`,
        );
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
        reason: job.reason || "Opened from Shiply connect",
        notes: Array.isArray(detail.notes)
          ? detail.notes.map(String).slice(0, 4)
          : [
              opened
                ? "Full job page opened automatically"
                : "List-row only — open failed",
            ],
      });
    }

    return NextResponse.json({
      jobs: enriched,
      openedCount: enriched.filter((j) =>
        j.notes?.some((n) => /opened automatically/i.test(n)),
      ).length,
      errors: errors.slice(0, 4),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Import failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}
