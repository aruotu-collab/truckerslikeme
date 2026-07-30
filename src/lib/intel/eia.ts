export type FuelSnapshotInput = {
  region: string;
  regionCode: string;
  priceUsd: number;
  period: string;
  source: string;
};

const SERIES: { regionCode: string; region: string; duoarea: string }[] = [
  { regionCode: "US", region: "U.S. average", duoarea: "NUS" },
  { regionCode: "MW", region: "Midwest (PADD 2)", duoarea: "R20" },
  { regionCode: "GC", region: "Gulf Coast (PADD 3)", duoarea: "R30" },
];

type EiaRow = {
  period?: string;
  duoarea?: string;
  "area-name"?: string;
  value?: number | string;
};

export async function fetchEiaDieselSnapshots(): Promise<FuelSnapshotInput[]> {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    return [];
  }

  const params = new URLSearchParams();
  params.set("api_key", apiKey);
  params.set("frequency", "weekly");
  params.set("data[0]", "value");
  params.set("facets[product][]", "EPD2D");
  for (const series of SERIES) {
    params.append("facets[duoarea][]", series.duoarea);
  }
  params.set("sort[0][column]", "period");
  params.set("sort[0][direction]", "desc");
  params.set("length", "12");

  const url = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?${params.toString()}`;
  const res = await fetch(url, { next: { revalidate: 0 } });

  if (!res.ok) {
    throw new Error(`EIA request failed: ${res.status}`);
  }

  const json = (await res.json()) as { response?: { data?: EiaRow[] } };
  const rows = json.response?.data ?? [];
  const latestByArea = new Map<string, FuelSnapshotInput>();

  for (const row of rows) {
    const duoarea = row.duoarea;
    const period = row.period;
    const value = Number(row.value);
    if (!duoarea || !period || !Number.isFinite(value)) continue;

    const meta = SERIES.find((s) => s.duoarea === duoarea);
    if (!meta) continue;
    if (latestByArea.has(meta.regionCode)) continue;

    latestByArea.set(meta.regionCode, {
      region: meta.region,
      regionCode: meta.regionCode,
      priceUsd: value,
      period,
      source: "eia",
    });
  }

  return [...latestByArea.values()];
}
