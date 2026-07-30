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
  params.append("facets[product][]", "EPD2D");
  params.append("facets[process][]", "PTE");
  for (const series of SERIES) {
    params.append("facets[duoarea][]", series.duoarea);
  }
  params.set("sort[0][column]", "period");
  params.set("sort[0][direction]", "desc");
  params.set("offset", "0");
  params.set("length", "12");

  const url = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?${params.toString()}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  const body = await res.text();

  if (!res.ok) {
    throw new Error(`EIA v2 failed: ${res.status} ${body.slice(0, 200)}`);
  }

  const json = JSON.parse(body) as {
    response?: { data?: EiaRow[] };
    error?: string;
  };

  if (json.error) {
    throw new Error(`EIA v2 error: ${json.error}`);
  }

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

  const results = [...latestByArea.values()];
  if (results.length === 0) {
    throw new Error(
      `EIA v2 returned no rows (parsed ${rows.length} raw records)`,
    );
  }

  return results;
}
