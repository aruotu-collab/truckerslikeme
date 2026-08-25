import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExtractedLoad = {
  origin: string | null;
  destination: string | null;
  miles: number | null;
  rateTotal: number | null;
  currency: string | null;
  item: string | null;
  weightKg: number | null;
  lengthM: number | null;
  widthM: number | null;
  heightM: number | null;
  dateWindow: string | null;
  quotes: number[];
  lowestQuote: number | null;
  highestQuote: number | null;
  notes: string[];
  rawText: string | null;
  found: string[];
  missing: string[];
};

function stripJsonFence(text: string) {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fence ? fence[1].trim() : trimmed;
}

function normalizeImage(raw: string, fallbackMime: string) {
  let mimeType = fallbackMime;
  let base64 = raw.trim();
  const dataUrl = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrl) {
    mimeType = dataUrl[1];
    base64 = dataUrl[2];
  }
  return { mimeType, base64 };
}

function withCoverage(extracted: ExtractedLoad): ExtractedLoad {
  const found: string[] = [];
  const missing: string[] = [];
  const mark = (ok: boolean, label: string) => {
    if (ok) found.push(label);
    else missing.push(label);
  };
  mark(Boolean(extracted.origin), "Pickup");
  mark(Boolean(extracted.destination), "Delivery");
  mark(extracted.miles != null && extracted.miles > 0, "Distance");
  mark(
    extracted.rateTotal != null ||
      (extracted.quotes && extracted.quotes.length > 0),
    "Pay / quotes",
  );
  mark(Boolean(extracted.item), "Item");
  mark(
    extracted.weightKg != null ||
      extracted.lengthM != null ||
      Boolean(extracted.notes?.some((n) => /weight|kg|size|length/i.test(n))),
    "Size / weight",
  );
  mark(
    Boolean(extracted.dateWindow) ||
      Boolean(extracted.notes?.some((n) => /date|between|collect|deliver/i.test(n))),
    "Date window",
  );
  return { ...extracted, found, missing };
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
    mimeType?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const imageList = (
    Array.isArray(body.images) && body.images.length > 0
      ? body.images
      : body.imageBase64
        ? [body.imageBase64]
        : []
  )
    .map((s) => String(s || "").trim())
    .filter(Boolean);

  if (imageList.length === 0) {
    return NextResponse.json(
      { error: "Paste or upload at least one job screenshot." },
      { status: 400 },
    );
  }
  if (imageList.length > 6) {
    return NextResponse.json(
      { error: "Max 6 screenshots per job." },
      { status: 400 },
    );
  }

  const normalized = imageList.map((raw) =>
    normalizeImage(raw, body.mimeType || "image/png"),
  );
  for (const img of normalized) {
    if (img.base64.length > 5_500_000) {
      return NextResponse.json(
        { error: "A screenshot is too large. Try a tighter crop." },
        { status: 413 },
      );
    }
  }

  const prompt = `You are extracting freight / transport job details from ${normalized.length} screenshot(s) of the SAME job (e.g. Shiply). Screenshots may be scrolled sections — merge them into ONE job. Prefer overlapping text to order sections.

Return ONLY a JSON object with keys:
- origin (string|null)
- destination (string|null)
- miles (number|null) distance in miles if shown (convert km→miles if needed)
- rateTotal (number|null) ONLY a single posted pay. Null if only a competing quotes table.
- currency (string|null) GBP/USD/EUR
- item (string|null)
- weightKg (number|null)
- lengthM, widthM, heightM (number|null)
- dateWindow (string|null) e.g. preferred delivery dates
- quotes (number[]) competing bid amounts; [] if none
- lowestQuote, highestQuote (number|null)
- notes (string[])
- rawText (string|null) short merged summary

Rules:
- Merge facts across images; do not invent.
- Quotes table → quotes[], rateTotal=null.
- Prefer postcodes/localities.`;

  const content: { type: string; text?: string; image_url?: { url: string } }[] =
    [{ type: "text", text: prompt }];
  for (const img of normalized) {
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
        temperature: 0,
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        {
          error: "Could not read that screenshot.",
          detail: errText.slice(0, 400),
        },
        { status: 502 },
      );
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const contentText = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(stripJsonFence(contentText)) as ExtractedLoad & {
      quotes?: unknown;
    };

    const quotes = Array.isArray(parsed.quotes)
      ? parsed.quotes
          .map((q) => Number(q))
          .filter((q) => Number.isFinite(q) && q > 0)
      : [];
    const lowestFromList = quotes.length ? Math.min(...quotes) : null;
    const highestFromList = quotes.length ? Math.max(...quotes) : null;

    let extracted: ExtractedLoad = {
      origin: parsed.origin ?? null,
      destination: parsed.destination ?? null,
      miles:
        parsed.miles != null && Number.isFinite(Number(parsed.miles))
          ? Number(parsed.miles)
          : null,
      rateTotal:
        parsed.rateTotal != null && Number.isFinite(Number(parsed.rateTotal))
          ? Number(parsed.rateTotal)
          : null,
      currency: parsed.currency ?? null,
      item: parsed.item ?? null,
      weightKg:
        parsed.weightKg != null && Number.isFinite(Number(parsed.weightKg))
          ? Number(parsed.weightKg)
          : null,
      lengthM:
        parsed.lengthM != null && Number.isFinite(Number(parsed.lengthM))
          ? Number(parsed.lengthM)
          : null,
      widthM:
        parsed.widthM != null && Number.isFinite(Number(parsed.widthM))
          ? Number(parsed.widthM)
          : null,
      heightM:
        parsed.heightM != null && Number.isFinite(Number(parsed.heightM))
          ? Number(parsed.heightM)
          : null,
      dateWindow: parsed.dateWindow ?? null,
      quotes,
      lowestQuote:
        parsed.lowestQuote != null && Number.isFinite(Number(parsed.lowestQuote))
          ? Number(parsed.lowestQuote)
          : lowestFromList,
      highestQuote:
        parsed.highestQuote != null &&
        Number.isFinite(Number(parsed.highestQuote))
          ? Number(parsed.highestQuote)
          : highestFromList,
      notes: Array.isArray(parsed.notes) ? parsed.notes.map(String) : [],
      rawText: parsed.rawText ?? null,
      found: [],
      missing: [],
    };

    if (extracted.quotes.length > 0) {
      extracted.rateTotal = null;
    }

    extracted = withCoverage(extracted);
    return NextResponse.json({
      extracted,
      imageCount: normalized.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Extract failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
