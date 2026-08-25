import { NextResponse } from "next/server";
import { analyzeProfit } from "@/lib/profit";
import { parseLoadText } from "@/lib/load-parse";
import { defaultOperatingAssumptions } from "@/lib/plan";
import { operatingDefaultsForMarket } from "@/lib/market-defaults";
import { marketFromCountryCode } from "@/lib/market";
import {
  dbWriter,
  ensureAnalysesQuota,
  getProfileBilling,
  getSignedInUser,
  incrementAnalysesUsed,
  userHasProAccess,
} from "@/lib/billing-profile";

export const dynamic = "force-dynamic";

const GUEST_LIMIT_MSG =
  "Sign in for free load analyses every month — or upgrade to Pro for unlimited.";

type Body = {
  text?: string;
  miles?: number;
  rateTotal?: number;
  dieselPrice?: number;
  mpg?: number;
  economy?: number;
  costPerMile?: number;
  tolls?: number;
  origin?: string;
  destination?: string;
  countryCode?: string;
  fuelUnit?: "gallon" | "litre";
  economyUnit?: "mpg" | "l_per_100km";
  distanceUnit?: "mi" | "km";
  /** Preview only — guests can score without saving */
  preview?: boolean;
  currentLocation?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const legacy = defaultOperatingAssumptions();
  const marketDefaults = operatingDefaultsForMarket(
    marketFromCountryCode(body.countryCode),
  );
  const parsed = body.text?.trim() ? parseLoadText(body.text) : null;

  const miles = Number(body.miles ?? parsed?.miles ?? 0);
  let rateTotal = Number(body.rateTotal ?? parsed?.rateTotal ?? 0);
  if ((!rateTotal || rateTotal <= 0) && parsed?.ratePerMile && miles > 0) {
    rateTotal = parsed.ratePerMile * miles;
  }

  if (!Number.isFinite(miles) || miles < 1) {
    return NextResponse.json(
      {
        error:
          "Need trip miles (at least 1). Paste a job, upload a screenshot, or enter miles.",
        parse: parsed,
      },
      { status: 400 },
    );
  }
  if (!Number.isFinite(rateTotal) || rateTotal <= 0) {
    return NextResponse.json(
      {
        error: "Need total rate. Paste a rate conf or enter the pay amount.",
        parse: parsed,
      },
      { status: 400 },
    );
  }

  const distanceUnit = body.distanceUnit ?? marketDefaults.distanceUnit;
  const fuelUnit = body.fuelUnit ?? marketDefaults.fuelUnit;
  const economyUnit = body.economyUnit ?? marketDefaults.economyUnit;
  const dieselPrice = Number(
    body.dieselPrice ?? marketDefaults.dieselPrice ?? legacy.dieselPrice,
  );
  const economy = Number(
    body.economy ?? body.mpg ?? marketDefaults.economy ?? legacy.mpg,
  );
  let costPerMile = Number(
    body.costPerMile ?? marketDefaults.costPerMile ?? legacy.costPerMile,
  );
  // When UI labels €/km, convert to per-mile for the engine
  if (
    distanceUnit === "km" &&
    body.costPerMile != null &&
    marketDefaults.costPerKm != null
  ) {
    costPerMile = Number(body.costPerMile) / 1.60934;
  } else if (
    distanceUnit === "km" &&
    body.costPerMile == null &&
    marketDefaults.costPerKm != null
  ) {
    costPerMile = marketDefaults.costPerKm / 1.60934;
  }
  const tolls = Number(body.tolls ?? 0);

  const origin = body.origin?.trim() || parsed?.origin || null;
  const destination =
    body.destination?.trim() || parsed?.destination || null;

  const profitInput = {
    miles,
    rateTotal,
    dieselPrice,
    economy,
    costPerMile,
    tolls,
    fuelUnit,
    economyUnit,
    distanceUnit,
  } as const;

  // Guest / client preview — no auth, no quota, no persist
  if (body.preview) {
    const result = analyzeProfit(profitInput);
    return NextResponse.json({
      result,
      parse: parsed,
      corridor: { origin, destination },
      assumptions: {
        dieselPrice,
        mpg: economy,
        economy,
        costPerMile,
        tolls,
        fuelUnit,
        economyUnit,
        distanceUnit,
      },
      preview: true,
      quota: null,
    });
  }

  const { supabase, user } = await getSignedInUser();
  if (!user) {
    return NextResponse.json(
      {
        error: GUEST_LIMIT_MSG,
        requiresAuth: true,
        parse: parsed,
      },
      { status: 401 },
    );
  }

  const writer = dbWriter(supabase);
  let profile = await getProfileBilling(user.id, supabase);
  if (!profile) {
    profile = {
      id: user.id,
      plan: "free",
      role: "driver",
      mpg: legacy.mpg,
      cost_per_mile: legacy.costPerMile,
      diesel_price_override: null,
      analyses_used: 0,
      analyses_reset_at: null,
      stripe_customer_id: null,
      email: user.email ?? null,
    };
  }

  const quota = await ensureAnalysesQuota(profile, writer);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error:
          "Free limit reached (2 load analyses this month). Upgrade to Pro for unlimited analyzes.",
        requiresPro: true,
        quota: {
          used: quota.used,
          limit: quota.limit,
          remaining: 0,
        },
      },
      { status: 402 },
    );
  }

  const finalDiesel = Number(
    body.dieselPrice ??
      profile.diesel_price_override ??
      marketDefaults.dieselPrice,
  );
  const finalEconomy = Number(
    body.economy ?? body.mpg ?? profile.mpg ?? marketDefaults.economy,
  );
  const finalCpm = Number(
    body.costPerMile ?? profile.cost_per_mile ?? marketDefaults.costPerMile,
  );

  const result = analyzeProfit({
    miles,
    rateTotal,
    dieselPrice: finalDiesel,
    economy: finalEconomy,
    costPerMile:
      distanceUnit === "km" && body.costPerMile != null
        ? finalCpm / 1.60934
        : finalCpm,
    tolls,
    fuelUnit,
    economyUnit,
    distanceUnit,
  });

  if (writer) {
    await writer.from("load_analyses").insert({
      user_id: user.id,
      origin,
      destination,
      miles: result.miles,
      rate_total: result.rateTotal,
      rate_per_mile: result.ratePerMile,
      diesel_price: finalDiesel,
      mpg: finalEconomy,
      cost_per_mile: finalCpm,
      fuel_cost: result.fuelCost,
      operating_cost: result.operatingCost,
      net_profit: result.netProfit,
      net_per_mile: result.netPerMile,
      score: result.score,
      raw_input: body.text?.slice(0, 8000) ?? null,
      payload: {
        afterFuelPerMile: result.afterFuelPerMile,
        netPerHour: result.netPerHour,
        hoursEstimate: result.hoursEstimate,
        tolls: result.tolls,
        notes: parsed?.notes ?? [],
      },
    });

    // Persist last-used assumptions on the driver profile
    await writer
      .from("profiles")
      .update({
        mpg: finalEconomy,
        cost_per_mile: finalCpm,
        diesel_price_override: finalDiesel,
      })
      .eq("id", user.id);

    if (!quota.pro && !userHasProAccess(profile, user.email)) {
      await incrementAnalysesUsed(user.id, quota.used, writer);
    }
  }

  const usedAfter =
    quota.pro || userHasProAccess(profile, user.email)
      ? quota.used
      : quota.used + 1;
  const remaining = quota.pro
    ? null
    : Math.max(0, (quota.limit ?? 0) - usedAfter);

  return NextResponse.json({
    result,
    parse: parsed,
    corridor: { origin, destination },
    assumptions: {
      dieselPrice: finalDiesel,
      mpg: finalEconomy,
      economy: finalEconomy,
      costPerMile: finalCpm,
      tolls,
      fuelUnit,
      economyUnit,
      distanceUnit,
    },
    preview: false,
    quota: {
      pro: quota.pro || userHasProAccess(profile, user.email),
      used: usedAfter,
      limit: quota.limit,
      remaining,
    },
  });
}
