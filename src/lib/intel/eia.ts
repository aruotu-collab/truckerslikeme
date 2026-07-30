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

type EiaSeriesResponse = {
  response?: {
    data?: Array<{
      period?: string;
      value?: number | string;
    }>;
  };
  error?: string;
};

async function fetchSeries(
  apiKey: string,
  seriesId: string,
): Promise<{ period: string; value: number } | null> {
  const url = `https://api.eia.gov/v2/seriesid/${encodeURIComponent(seriesId)}?api_key=${encodeURIComponent(apiKey)}&length=1`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`EIA series ${seriesId} failed: ${res.status}`);
  }

  const json = (await res.json()) as EiaSeriesResponse;
  if (json.error) {
    throw new Error(`EIA series ${seriesId}: ${json.error}`);
  }

  const row = json.response?.data?.[0];
  const value = Number(row?.value);
  const period = row?.period;
  if (!period || !Number.isFinite(value)) return null;
  return { period, value };
}

export async function fetchEiaDieselSnapshots(): Promise<FuelSnapshotInput[]> {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    return [];
  }

  const results: FuelSnapshotInput[] = [];

  for (const series of SERIES) {
    const latest = await fetchSeries(apiKey, series.seriesId);
    if (!latest) continue;
    results.push({
      region: series.region,
      regionCode: series.regionCode,
      priceUsd: latest.value,
      period: latest.period,
      source: "eia",
    });
  }

  return results;
}
