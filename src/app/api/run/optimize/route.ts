import { NextResponse } from "next/server";
import {
  rankRunCombos,
  type RunJob,
  type RunMode,
  type RunPrefs,
} from "@/lib/run-builder";
import { operatingDefaultsForMarket } from "@/lib/market-defaults";
import { marketFromCountryCode } from "@/lib/market";

export const dynamic = "force-dynamic";

type Body = {
  jobs?: RunJob[];
  prefs?: Partial<RunPrefs> & { mode?: RunMode };
  countryCode?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const jobs = Array.isArray(body.jobs) ? body.jobs : [];
  if (jobs.length === 0) {
    return NextResponse.json(
      { error: "Add at least one job to build a run." },
      { status: 400 },
    );
  }

  const defaults = operatingDefaultsForMarket(
    marketFromCountryCode(body.countryCode),
  );
  const prefs: RunPrefs = {
    mode: body.prefs?.mode || "profit",
    start: body.prefs?.start || "",
    home: body.prefs?.home || "",
    destination: body.prefs?.destination || "",
    vehicle: body.prefs?.vehicle || "Luton van",
    workWindow: body.prefs?.workWindow || "today",
    finishRadius: body.prefs?.finishRadius || "anywhere",
    finishBy: body.prefs?.finishBy || "flexible",
    availableFrom: body.prefs?.availableFrom || "07:00",
    bookedOrigin: body.prefs?.bookedOrigin || "",
    bookedDestination: body.prefs?.bookedDestination || "",
    bookedWindow: body.prefs?.bookedWindow || "",
    keepBusy: Boolean(body.prefs?.keepBusy),
  };

  const costPerMile =
    (defaults.costPerMile || 0.55) +
    (defaults.fuelUnit === "litre" ? 0.35 : 0.4);

  const combos = rankRunCombos(jobs, prefs, costPerMile);
  const best = combos[0] ?? null;

  return NextResponse.json({
    combos,
    best,
    nextHunt: best?.jobs?.[0]
      ? undefined
      : "Upload more jobs or a results-list screenshot.",
  });
}
