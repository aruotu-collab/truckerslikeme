import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExtractedParcel = {
  address: string | null;
  recipient: string | null;
  parcelRef: string | null;
  postcode: string | null;
  notes: string[];
  rawText: string | null;
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
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = String(body.imageBase64 || "").trim();
  if (!raw) {
    return NextResponse.json(
      { error: "Snap or upload a parcel label photo." },
      { status: 400 },
    );
  }

  const img = normalizeImage(raw, body.mimeType || "image/jpeg");
  if (img.base64.length > 5_500_000) {
    return NextResponse.json(
      { error: "Photo is too large. Try a tighter crop of the address." },
      { status: 413 },
    );
  }

  const prompt = `You are reading a courier parcel label / delivery note photo (UK or international).
Return ONLY JSON with:
- address (string|null) full delivery street address including town/postcode if visible
- recipient (string|null) name on the label
- parcelRef (string|null) tracking / barcode / consignment id if visible
- postcode (string|null)
- notes (string[]) short extras (e.g. flat number, "leave with neighbour")
- rawText (string|null) brief OCR summary

Rules: do not invent an address. Prefer postcode + street. If unreadable, address=null.`;

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
                  url: `data:${img.mimeType};base64,${img.base64}`,
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
          error: "Could not read that label.",
          detail: errText.slice(0, 400),
        },
        { status: 502 },
      );
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const contentText = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(stripJsonFence(contentText)) as ExtractedParcel;

    const address =
      typeof parsed.address === "string" && parsed.address.trim()
        ? parsed.address.trim()
        : parsed.postcode
          ? String(parsed.postcode).trim()
          : null;

    return NextResponse.json({
      address,
      recipient:
        typeof parsed.recipient === "string" ? parsed.recipient.trim() : null,
      parcelRef:
        typeof parsed.parcelRef === "string" ? parsed.parcelRef.trim() : null,
      postcode:
        typeof parsed.postcode === "string" ? parsed.postcode.trim() : null,
      notes: Array.isArray(parsed.notes)
        ? parsed.notes.map((n) => String(n)).filter(Boolean)
        : [],
      rawText:
        typeof parsed.rawText === "string" ? parsed.rawText.trim() : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not parse that label. Type the address instead." },
      { status: 502 },
    );
  }
}
