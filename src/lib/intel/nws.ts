export type NwsAlert = {
  externalId: string;
  kind: "weather" | "delay";
  message: string;
  location: string;
  severity: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

const CORRIDOR_STATES = ["TX", "OK", "MO", "IL", "KS", "TN", "AR"];

const TRUCK_RELEVANT =
  /wind|blizzard|winter|ice|snow|dust|fog|flood|tornado|severe|storm|heat|fire|visibility/i;

function areaLabel(props: Record<string, unknown>) {
  const areaDesc = typeof props.areaDesc === "string" ? props.areaDesc : "";
  const first = areaDesc.split(";")[0]?.trim();
  return first || "Corridor weather";
}

export async function fetchNwsCorridorAlerts(): Promise<NwsAlert[]> {
  const area = CORRIDOR_STATES.join(",");
  const url = `https://api.weather.gov/alerts/active?area=${area}&status=actual`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/geo+json",
      "User-Agent": "TruckersLikeMe/1.0 (https://truckerslikeme.com; support@truckerslikeme.com)",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`NWS request failed: ${res.status}`);
  }

  const json = (await res.json()) as {
    features?: Array<{
      id?: string;
      properties?: Record<string, unknown>;
    }>;
  };

  const alerts: NwsAlert[] = [];

  for (const feature of json.features ?? []) {
    const props = feature.properties ?? {};
    const event = typeof props.event === "string" ? props.event : "";
    const headline =
      (typeof props.headline === "string" && props.headline) ||
      (typeof props.description === "string" &&
        props.description.slice(0, 160)) ||
      event;

    if (!event && !headline) continue;
    if (!TRUCK_RELEVANT.test(`${event} ${headline}`)) continue;

    const severity =
      typeof props.severity === "string" ? props.severity : null;
    const kind =
      /flood|closure|road/i.test(`${event} ${headline}`) ? "delay" : "weather";

    alerts.push({
      externalId:
        (typeof props.id === "string" && props.id) ||
        feature.id ||
        `nws-${event}-${areaLabel(props)}`,
      kind,
      message: headline.replace(/\s+/g, " ").trim().slice(0, 220),
      location: `${event || "Weather"} · ${areaLabel(props)}`,
      severity,
      startsAt: typeof props.onset === "string" ? props.onset : null,
      endsAt: typeof props.ends === "string" ? props.ends : null,
    });
  }

  return alerts.slice(0, 25);
}
