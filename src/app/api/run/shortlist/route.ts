import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type ShortlistedJob = {
  id: string;
  origin: string | null;
  destination: string | null;
  miles: number | null;
  rateTotal: number | null;
  item: string | null;
  verdict: "open" | "maybe" | "skip" | "high";
  reason: string;
};

function stripJsonFence(text: string) {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fence ? fence[1].trim() : trimmed;
}

function normalizeImage(raw: string) {
  let mimeType = "image/png";
  let base64 = raw.trim();
  const dataUrl = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrl) {
    mimeType = dataUrl[1];
    base64 = dataUrl[2];
  }
  return { mimeType, base64 };
}

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 503 },
    );
  }

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

  const goal =
    body.mode === "home"
      ? `Driver wants to progress toward home: ${body.home || "home base"}.`
      : body.mode === "destination"
        ? `Driver is heading toward: ${body.destination || "a known destination"}.`
        : "Driver wants maximum profit from here — finish location flexible.";

  const prompt = `You are helping a UK/EU van or truck driver shortlist Shiply (or similar) SEARCH RESULTS.

Driver start: ${body.start || "unknown"}
Vehicle: ${body.vehicle || "Luton van"}
Goal: ${goal}

From the screenshot(s) of a job RESULTS LIST (not necessarily full job pages), extract every visible job row.

Return ONLY JSON:
{
  "jobs": [
    {
      "origin": string|null,
      "destination": string|null,
      "miles": number|null,
      "rateTotal": number|null,
      "item": string|null,
      "verdict": "high"|"open"|"maybe"|"skip",
      "reason": string
    }
  ],
  "coach": string
}

Verdict rules:
- high / open: fits vehicle vibe, sensible direction for the goal, worth opening full details
- maybe: possible but weaker pay/direction
- skip: wrong direction, tiny money for miles, or clearly useless for the goal
- Prefer 3–5 open/high max unless the list is excellent
- rateTotal: customer budget or visible pay if shown; else null
- coach: one short paragraph telling the driver which jobs to open next`;

  const content: { type: string; text?: string; image_url?: { url: string } }[] =
    [{ type: "text", text: prompt }];
  for (const raw of images.slice(0, 4)) {
    const img = normalizeImage(raw);
    if (img.base64.length > 5_500_000) {
      return NextResponse.json(
        { error: "Screenshot too large." },
        { status: 413 },
      );
    }
    content.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
    });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        messages: [{ role: "user", content }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: "Could not read that results list.", detail: errText.slice(0, 300) },
        { status: 502 },
      );
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(stripJsonFence(text)) as {
      jobs?: ShortlistedJob[];
      coach?: string;
    };
    const jobs = (parsed.jobs ?? []).map((j, i) => ({
      id: `list-${i}-${(j.origin || "x").slice(0, 12)}`,
      origin: j.origin ?? null,
      destination: j.destination ?? null,
      miles:
        j.miles != null && Number.isFinite(Number(j.miles))
          ? Number(j.miles)
          : null,
      rateTotal:
        j.rateTotal != null && Number.isFinite(Number(j.rateTotal))
          ? Number(j.rateTotal)
          : null,
      item: j.item ?? null,
      verdict: (["high", "open", "maybe", "skip"].includes(j.verdict)
        ? j.verdict
        : "maybe") as ShortlistedJob["verdict"],
      reason: j.reason || "",
    }));

    return NextResponse.json({
      jobs,
      coach:
        parsed.coach ||
        "Open the HIGH/OPEN jobs for full details, then upload those screenshots.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Shortlist failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
