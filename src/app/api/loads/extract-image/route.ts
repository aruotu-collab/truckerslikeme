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
  /** Competing bids from a quotes table (e.g. Shiply), not your bid. */
  quotes: number[];
  lowestQuote: number | null;
  highestQuote: number | null;
  notes: string[];
  rawText: string | null;
};

function stripJsonFence(text: string) {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fence ? fence[1].trim() : trimmed;
}

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 503 },
    );
  }

  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = (await request.json()) as {
      imageBase64?: string;
      mimeType?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = body.imageBase64?.trim();
  if (!raw) {
    return NextResponse.json(
      { error: "Paste or upload a job screenshot." },
      { status: 400 },
    );
  }

  // Allow data URL or raw base64
  let mimeType = body.mimeType || "image/png";
  let base64 = raw;
  const dataUrl = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrl) {
    mimeType = dataUrl[1];
    base64 = dataUrl[2];
  }

  // Cap ~4MB base64 payload
  if (base64.length > 5_500_000) {
    return NextResponse.json(
      { error: "Screenshot is too large. Try a tighter crop." },
      { status: 413 },
    );
  }

  const prompt = `You are extracting freight / transport job details from a screenshot (e.g. Shiply, load board, rate confirmation).

Return ONLY a JSON object with keys:
- origin (string|null) pickup place / postcode area
- destination (string|null) delivery place / postcode area
- miles (number|null) trip distance in miles if shown
- rateTotal (number|null) ONLY if a single posted/offered pay amount is shown (rate conf, "paying $X"). NOT from a competitive quotes table.
- currency (string|null) e.g. GBP, USD, EUR
- item (string|null) what is being moved
- quotes (number[]) all Net Quote Amount / bid amounts from a competing quotes table. Empty array if none.
- lowestQuote (number|null) min of quotes, or null
- highestQuote (number|null) max of quotes, or null
- notes (string[]) short notes: date window, weight/size, operable vehicle, etc.
- rawText (string|null) brief readable summary of the key facts

Rules:
- Prefer concrete localities/postcodes (e.g. "Edinburgh EH4") over vague regions.
- If distance is shown as "2 miles" or "157 mi", set miles accordingly.
- If a quotes table lists bids (e.g. £60, £60, £86, £98), put those in quotes[] and set lowestQuote/highestQuote. Leave rateTotal=null — those are other providers' bids, not a confirmed rate.
- If no pay and no quotes, rateTotal=null and quotes=[].
- Do not invent rates or quotes.`;

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
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
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
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(stripJsonFence(content)) as ExtractedLoad & {
      quotes?: unknown;
    };

    const quotes = Array.isArray(parsed.quotes)
      ? parsed.quotes
          .map((q) => Number(q))
          .filter((q) => Number.isFinite(q) && q > 0)
      : [];
    const lowestFromList =
      quotes.length > 0 ? Math.min(...quotes) : null;
    const highestFromList =
      quotes.length > 0 ? Math.max(...quotes) : null;

    const extracted: ExtractedLoad = {
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
    };

    // Competitive quotes are market intel — never treat as confirmed pay
    if (extracted.quotes.length > 0) {
      extracted.rateTotal = null;
      if (extracted.lowestQuote == null) {
        extracted.lowestQuote = lowestFromList;
      }
      if (extracted.highestQuote == null) {
        extracted.highestQuote = highestFromList;
      }
    }

    return NextResponse.json({ extracted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Extract failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
