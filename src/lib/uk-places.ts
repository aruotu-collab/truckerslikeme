/** Approximate UK / Ireland place centroids for schematic geo maps. */

export type LatLon = { lat: number; lon: number };

/** Mainland GB + NI + common Ireland freight towns. */
export const UK_PLACE_COORDS: Record<string, LatLon> = {
  // Scotland
  aberdeen: { lat: 57.15, lon: -2.11 },
  dundee: { lat: 56.46, lon: -2.97 },
  edinburgh: { lat: 55.95, lon: -3.19 },
  glasgow: { lat: 55.86, lon: -4.25 },
  inverness: { lat: 57.48, lon: -4.23 },
  perth: { lat: 56.4, lon: -3.43 },
  stirling: { lat: 56.12, lon: -3.94 },
  paisley: { lat: 55.85, lon: -4.43 },
  motherwell: { lat: 55.79, lon: -3.99 },
  livingston: { lat: 55.89, lon: -3.52 },
  kirkcaldy: { lat: 56.11, lon: -3.16 },
  "fort william": { lat: 56.82, lon: -5.11 },
  ayr: { lat: 55.46, lon: -4.63 },
  dumfries: { lat: 55.07, lon: -3.61 },

  // North England
  newcastle: { lat: 54.98, lon: -1.61 },
  "newcastle upon tyne": { lat: 54.98, lon: -1.61 },
  sunderland: { lat: 54.91, lon: -1.38 },
  durham: { lat: 54.78, lon: -1.57 },
  middlesbrough: { lat: 54.57, lon: -1.23 },
  darlington: { lat: 54.52, lon: -1.55 },
  carlisle: { lat: 54.9, lon: -2.93 },
  kendal: { lat: 54.33, lon: -2.75 },
  lancaster: { lat: 54.05, lon: -2.8 },
  preston: { lat: 53.76, lon: -2.7 },
  blackpool: { lat: 53.82, lon: -3.05 },
  burnley: { lat: 53.79, lon: -2.24 },
  blackburn: { lat: 53.75, lon: -2.48 },
  liverpool: { lat: 53.41, lon: -2.98 },
  birkenhead: { lat: 53.39, lon: -3.01 },
  warrington: { lat: 53.39, lon: -2.6 },
  manchester: { lat: 53.48, lon: -2.24 },
  salford: { lat: 53.49, lon: -2.29 },
  stockport: { lat: 53.41, lon: -2.16 },
  bolton: { lat: 53.58, lon: -2.43 },
  oldham: { lat: 53.54, lon: -2.12 },
  rochdale: { lat: 53.61, lon: -2.16 },
  wigan: { lat: 53.54, lon: -2.63 },
  chester: { lat: 53.19, lon: -2.89 },
  crewe: { lat: 53.1, lon: -2.44 },
  "stoke-on-trent": { lat: 53.0, lon: -2.18 },
  stoke: { lat: 53.0, lon: -2.18 },
  leeds: { lat: 53.8, lon: -1.55 },
  bradford: { lat: 53.8, lon: -1.75 },
  halifax: { lat: 53.72, lon: -1.86 },
  huddersfield: { lat: 53.65, lon: -1.78 },
  wakefield: { lat: 53.68, lon: -1.5 },
  york: { lat: 53.96, lon: -1.08 },
  harrogate: { lat: 53.99, lon: -1.54 },
  scarborough: { lat: 54.28, lon: -0.4 },
  hull: { lat: 53.74, lon: -0.33 },
  "kingston upon hull": { lat: 53.74, lon: -0.33 },
  doncaster: { lat: 53.52, lon: -1.13 },
  sheffield: { lat: 53.38, lon: -1.47 },
  rotherham: { lat: 53.43, lon: -1.36 },
  barnsley: { lat: 53.55, lon: -1.48 },
  grimsby: { lat: 53.57, lon: -0.08 },
  scunthorpe: { lat: 53.59, lon: -0.65 },

  // Midlands
  nottingham: { lat: 52.95, lon: -1.15 },
  derby: { lat: 52.92, lon: -1.48 },
  leicester: { lat: 52.64, lon: -1.13 },
  lincoln: { lat: 53.23, lon: -0.54 },
  peterborough: { lat: 52.57, lon: -0.24 },
  northampton: { lat: 52.24, lon: -0.9 },
  coventry: { lat: 52.41, lon: -1.51 },
  birmingham: { lat: 52.48, lon: -1.9 },
  wolverhampton: { lat: 52.59, lon: -2.13 },
  walsall: { lat: 52.59, lon: -1.98 },
  dudley: { lat: 52.51, lon: -2.08 },
  "west bromwich": { lat: 52.52, lon: -1.99 },
  solihull: { lat: 52.41, lon: -1.78 },
  "sutton coldfield": { lat: 52.56, lon: -1.82 },
  tamworth: { lat: 52.63, lon: -1.69 },
  nuneaton: { lat: 52.52, lon: -1.47 },
  rugby: { lat: 52.37, lon: -1.26 },
  warwick: { lat: 52.28, lon: -1.58 },
  leamington: { lat: 52.29, lon: -1.54 },
  "leamington spa": { lat: 52.29, lon: -1.54 },
  worcester: { lat: 52.19, lon: -2.22 },
  hereford: { lat: 52.06, lon: -2.72 },
  shrewsbury: { lat: 52.71, lon: -2.75 },
  telford: { lat: 52.68, lon: -2.45 },
  stafford: { lat: 52.81, lon: -2.12 },
  burton: { lat: 52.8, lon: -1.64 },
  "burton upon trent": { lat: 52.8, lon: -1.64 },
  mansfield: { lat: 53.14, lon: -1.2 },
  worksop: { lat: 53.3, lon: -1.12 },
  newark: { lat: 53.08, lon: -0.81 },
  grantham: { lat: 52.91, lon: -0.64 },
  kettering: { lat: 52.4, lon: -0.73 },
  corby: { lat: 52.49, lon: -0.7 },
  wellingborough: { lat: 52.3, lon: -0.69 },
  "milton keynes": { lat: 52.04, lon: -0.76 },
  bedford: { lat: 52.14, lon: -0.47 },
  luton: { lat: 51.88, lon: -0.42 },

  // East
  cambridge: { lat: 52.21, lon: 0.12 },
  norwich: { lat: 52.63, lon: 1.3 },
  ipswich: { lat: 52.06, lon: 1.16 },
  colchester: { lat: 51.89, lon: 0.9 },
  chelmsford: { lat: 51.74, lon: 0.47 },
  "southend-on-sea": { lat: 51.54, lon: 0.71 },
  southend: { lat: 51.54, lon: 0.71 },
  basildon: { lat: 51.57, lon: 0.49 },
  harlow: { lat: 51.77, lon: 0.1 },
  stevenage: { lat: 51.9, lon: -0.2 },
  watford: { lat: 51.66, lon: -0.4 },
  "st albans": { lat: 51.75, lon: -0.34 },
  "hemel hempstead": { lat: 51.75, lon: -0.47 },
  "king's lynn": { lat: 52.75, lon: 0.4 },
  "kings lynn": { lat: 52.75, lon: 0.4 },
  "great yarmouth": { lat: 52.61, lon: 1.73 },
  lowestoft: { lat: 52.48, lon: 1.75 },
  "bury st edmunds": { lat: 52.25, lon: 0.71 },
  bury: { lat: 53.59, lon: -2.3 },

  // London & surrounds
  london: { lat: 51.51, lon: -0.13 },
  croydon: { lat: 51.37, lon: -0.1 },
  bromley: { lat: 51.41, lon: 0.02 },
  orpington: { lat: 51.37, lon: 0.1 },
  dartford: { lat: 51.45, lon: 0.22 },
  gravesend: { lat: 51.44, lon: 0.37 },
  "sidcup": { lat: 51.43, lon: 0.1 },
  catford: { lat: 51.45, lon: -0.02 },
  lewisham: { lat: 51.46, lon: -0.01 },
  greenwich: { lat: 51.48, lon: 0.0 },
  woolwich: { lat: 51.49, lon: 0.07 },
  stratford: { lat: 51.54, lon: -0.0 },
  "stratford london": { lat: 51.54, lon: -0.0 },
  ilford: { lat: 51.56, lon: 0.07 },
  romford: { lat: 51.58, lon: 0.18 },
  barking: { lat: 51.54, lon: 0.08 },
  dagenham: { lat: 51.54, lon: 0.15 },
  enfield: { lat: 51.65, lon: -0.08 },
  barnet: { lat: 51.65, lon: -0.2 },
  wembley: { lat: 51.55, lon: -0.3 },
  ealing: { lat: 51.51, lon: -0.31 },
  heathrow: { lat: 51.47, lon: -0.45 },
  uxbridge: { lat: 51.55, lon: -0.48 },
  hounslow: { lat: 51.47, lon: -0.37 },
  kingston: { lat: 51.41, lon: -0.3 },
  "kingston upon thames": { lat: 51.41, lon: -0.3 },
  richmond: { lat: 51.46, lon: -0.3 },
  wimbledon: { lat: 51.42, lon: -0.21 },
  sutton: { lat: 51.36, lon: -0.19 },
  mitcham: { lat: 51.4, lon: -0.17 },
  tooting: { lat: 51.43, lon: -0.17 },
  brixton: { lat: 51.46, lon: -0.12 },
  camberwell: { lat: 51.47, lon: -0.09 },
  peckham: { lat: 51.47, lon: -0.07 },
  "elephant and castle": { lat: 51.49, lon: -0.1 },
  islington: { lat: 51.54, lon: -0.1 },
  hackney: { lat: 51.55, lon: -0.06 },
  "tottenham": { lat: 51.59, lon: -0.07 },
  "wood green": { lat: 51.6, lon: -0.11 },
  "southall": { lat: 51.51, lon: -0.38 },
  "slough": { lat: 51.51, lon: -0.59 },
  windsor: { lat: 51.48, lon: -0.61 },
  maidenhead: { lat: 51.52, lon: -0.72 },
  reading: { lat: 51.45, lon: -0.97 },
  bracknell: { lat: 51.42, lon: -0.75 },
  woking: { lat: 51.32, lon: -0.56 },
  guildford: { lat: 51.24, lon: -0.57 },
  reigate: { lat: 51.24, lon: -0.21 },
  redhill: { lat: 51.24, lon: -0.17 },
  crawley: { lat: 51.11, lon: -0.19 },
  "gatwick": { lat: 51.15, lon: -0.18 },
  horsham: { lat: 51.06, lon: -0.33 },
  "east grinstead": { lat: 51.13, lon: -0.01 },
  sevenoaks: { lat: 51.27, lon: 0.19 },
  tonbridge: { lat: 51.2, lon: 0.27 },
  tunbridge: { lat: 51.13, lon: 0.26 },
  "tunbridge wells": { lat: 51.13, lon: 0.26 },
  maidstone: { lat: 51.27, lon: 0.52 },
  ashford: { lat: 51.15, lon: 0.87 },
  canterbury: { lat: 51.28, lon: 1.08 },
  dover: { lat: 51.13, lon: 1.31 },
  folkestone: { lat: 51.08, lon: 1.17 },
  margate: { lat: 51.39, lon: 1.39 },
  rochester: { lat: 51.39, lon: 0.51 },
  chatham: { lat: 51.38, lon: 0.53 },
  gillingham: { lat: 51.39, lon: 0.55 },
  sittingbourne: { lat: 51.34, lon: 0.73 },

  // South / SW
  brighton: { lat: 50.82, lon: -0.14 },
  hove: { lat: 50.83, lon: -0.17 },
  worthing: { lat: 50.81, lon: -0.37 },
  "eastbourne": { lat: 50.77, lon: 0.28 },
  hastings: { lat: 50.86, lon: 0.58 },
  portsmouth: { lat: 50.8, lon: -1.09 },
  southampton: { lat: 50.91, lon: -1.4 },
  "winchester": { lat: 51.06, lon: -1.31 },
  basingstoke: { lat: 51.27, lon: -1.09 },
  andover: { lat: 51.21, lon: -1.48 },
  salisbury: { lat: 51.07, lon: -1.8 },
  bournemouth: { lat: 50.72, lon: -1.88 },
  poole: { lat: 50.72, lon: -1.98 },
  "weymouth": { lat: 50.61, lon: -2.46 },
  dorchester: { lat: 50.71, lon: -2.44 },
  "yeovil": { lat: 50.94, lon: -2.63 },
  taunton: { lat: 51.01, lon: -3.1 },
  bridgwater: { lat: 51.13, lon: -3.0 },
  bristol: { lat: 51.45, lon: -2.59 },
  bath: { lat: 51.38, lon: -2.36 },
  swindon: { lat: 51.56, lon: -1.78 },
  oxford: { lat: 51.75, lon: -1.26 },
  "banbury": { lat: 52.06, lon: -1.34 },
  gloucester: { lat: 51.86, lon: -2.24 },
  cheltenham: { lat: 51.9, lon: -2.08 },
  "stroud": { lat: 51.75, lon: -2.22 },
  "exeter": { lat: 50.72, lon: -3.53 },
  plymouth: { lat: 50.38, lon: -4.14 },
  torbay: { lat: 50.46, lon: -3.53 },
  torquay: { lat: 50.46, lon: -3.53 },
  "paignton": { lat: 50.44, lon: -3.57 },
  barnstaple: { lat: 51.08, lon: -4.06 },
  "truro": { lat: 50.26, lon: -5.05 },
  "newquay": { lat: 50.42, lon: -5.08 },
  "st austell": { lat: 50.34, lon: -4.79 },
  falmouth: { lat: 50.15, lon: -5.07 },
  penzance: { lat: 50.12, lon: -5.54 },

  // Wales
  cardiff: { lat: 51.48, lon: -3.18 },
  swansea: { lat: 51.62, lon: -3.94 },
  newport: { lat: 51.58, lon: -2.99 },
  "newport wales": { lat: 51.58, lon: -2.99 },
  wrexham: { lat: 53.05, lon: -2.99 },
  bangor: { lat: 53.23, lon: -4.13 },
  "aberystwyth": { lat: 52.42, lon: -4.08 },
  "bridgend": { lat: 51.51, lon: -3.58 },
  merthyr: { lat: 51.75, lon: -3.38 },
  "merthyr tydfil": { lat: 51.75, lon: -3.38 },
  "cwmbran": { lat: 51.65, lon: -3.02 },

  // NI / Ireland (common Shiply)
  belfast: { lat: 54.6, lon: -5.93 },
  derry: { lat: 54.99, lon: -7.31 },
  londonderry: { lat: 54.99, lon: -7.31 },
  dublin: { lat: 53.35, lon: -6.26 },
  cork: { lat: 51.9, lon: -8.47 },
  limerick: { lat: 52.66, lon: -8.63 },
  galway: { lat: 53.27, lon: -9.05 },
};

