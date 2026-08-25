export type PlaceKind = "parking" | "diesel" | "repair";

export type PlaceConfidence =
  | "tlm_verified"
  | "driver_confirmed"
  | "web_found"
  | "call_first";

export type PlaceResult = {
  id?: string;
  name: string;
  kind: PlaceKind;
  address?: string | null;
  area?: string | null;
  distanceNote?: string | null;
  truckTypes?: string[];
  overnight?: boolean | null;
  security?: boolean | null;
  phone?: string | null;
  priceNote?: string | null;
  confidence: PlaceConfidence;
  summary?: string | null;
  source?: string | null;
};

export const confidenceMeta: Record<
  PlaceConfidence,
  { label: string; hint: string; tone: string }
> = {
  tlm_verified: {
    label: "TLM verified",
    hint: "Confirmed by multiple drivers or a reliable local source.",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  driver_confirmed: {
    label: "Driver confirmed",
    hint: "Recently used by a TruckersLikeMe member.",
    tone: "border-sky-300 bg-sky-50 text-sky-900",
  },
  web_found: {
    label: "Web found",
    hint: "Found from current external information — verify before you go.",
    tone: "border-amber/40 bg-amber/10 text-asphalt",
  },
  call_first: {
    label: "Call first",
    hint: "Truck suitability or availability is not confirmed.",
    tone: "border-alert/40 bg-red-50 text-alert",
  },
};

export function badgeRank(c: PlaceConfidence) {
  switch (c) {
    case "tlm_verified":
      return 0;
    case "driver_confirmed":
      return 1;
    case "web_found":
      return 2;
    default:
      return 3;
  }
}
