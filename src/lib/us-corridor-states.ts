import type { LiveFeedItem } from "@/types";
import type { CorridorFocus } from "@/lib/intel/rank";

export type UsStateCode =
  | "AL" | "AR" | "AZ" | "CA" | "CO" | "CT" | "DE" | "FL" | "GA" | "IA"
  | "ID" | "IL" | "IN" | "KS" | "KY" | "LA" | "MA" | "MD" | "ME" | "MI"
  | "MN" | "MO" | "MS" | "MT" | "NC" | "ND" | "NE" | "NH" | "NJ" | "NM"
  | "NV" | "NY" | "OH" | "OK" | "OR" | "PA" | "RI" | "SC" | "SD" | "TN"
  | "TX" | "UT" | "VA" | "VT" | "WA" | "WI" | "WV" | "WY";

export const STATE_NAMES: Record<UsStateCode, string> = {
  AL: "Alabama", AR: "Arkansas", AZ: "Arizona", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida",
  GA: "Georgia", IA: "Iowa", ID: "Idaho", IL: "Illinois", IN: "Indiana",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", MA: "Massachusetts",
  MD: "Maryland", ME: "Maine", MI: "Michigan", MN: "Minnesota",
  MO: "Missouri", MS: "Mississippi", MT: "Montana", NC: "North Carolina",
  ND: "North Dakota", NE: "Nebraska", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NV: "Nevada", NY: "New York", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VA: "Virginia", VT: "Vermont", WA: "Washington", WI: "Wisconsin",
  WV: "West Virginia", WY: "Wyoming",
};

/** Approximate centroids on a 1000×620 US map viewBox (lower 48). */
export const STATE_MAP_POINTS: Partial<
  Record<UsStateCode, { x: number; y: number }>
> = {
  WA: { x: 120, y: 70 }, OR: { x: 110, y: 130 }, CA: { x: 90, y: 260 },
  NV: { x: 140, y: 220 }, ID: { x: 190, y: 130 }, UT: { x: 210, y: 230 },
  AZ: { x: 190, y: 330 }, MT: { x: 280, y: 90 }, WY: { x: 280, y: 180 },
  CO: { x: 300, y: 260 }, NM: { x: 280, y: 350 }, ND: { x: 400, y: 90 },
  SD: { x: 400, y: 160 }, NE: { x: 410, y: 220 }, KS: { x: 420, y: 280 },
  OK: { x: 430, y: 340 }, TX: { x: 400, y: 420 }, MN: { x: 490, y: 110 },
  IA: { x: 500, y: 200 }, MO: { x: 510, y: 280 }, AR: { x: 510, y: 360 },
  LA: { x: 520, y: 440 }, WI: { x: 560, y: 140 }, IL: { x: 560, y: 250 },
  MS: { x: 560, y: 390 }, MI: { x: 620, y: 150 }, IN: { x: 600, y: 240 },
  KY: { x: 620, y: 290 }, TN: { x: 620, y: 340 }, AL: { x: 610, y: 390 },
  OH: { x: 660, y: 230 }, WV: { x: 700, y: 270 }, GA: { x: 680, y: 390 },
  FL: { x: 720, y: 480 }, PA: { x: 740, y: 210 }, NY: { x: 780, y: 150 },
  VA: { x: 740, y: 290 }, NC: { x: 760, y: 340 }, SC: { x: 740, y: 380 },
  MD: { x: 780, y: 260 }, NJ: { x: 800, y: 230 }, CT: { x: 820, y: 180 },
  MA: { x: 840, y: 160 }, ME: { x: 860, y: 90 },
};

const CITY_TO_STATE: Record<string, UsStateCode> = {
  dallas: "TX", houston: "TX", austin: "TX", "fort worth": "TX",
  "san antonio": "TX", el: "TX", amarillo: "TX", lubbock: "TX",
  tulsa: "OK", "oklahoma city": "OK", ardmore: "OK", norman: "OK",
  joplin: "MO", springfield: "MO", "st. louis": "MO", "st louis": "MO",
  "kansas city": "MO",
  chicago: "IL", joliet: "IL",
  nashville: "TN", memphis: "TN", antioch: "TN",
  "little rock": "AR",
  atlanta: "GA",
  indianapolis: "IN",
  "kansas city, ks": "KS", wichita: "KS",
};