const ALIASES: Record<string, string> = {
  "newcastle-upon-tyne": "newcastle",
  "kingston-upon-hull": "hull",
  "stoke on trent": "stoke-on-trent",
  mk: "milton keynes",
  "m.k.": "milton keynes",
  "central london": "london",
  "greater london": "london",
  "east london": "london",
  "west london": "london",
  "north london": "london",
  "south london": "london",
  "city of london": "london",
};

export function normalizePlaceQuery(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  let s = raw
    .toLowerCase()
    .replace(/\buk\b|\bunited kingdom\b|\bengland\b|\bwales\b|\bscotland\b/gi, " ")
    .replace(/\b(near|area|region|county)\b/g, " ")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Drop trailing postcode-ish tokens (e.g. "Manchester M1 2AB")
  s = s.replace(/\b[a-z]{1,2}\d{1,2}[a-z]?\s*\d[a-z]{2}\b/gi, "").trim();
  s = s.replace(/\b[a-z]{1,2}\d{1,2}[a-z]?\b$/i, "").trim();
  return s;
}

export function resolveUkPlace(
  raw: string | null | undefined,
  overrides?: Record<string, LatLon>,
): LatLon | null {
  const q = normalizePlaceQuery(raw);
  if (!q) return null;

  if (overrides) {
    const ok = overrides[q] || overrides[placeToken(q)];
    if (ok) return ok;
  }

  const alias = ALIASES[q];
  if (alias && UK_PLACE_COORDS[alias]) return UK_PLACE_COORDS[alias]!;
  if (UK_PLACE_COORDS[q]) return UK_PLACE_COORDS[q]!;

  // First comma segment already normalized; try progressive prefixes
  const parts = q.split(/\s+/);
  for (let n = parts.length; n >= 1; n--) {
    const slice = parts.slice(0, n).join(" ");
    const a = ALIASES[slice];
    if (a && UK_PLACE_COORDS[a]) return UK_PLACE_COORDS[a]!;
    if (UK_PLACE_COORDS[slice]) return UK_PLACE_COORDS[slice]!;
  }

  // Word-boundary contains (prefer longer keys; skip tiny tokens)
  const keys = Object.keys(UK_PLACE_COORDS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (key.length < 4) continue;
    if (q === key) return UK_PLACE_COORDS[key]!;
    if (q.includes(key)) return UK_PLACE_COORDS[key]!;
  }

  return null;
}

