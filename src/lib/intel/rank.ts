import type { LiveFeedItem } from "@/types";

export type RankedFeedItem = LiveFeedItem & {
  score: number;
  severity: "critical" | "watch" | "info";
  action: string;
  onCorridor: boolean;
};

export type CorridorFocus = {
  origin: string;
  destination: string;
  labels: string[];
};

const STATE_HINTS: Record<string, string[]> = {
  tx: ["tx", "texas", "dallas", "houston", "fort worth", "lubbock", "amarillo", "el paso", "san angelo", "midland"],
  ok: ["ok", "oklahoma", "tulsa", "ardmore", "norman", "oklahoma city"],
  mo: ["mo", "missouri", "joplin", "springfield", "st. louis", "st louis", "kansas city"],
  il: ["il", "illinois", "chicago", "joliet", "springfield, il"],
  ks: ["ks", "kansas", "wichita", "topeka", "dodge city"],
  ar: ["ar", "arkansas", "little rock"],
  tn: ["tn", "tennessee", "nashville", "antioch", "memphis"],
};

function tokenizeCorridor(origin: string, destination: string): string[] {
  const raw = `${origin} ${destination}`.toLowerCase();
  const labels = new Set<string>();

  for (const [state, hints] of Object.entries(STATE_HINTS)) {
    if (hints.some((h) => raw.includes(h))) {
      labels.add(state);
      hints.forEach((h) => labels.add(h));
    }
  }

  // Interstates common on Dallas–Chicago style hauls
  if (raw.includes("dallas") || raw.includes("chicago") || raw.includes("tx") || raw.includes("il")) {
    ["i-35", "i-44", "i-55", "i-40", "i-80", "midwest", "gulf"].forEach((h) =>
      labels.add(h),
    );
  }

  origin
    .split(/[,\s]+/)
    .concat(destination.split(/[,\s]+/))
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 2)
    .forEach((p) => labels.add(p));

  return [...labels];
}

export function corridorFromSearch(
  origin: string,
  destination: string,
): CorridorFocus {
  return {
    origin: origin.trim(),
    destination: destination.trim(),
    labels: tokenizeCorridor(origin, destination),
  };
}

export function itemOnCorridor(item: LiveFeedItem, corridor: CorridorFocus | null) {
  if (!corridor?.labels.length) return true;
  const hay = `${item.message} ${item.location}`.toLowerCase();
  return corridor.labels.some((label) => hay.includes(label));
}

export function actionForItem(item: LiveFeedItem): string {
  const text = `${item.message} ${item.location}`.toLowerCase();

  if (/extreme heat|heat warning/.test(text)) {
    return "Pre-cool the sleeper · check coolant · avoid mid-day idle if you can";
  }
  if (/heat advisory/.test(text)) {
    return "Hydrate early · watch tire pressure in the heat";
  }
  if (/flood/.test(text)) {
    return "Reroute around low water · don’t cross flooded shoulders";
  }
  if (/wind|gust/.test(text)) {
    return "Drop 5–10 mph empty · secure tarp/straps";
  }
  if (/parking|lot|spaces/.test(text)) {
    return "Plan overnight by 3–4 PM · reserve if the app allows";
  }
  if (/detention|intermodal|warehouse|wait/.test(text)) {
    return "Confirm detention pay before you accept · photo the gate time";
  }
  if (item.kind === "weigh" || /weigh|scale/.test(text)) {
    return "Check axle weights before the open scale";
  }
  if (item.kind === "repair" || /tire care|truck service|repair|shop/.test(text)) {
    return "Call ahead for bay time · photo the failure before you roll in";
  }
  if (/diesel|fuel|eia|\$/.test(text) || item.kind === "fuel") {
    return "Fuel on the cheaper PADD when HOS allows";
  }
  if (/traffic|congestion|i-80|backup/.test(text)) {
    return "Pad ETA · avoid peak freight windows if you can";
  }
  if (item.source === "drivers") {
    return "Driver report — verify as you approach";
  }
  return "Factor this into today’s HOS plan";
}

function severityFor(item: LiveFeedItem): RankedFeedItem["severity"] {
  const text = `${item.message} ${item.location}`.toLowerCase();
  if (/extreme heat|tornado|blizzard|flood warning|closed for rebuild/.test(text)) {
    return "critical";
  }
  if (
    /heat advisory|flood advisory|wind|parking|detention|traffic|congestion|weigh/.test(
      text,
    ) ||
    item.kind === "delay" ||
    item.kind === "traffic"
  ) {
    return "watch";
  }
  return "info";
}

function baseScore(item: LiveFeedItem): number {
  const text = `${item.message} ${item.location}`.toLowerCase();
  let score = 20;

  if (/extreme heat|tornado|blizzard|flood warning/.test(text)) score += 100;
  else if (/heat advisory|flood advisory|high wind|winter/.test(text)) score += 70;
  else if (item.kind === "delay" || item.kind === "traffic") score += 55;
  else if (item.kind === "parking") score += 48;
  else if (item.kind === "weigh") score += 46;
  else if (item.kind === "fuel" || item.source === "eia") score += 42;
  else if (item.kind === "weather") score += 40;
  else if (item.kind === "repair") score += 38;
  else score += 25;

  if (item.source === "drivers") score += 12;
  if (item.source === "nws") score += 10;
  if (item.source === "eia") score += 8;

  // Fresher = stickier
  score += Math.max(0, 30 - Math.min(item.minutesAgo, 30));

  return score;
}

export function rankFeed(
  items: LiveFeedItem[],
  corridor: CorridorFocus | null,
  corridorOnly: boolean,
): RankedFeedItem[] {
  const ranked = items.map((item) => {
    const onCorridor = itemOnCorridor(item, corridor);
    let score = baseScore(item);
    if (corridor && onCorridor) score += 35;
    if (corridor && !onCorridor) score -= 15;

    return {
      ...item,
      score,
      severity: severityFor(item),
      action: actionForItem(item),
      onCorridor,
    };
  });

  const filtered = corridorOnly && corridor
    ? ranked.filter((item) => item.onCorridor)
    : ranked;

  return filtered.sort((a, b) => b.score - a.score || a.minutesAgo - b.minutesAgo);
}
