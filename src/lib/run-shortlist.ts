import type { RunJob, JobVerdict } from "@/lib/run-builder";

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

export type VisibleShiplyJob = RunJob & {
  href?: string | null;
  selected?: boolean;
};

/** Shared vision/text extract used by screenshot shortlist and Shiply connect scan. */
export async function extractJobsFromShiplyCapture(input: {
  images: string[];
  pageText?: string;
  pageUrl?: string;
  start?: string;
  mode?: string;
  home?: string;
  destination?: string;
  vehicle?: string;
  /** When true, still return OPEN/MAYBE/SKIP coaching but list is for driver pick. */
  forSelection?: boolean;
  /**
   * When true (Map Jobs), extract every row from the results list — do not shortlist.
   * Build My Run keeps the default shortlist behaviour.
   */
  completeList?: boolean;
}): Promise<{ jobs: VisibleShiplyJob[]; coach: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const goal =
    input.mode === "home"
      ? `Driver wants to progress toward home: ${input.home || "home base"}.`
      : input.mode === "destination"
        ? `Driver is heading toward: ${input.destination || "a known destination"}.`
        : "Driver wants maximum profit from here — finish location flexible.";

  const textBudget = input.completeList ? 22_000 : 12_000;
  const listRules = input.completeList
    ? `- CRITICAL: Extract EVERY distinct job/shipment row in the page text and screenshot — aim for completeness (dozens if present). Do NOT shortlist to a handful.
- Include weak/low-pay rows too; score them with verdict skip/maybe as needed.
- Prefer page text over the screenshot when the list is long (screenshot is only the viewport).
- coach: brief note of how many rows you found vs any that looked truncated`
    : `- Prefer 3–8 open/high unless the list is excellent
- coach: one short paragraph on which jobs are worth selecting
${input.forSelection ? "- Driver will tick jobs to auto-open — still score each row." : ""}`;

  const prompt = `You are helping a UK/EU van or truck driver read Shiply (or similar) SEARCH RESULTS.

Driver start: ${input.start || "unknown"}
Vehicle: ${input.vehicle || "Luton van"}
Goal: ${goal}
${input.pageUrl ? `Page URL: ${input.pageUrl}` : ""}
${input.pageText ? `Visible page text (may be truncated):\n${input.pageText.slice(0, textBudget)}` : ""}

From the screenshot(s) / text of a job RESULTS LIST, extract ${input.completeList ? "every" : "the relevant"} job row${input.completeList ? "" : "s for shortlisting"}.

Return ONLY JSON:
{
  "jobs": [
    {
      "origin": string|null,
      "destination": string|null,
      "miles": number|null,
      "rateTotal": number|null,
      "item": string|null,
      "href": string|null,
      "verdict": "high"|"open"|"maybe"|"skip",
      "reason": string
    }
  ],
  "coach": string
}

Rules:
- href: absolute or site-relative job detail link if visible; else null
- rateTotal: customer budget or visible pay/offer only. NEVER use "TP's Quoting" / quote counts as money.
- miles: trip distance if shown
${listRules}`;

  const content: {
    type: string;
    text?: string;
    image_url?: { url: string };
  }[] = [{ type: "text", text: prompt }];

  const maxImages = input.completeList ? 10 : 4;
  for (const raw of input.images.slice(0, maxImages)) {
    const img = normalizeImage(raw);
    if (img.base64.length > 5_500_000) {
      throw new Error("Screenshot too large.");
    }
    content.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
    });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: input.completeList ? 8_000 : 2_500,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Could not read that results list. ${errText.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(stripJsonFence(text)) as {
    jobs?: Array<{
      origin?: string | null;
      destination?: string | null;
      miles?: number | null;
      rateTotal?: number | null;
      item?: string | null;
      href?: string | null;
      verdict?: string;
      reason?: string;
    }>;
    coach?: string;
  };

  const jobs: VisibleShiplyJob[] = (parsed.jobs ?? []).map((j, i) => ({
    id: `shiply-${i}-${(j.origin || "x").slice(0, 12)}`,
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
    href: j.href ?? null,
    verdict: (["high", "open", "maybe", "skip"].includes(j.verdict || "")
      ? j.verdict
      : "maybe") as JobVerdict,
    reason: j.reason || "",
  }));

  return {
    jobs,
    coach:
      parsed.coach ||
      "Tick the jobs worth analysing, then continue.",
  };
}