const STATE_TOKEN: Record<string, UsStateCode> = {
  tx: "TX", texas: "TX",
  ok: "OK", oklahoma: "OK",
  mo: "MO", missouri: "MO",
  il: "IL", illinois: "IL",
  tn: "TN", tennessee: "TN",
  ar: "AR", arkansas: "AR",
  ks: "KS", kansas: "KS",
  in: "IN", indiana: "IN",
  ga: "GA", georgia: "GA",
  oh: "OH", ohio: "OH",
  ky: "KY", kentucky: "KY",
  la: "LA", louisiana: "LA",
  ms: "MS", mississippi: "MS",
  al: "AL", alabama: "AL",
  pa: "PA", pennsylvania: "PA",
  ny: "NY", "new york": "NY",
  ca: "CA", california: "CA",
  fl: "FL", florida: "FL",
};

/** Known haul state sequences (origin→dest). */
const KNOWN_CORRIDORS: { match: (o: string, d: string) => boolean; states: UsStateCode[] }[] = [
  {
    match: (o, d) =>
      (o.includes("dallas") || o.includes("tx") || o.includes("texas")) &&
      (d.includes("chicago") || d.includes("joliet") || d.includes("il") || d.includes("illinois")),
    states: ["TX", "OK", "MO", "IL"],
  },
  {
    match: (o, d) =>
      (o.includes("dallas") || o.includes("tx")) &&
      (d.includes("nashville") || d.includes("tn") || d.includes("tennessee")),
    states: ["TX", "AR", "TN"],
  },
  {
    match: (o, d) =>
      (o.includes("houston") || o.includes("tx")) &&
      (d.includes("atlanta") || d.includes("ga")),
    states: ["TX", "LA", "MS", "AL", "GA"],
  },
  {
    match: (o, d) =>
      (o.includes("chicago") || o.includes("il")) &&
      (d.includes("dallas") || d.includes("tx")),
    states: ["IL", "MO", "OK", "TX"],
  },
];

function resolveState(place: string): UsStateCode | null {
  const raw = place.toLowerCase().trim();

  for (const [city, code] of Object.entries(CITY_TO_STATE)) {
    if (raw.includes(city)) return code;
  }

  // ", TX" / " TX" patterns
  const abbr = raw.match(/,\s*([a-z]{2})\s*$/);
  if (abbr?.[1] && STATE_TOKEN[abbr[1]]) return STATE_TOKEN[abbr[1]];

  for (const [token, code] of Object.entries(STATE_TOKEN)) {
    if (token.length === 2) {
      if (new RegExp(`(?:^|\\s|,)${token}(?:\\s|$|,)`).test(raw)) return code;
    } else if (raw.includes(token)) {
      return code;
    }
  }
  return null;
}

export function statesOnCorridor(
  origin: string,
  destination: string,
): UsStateCode[] {
  const o = origin.toLowerCase();
  const d = destination.toLowerCase();

  for (const route of KNOWN_CORRIDORS) {
    if (route.match(o, d)) return route.states;
  }

  const from = resolveState(origin);
  const to = resolveState(destination);
  const list: UsStateCode[] = [];
  if (from) list.push(from);
  if (to && to !== from) list.push(to);
  return list;
}

export function itemMatchesState(item: LiveFeedItem, state: UsStateCode) {
  const hay = `${item.message} ${item.location}`.toLowerCase();
  const name = STATE_NAMES[state].toLowerCase();
  const abbr = state.toLowerCase();
  if (hay.includes(name)) return true;
  if (new RegExp(`(?:^|[^a-z])${abbr}(?:[^a-z]|$)`).test(hay)) return true;

  // City hints from STATE_HINTS-ish
  for (const [city, code] of Object.entries(CITY_TO_STATE)) {
    if (code === state && hay.includes(city)) return true;
  }
  return false;
}

export function countIntelByState(
  items: LiveFeedItem[],
  states: UsStateCode[],
): Record<UsStateCode, number> {
  const counts = {} as Record<UsStateCode, number>;
  for (const state of states) counts[state] = 0;
  for (const item of items) {
    for (const state of states) {
      if (itemMatchesState(item, state)) counts[state] += 1;
    }
  }
  return counts;
}

export function corridorStateSummary(corridor: CorridorFocus | null) {
  if (!corridor) return [] as UsStateCode[];
  return statesOnCorridor(corridor.origin, corridor.destination);
}
