export type FuelSnapshotInput = {
  region: string;
  regionCode: string;
  priceUsd: number;
  period: string;
  source: string;
};

const SERIES: {
  regionCode: string;
  region: string;
  seriesId: string;
}[] = [
  {
    regionCode: "US",
    region: "U.S. average",
    seriesId: "PET.EMD_EPD2D_PTE_NUS_DPG.W",
  },
  {
    regionCode: "MW",
    region: "Midwest (PADD 2)",
    seriesId: "PET.EMD_EPD2D_PTE_R20_DPG.W",
  },
  {
    regionCode: "GC",
    region: "Gulf Coast (PADD 3)",
    seriesId: "PET.EMD_EPD2D_PTE_R30_DPG.W",
  },
];

type ClassicSeriesResponse = {
  series?: Array<{
    series_id?: string;
    data?: Array<[string, number | string | null]>;
  }>;
  data?: {
    error?: string;
  };
};

export async function fetchEiaDieselSnapshots(): Promise<FuelSnapshotInput[]> {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    return [];
  }

  const ids = SERIES.map((s) => s.seriesId).join(";");
  const url = `https://api.eia.gov/series/?api_key=${encodeURIComponent(apiKey)}&series_id=${encodeURIComponent(ids)}`;
  const res = await fetch(url, { next: { revalidate: 0 } });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`EIA request failed: ${res.status} ${body.slice(0, 180)}`);
  }

  const json = (await res.json()) as ClassicSeriesResponse;
  if (json.data?.error) {
    throw new Error(`EIA error: ${json.data.error}`);
  }

  const results: FuelSnapshotInput[] = [];

  for (const series of SERIES) {
    const block = json.series?.find((s) => s.series_id === series.seriesId);
    const point = block?.data?.[0];
    if (!point) continue;
    const period = String(point[0]);
    const value = Number(point[1]);
    if (!period || !Number.isFinite(value)) continue;

    results.push({
      region: series.region,
      regionCode: series.regionCode,
      priceUsd: value,
      period,
      source: "eia",
    });
  }

  if (results.length === 0) {
    throw new Error("EIA returned no diesel series rows");
  }

  return results;
}
