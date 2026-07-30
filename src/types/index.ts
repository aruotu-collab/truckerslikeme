export type ActivityKind =
  | "parking"
  | "traffic"
  | "fuel"
  | "delay"
  | "route"
  | "weather"
  | "weigh"
  | "repair";

export type LiveActivity = {
  id: string;
  kind: ActivityKind;
  message: string;
  location: string;
  minutesAgo: number;
};

export type LiveFeedItem = LiveActivity & {
  source?: string;
  updatedAt?: string;
};

export type RouteStop = {
  id: string;
  type: "parking" | "fuel" | "alert" | "weigh";
  label: string;
  detail: string;
  mile: number;
  status?: "good" | "warn" | "bad";
};

export type PlannedRoute = {
  origin: string;
  destination: string;
  miles: number;
  hours: number;
  stops: RouteStop[];
  insights: string[];
};

/** Truck-side support along a planned corridor (not consumer lodging). */
export type CorridorSupportKind = "repair" | "lodging" | "parking";

export type CorridorSupportPlace = {
  id: string;
  kind: CorridorSupportKind;
  name: string;
  detail: string;
  mile: number;
};

export type CorridorSupport = {
  corridorKey: string;
  label: string;
  note: string;
  counts: {
    repair: number;
    lodging: number;
    parking: number;
  };
  places: CorridorSupportPlace[];
};

export type AuthGateAction =
  | "save-route"
  | "report-alert"
  | "ask-ai"
  | "join-community";