function placeToken(q: string) {
  return q.split(",")[0]?.trim() || q;
}

/** UK-ish bounds used when zooming to full island. */
export const UK_BOUNDS = {
  minLat: 49.85,
  maxLat: 58.7,
  minLon: -8.2,
  maxLon: 1.85,
};

export function projectLatLon(
  lat: number,
  lon: number,
  bounds: typeof UK_BOUNDS,
  width: number,
  height: number,
  pad: number,
): { x: number; y: number } {
  const lonSpan = Math.max(bounds.maxLon - bounds.minLon, 0.15);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.15);
  // Keep roughly correct aspect (1° lat ≈ fixed; lon shrinks northward — ignore for schematic)
  const x = pad + ((lon - bounds.minLon) / lonSpan) * (width - pad * 2);
  const y = pad + ((bounds.maxLat - lat) / latSpan) * (height - pad * 2);
  return { x, y };
}

export function boundsAround(
  points: LatLon[],
  fallback = UK_BOUNDS,
): typeof UK_BOUNDS {
  if (!points.length) return fallback;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  // Pad so single-city clusters still have space
  const latPad = Math.max((maxLat - minLat) * 0.25, 0.35);
  const lonPad = Math.max((maxLon - minLon) * 0.25, 0.45);
  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLon: minLon - lonPad,
    maxLon: maxLon + lonPad,
  };
}
