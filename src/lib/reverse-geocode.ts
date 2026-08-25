type NominatimAddress = {
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  borough?: string;
  quarter?: string;
  hamlet?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  state?: string;
  country?: string;
  country_code?: string;
};

const TOO_BROAD = new Set(
  [
    "greater london",
    "london borough of",
    "england",
    "united kingdom",
    "uk",
    "great britain",
  ].map((s) => s.toLowerCase()),
);

function isBroad(value: string | undefined) {
  if (!value) return true;
  const v = value.trim().toLowerCase();
  if (TOO_BROAD.has(v)) return true;
  if (v.startsWith("london borough of ")) return true;
  return false;
}

function firstSpecific(
  address: NominatimAddress | undefined,
  keys: (keyof NominatimAddress)[],
) {
  if (!address) return null;
  for (const key of keys) {
    const raw = address[key]?.trim();
    if (!raw || isBroad(raw)) continue;
    // Strip "London Borough of Lewisham" → keep only if useful; prefer suburb
    if (/^london borough of /i.test(raw)) continue;
    return raw;
  }
  return null;
}

/**
 * Build a driver-friendly place label from Nominatim reverse geocode.
 * Prefers neighbourhood/suburb (e.g. Catford) over region (Greater London).
 */
export function formatPlaceFromNominatim(input: {
  address?: NominatimAddress;
  display_name?: string;
  lat: number;
  lon: number;
}): string {
  const a = input.address;

  const locality = firstSpecific(a, [
    "neighbourhood",
    "suburb",
    "quarter",
    "hamlet",
    "village",
    "city_district",
    "borough",
    "town",
  ]);

  const city = firstSpecific(a, ["city", "municipality", "town"]);

  // Pull a finer label from display_name when address fields are too coarse
  let fromDisplay: string | null = null;
  if (input.display_name) {
    const parts = input.display_name
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p && !isBroad(p) && !/^london borough of /i.test(p));
    // Skip house numbers / bare road-only if a later part looks like a place
    const placeLike = parts.find(
      (p, i) =>
        i > 0 &&
        !/^\d/.test(p) &&
        p.length > 2 &&
        p.toLowerCase() !== city?.toLowerCase(),
    );
    fromDisplay = placeLike || (parts[0] && parts[0].length > 2 ? parts[0] : null);
  }

  const local = locality || fromDisplay;

  // If locality is Catford and city is London → "Catford, London"
  if (local && city && local.toLowerCase() !== city.toLowerCase()) {
    return `${local}, ${city}`;
  }
  if (local) {
    const country =
      a?.country_code?.toUpperCase() === "GB"
        ? "UK"
        : firstSpecific(a, ["country"]) || null;
    return country ? `${local}, ${country}` : local;
  }
  if (city) {
    const country =
      a?.country_code?.toUpperCase() === "GB"
        ? "UK"
        : firstSpecific(a, ["country"]) || null;
    return country && city.toLowerCase() !== country.toLowerCase()
      ? `${city}, ${country}`
      : city;
  }

  if (fromDisplay) return fromDisplay;

  return `${input.lat.toFixed(4)}, ${input.lon.toFixed(4)}`;
}

export type GeocodedPlace = {
  label: string;
  countryCode: string | null;
};

export async function reverseGeocodePlace(
  latitude: number,
  longitude: number,
): Promise<GeocodedPlace> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      // Nominatim usage policy asks for a valid User-Agent identifying the app
      "User-Agent": "TruckersLikeMe/1.0 (https://truckerslikeme.com)",
    },
  });

  if (!res.ok) {
    throw new Error(`Geocode failed (${res.status})`);
  }

  const data = (await res.json()) as {
    address?: NominatimAddress;
    display_name?: string;
  };

  const countryCode = data.address?.country_code?.toUpperCase() || null;

  return {
    label: formatPlaceFromNominatim({
      address: data.address,
      display_name: data.display_name,
      lat: latitude,
      lon: longitude,
    }),
    countryCode,
  };
}

export async function reverseGeocodeLabel(
  latitude: number,
  longitude: number,
): Promise<string> {
  const place = await reverseGeocodePlace(latitude, longitude);
  return place.label;
}
