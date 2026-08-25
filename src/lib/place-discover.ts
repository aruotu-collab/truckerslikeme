import type { PlaceConfidence, PlaceKind, PlaceResult } from "@/lib/places";

type SearchInput = {
  near: string;
  kind: PlaceKind;
  when: string;
  truck: string;
  priority: string;
  freeText?: string;
};

function buildQuery(input: SearchInput) {
  const need =
    input.kind === "parking"
      ? "truck parking / overnight holding bay"
      : input.kind === "diesel"
        ? "diesel / truck fuel station"
        : "truck repair / workshop";
  return [
    `Find ${need} near ${input.near}.`,
    `Vehicle: ${input.truck}.`,
    `Timing: ${input.when}.`,
    `Priority: ${input.priority}.`,
    input.freeText ? `Extra: ${input.freeText}` : "",
    "Return up to 5 options suitable for heavy trucks if possible.",
    "For each: name, address or area, overnight yes/no if known, security yes/no if known, phone if known, short note, and whether driver should call first.",
  ]
    .filter(Boolean)
    .join(" ");
}

function fallbackResults(input: SearchInput): PlaceResult[] {
  const label =
    input.kind === "parking"
      ? "Truck parking search"
      : input.kind === "diesel"
        ? "Diesel search"
        : "Repair search";
  return [
    {
      name: `${label} near ${input.near}`,
      kind: input.kind,
      area: input.near,
      confidence: "call_first",
      summary:
        "Add OPENAI_API_KEY for live web discovery worldwide. Until then, search your maps app and report back so we can verify places for the next driver.",
      source: "fallback",
      distanceNote: "Search locally",
      overnight: input.when.includes("night") || input.when === "overnight",
    },
    {
      name: `Ask local drivers near ${input.near}`,
      kind: input.kind,
      area: input.near,
      confidence: "web_found",
      summary:
        "Community confirmation is the long-term moat. After you find a spot, tap Yes/No so TruckersLikeMe remembers it.",
      source: "fallback",
    },
  ];
}

function parseModelJson(text: string, kind: PlaceKind): PlaceResult[] {
  try {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start < 0 || end < 0) return [];
    const raw = JSON.parse(text.slice(start, end + 1)) as Array<{
      name?: string;
      address?: string;
      area?: string;
      overnight?: boolean;
      security?: boolean;
      phone?: string;
      note?: string;
      callFirst?: boolean;
      distanceNote?: string;
    }>;
    return raw
      .filter((r) => r.name)
      .slice(0, 5)
      .map((r) => {
        const confidence: PlaceConfidence = r.callFirst
          ? "call_first"
          : "web_found";
        return {
          name: r.name!,
          kind,
          address: r.address ?? null,
          area: r.area ?? null,
          overnight: r.overnight ?? null,
          security: r.security ?? null,
          phone: r.phone ?? null,
          summary: r.note ?? null,
          distanceNote: r.distanceNote ?? null,
          confidence,
          source: "openai_web",
        } satisfies PlaceResult;
      });
  } catch {
    return [];
  }
}

/** OpenAI discovers; caller merges with TLM DB. Works without a key via fallback. */
export async function discoverPlaces(
  input: SearchInput,
): Promise<{ places: PlaceResult[]; provider: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return { places: fallbackResults(input), provider: "fallback" };
  }

  const prompt = `${buildQuery(input)}

Respond with ONLY a JSON array of objects with keys:
name, address, area, overnight, security, phone, note, callFirst, distanceNote.
No markdown.`;

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        tools: [{ type: "web_search_preview" }],
        input: prompt,
      }),
    });

    if (!res.ok) {
      // Older fallback: chat completions without web search
      const chat = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "You help truck drivers find parking, diesel, and repair. Be cautious. Prefer call-first when unsure. Reply with JSON array only.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!chat.ok) {
        return { places: fallbackResults(input), provider: "fallback" };
      }
      const chatJson = (await chat.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = chatJson.choices?.[0]?.message?.content ?? "";
      const places = parseModelJson(text, input.kind);
      return {
        places: places.length ? places : fallbackResults(input),
        provider: places.length ? "openai_chat" : "fallback",
      };
    }

    const json = (await res.json()) as {
      output_text?: string;
      output?: { content?: { text?: string }[] }[];
    };
    const text =
      json.output_text ||
      json.output?.flatMap((o) => o.content ?? []).map((c) => c.text ?? "").join("\n") ||
      "";
    const places = parseModelJson(text, input.kind);
    return {
      places: places.length ? places : fallbackResults(input),
      provider: places.length ? "openai_responses" : "fallback",
    };
  } catch {
    return { places: fallbackResults(input), provider: "fallback" };
  }
}
