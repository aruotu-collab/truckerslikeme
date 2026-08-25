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

export type CorridorStopDraft = {
  kind: "parking" | "fuel" | "repair";
  name: string;
  detail: string;
  /** Approximate miles from origin along the haul */
  mile: number;
  area?: string | null;
};

function parseCorridorJson(text: string): {
  miles: number | null;
  hours: number | null;
  stops: CorridorStopDraft[];
  notes: string[];
} {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < 0) {
      return { miles: null, hours: null, stops: [], notes: [] };
    }
    const raw = JSON.parse(text.slice(start, end + 1)) as {
      miles?: number;
      hours?: number;
      notes?: string[];
      stops?: Array<{
        kind?: string;
        name?: string;
        detail?: string;
        mile?: number;
        area?: string;
      }>;
    };
    const stops: CorridorStopDraft[] = (raw.stops ?? [])
      .filter((s) => s.name && s.kind)
      .map((s) => {
        const kind: CorridorStopDraft["kind"] =
          s.kind === "diesel" || s.kind === "fuel"
            ? "fuel"
            : s.kind === "repair"
              ? "repair"
              : "parking";
        return {
          kind,
          name: String(s.name),
          detail: String(s.detail || s.area || "").slice(0, 180),
          mile: Math.max(1, Math.round(Number(s.mile) || 0)),
          area: s.area ?? null,
        };
      })
      .filter((s) => s.mile > 0)
      .slice(0, 18);
    return {
      miles:
        raw.miles != null && Number.isFinite(Number(raw.miles))
          ? Math.round(Number(raw.miles))
          : null,
      hours:
        raw.hours != null && Number.isFinite(Number(raw.hours))
          ? Math.round(Number(raw.hours) * 10) / 10
          : null,
      stops,
      notes: Array.isArray(raw.notes)
        ? raw.notes.map(String).slice(0, 4)
        : [],
    };
  } catch {
    return { miles: null, hours: null, stops: [], notes: [] };
  }
}

/**
 * One OpenAI call for fuel / parking / repair along an entire A→B haul.
 * Uses the same key/model path as Find place discovery.
 */
export async function discoverCorridorStops(input: {
  origin: string;
  destination: string;
}): Promise<{
  miles: number | null;
  hours: number | null;
  stops: CorridorStopDraft[];
  notes: string[];
  provider: string;
}> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return {
      miles: null,
      hours: null,
      stops: [],
      notes: [
        "Add OPENAI_API_KEY to discover live fuel, parking, and repair along this haul.",
      ],
      provider: "fallback",
    };
  }

  const prompt = `You help truck / van drivers plan a haul.

Corridor: ${input.origin} → ${input.destination}

Find real, useful stops ALONG this route (not only at the endpoints):
- diesel / truck fuel stations
- truck / HGV / commercial parking or overnight holding
- truck / commercial repair / tyre workshops

Prefer places on or near the main road corridor between origin and delivery.
Estimate mile from origin for each stop (integer). Estimate total corridor miles and drive hours.

Respond with ONLY a JSON object:
{
  "miles": number,
  "hours": number,
  "notes": string[] (0-3 short corridor tips, local to this route — never invent US interstate tips for UK jobs),
  "stops": [
    { "kind": "fuel"|"parking"|"repair", "name": string, "detail": string, "mile": number, "area": string }
  ]
}
Return 8–15 stops mixed across kinds. Be cautious; if unsure say "call first" in detail.
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

    let text = "";
    let provider = "openai_responses";

    if (!res.ok) {
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
                "You help truck drivers find fuel, parking, and repair along a haul. Reply with one JSON object only.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!chat.ok) {
        return {
          miles: null,
          hours: null,
          stops: [],
          notes: ["Could not reach place discovery right now. Try Find near pickup or delivery."],
          provider: "fallback",
        };
      }
      const chatJson = (await chat.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      text = chatJson.choices?.[0]?.message?.content ?? "";
      provider = "openai_chat";
    } else {
      const json = (await res.json()) as {
        output_text?: string;
        output?: { content?: { text?: string }[] }[];
      };
      text =
        json.output_text ||
        json.output
          ?.flatMap((o) => o.content ?? [])
          .map((c) => c.text ?? "")
          .join("\n") ||
        "";
    }

    const parsed = parseCorridorJson(text);
    return {
      ...parsed,
      provider: parsed.stops.length ? provider : "fallback",
      notes:
        parsed.stops.length > 0
          ? parsed.notes
          : [
              "No corridor stops returned — try Find near pickup or delivery, or Plan route again.",
            ],
    };
  } catch {
    return {
      miles: null,
      hours: null,
      stops: [],
      notes: ["Place discovery failed. Use Find for parking, fuel, or repair."],
      provider: "fallback",
    };
  }
}
