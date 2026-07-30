export type ActivityKind =
  | "parking"
  | "traffic"
  | "fuel"
  | "delay"
  | "route"
  | "weather";

export type LiveActivity = {
  id: string;
  kind: ActivityKind;
  message: string;
  location: string;
  minutesAgo: number;
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

export type AuthGateAction =
  | "save-route"
  | "report-alert"
  | "ask-ai"
  | "join-community";
