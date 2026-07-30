import { createAdminClient } from "@/lib/supabase/admin";
import { fetchEiaDieselSnapshots } from "@/lib/intel/eia";
import { fetchNwsCorridorAlerts } from "@/lib/intel/nws";

export type RefreshResult = {
  nwsUpserted: number;
  fuelUpserted: number;
  fuelAlerts: number;
  errors: string[];
  fetchedAt: string;
};

export async function refreshLiveIntel(): Promise<RefreshResult> {
  const errors: string[] = [];
  const fetchedAt = new Date().toISOString();
  const admin = createAdminClient();

  if (!admin) {
    return {
      nwsUpserted: 0,
      fuelUpserted: 0,
      fuelAlerts: 0,
      errors: [
        "SUPABASE_SERVICE_ROLE_KEY missing — add it in Vercel env to store live intel.",
      ],
      fetchedAt,
    };
  }

  let nwsUpserted = 0;
  let fuelUpserted = 0;
  let fuelAlerts = 0;

  try {
    const nws = await fetchNwsCorridorAlerts();
    if (nws.length > 0) {
      const rows = nws.map((alert) => ({
        external_id: alert.externalId,
        kind: alert.kind,
        message: alert.message,
        location: alert.location,
        source: "nws",
        severity: alert.severity,
        starts_at: alert.startsAt,
        ends_at: alert.endsAt,
        updated_at: fetchedAt,
      }));

      const { error, count } = await admin
        .from("system_alerts")
        .upsert(rows, { onConflict: "external_id", count: "exact" });

      if (error) errors.push(`NWS upsert: ${error.message}`);
      else nwsUpserted = count ?? rows.length;
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "NWS fetch failed");
  }

  try {
    const fuels = await fetchEiaDieselSnapshots();
    if (fuels.length > 0) {
      const rows = fuels.map((fuel) => ({
        region: fuel.region,
        region_code: fuel.regionCode,
        price_usd: fuel.priceUsd,
        period: fuel.period,
        source: fuel.source,
        fetched_at: fetchedAt,
      }));

      const { error } = await admin.from("fuel_snapshots").upsert(rows, {
        onConflict: "region_code,period",
      });

      if (error) {
        errors.push(`EIA upsert: ${error.message}`);
      } else {
        fuelUpserted = rows.length;

        const mw = fuels.find((f) => f.regionCode === "MW");
        const us = fuels.find((f) => f.regionCode === "US");
        const gc = fuels.find((f) => f.regionCode === "GC");
        const headline = mw ?? us;

        if (headline) {
          const msg = [
            `On-highway diesel: ${headline.region} $${headline.priceUsd.toFixed(3)}/gal`,
            us && mw && us !== mw
              ? `(U.S. avg $${us.priceUsd.toFixed(3)})`
              : null,
            gc ? `· Gulf Coast $${gc.priceUsd.toFixed(3)}` : null,
            `· EIA week ${headline.period}`,
          ]
            .filter(Boolean)
            .join(" ");

          const { error: alertError } = await admin.from("system_alerts").upsert(
            {
              external_id: `eia-diesel-${headline.period}`,
              kind: "fuel",
              message: msg,
              location: "EIA on-highway diesel",
              source: "eia",
              severity: "info",
              updated_at: fetchedAt,
            },
            { onConflict: "external_id" },
          );

          if (alertError) errors.push(`Fuel alert: ${alertError.message}`);
          else fuelAlerts = 1;
        }
      }
    } else if (!process.env.EIA_API_KEY) {
      errors.push("EIA_API_KEY not set — diesel auto-update skipped.");
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "EIA fetch failed");
  }

  return {
    nwsUpserted,
    fuelUpserted,
    fuelAlerts,
    errors,
    fetchedAt,
  };
}
