export type CorridorStopKind = "parking" | "fuel" | "repair" | "lodging";

export type CorridorRibbonStop = {
  id: string;
  kind: CorridorStopKind;
  name: string;
  mile: number;
  detail?: string;
};

export const corridorKindTone: Record<CorridorStopKind, string> = {
  fuel: "bg-amber text-asphalt",
  parking: "bg-sky-deep text-white",
  repair: "bg-asphalt text-white",
  lodging: "bg-road text-white",
};

export const corridorKindLabel: Record<CorridorStopKind, string> = {
  fuel: "Fuel",
  parking: "Parking",
  repair: "Repair",
  lodging: "Lodging",
};

/** Demo corridor for Plan Route empty state + marketing homepage. */
export const DEMO_CORRIDOR = {
  origin: "Newcastle",
  destination: "Manchester",
  miles: 120,
  hours: 2,
  note: "Example haul — plan your own route to discover live stops.",
  stops: [
    {
      id: "demo-p1",
      kind: "parking" as const,
      name: "Sandy Lane Truckparc",
      mile: 5,
      detail: "A1(M) north · secure overnight",
    },
    {
      id: "demo-f1",
      kind: "fuel" as const,
      name: "Durham A1(M) Services",
      mile: 10,
      detail: "HGV diesel · card accepted",
    },
    {
      id: "demo-f2",
      kind: "fuel" as const,
      name: "Wetherby Services",
      mile: 45,
      detail: "A1(M) · busy after 4 PM",
    },
    {
      id: "demo-r1",
      kind: "repair" as const,
      name: "Coneygarth Truckstop",
      mile: 50,
      detail: "Tyres · oil · light mechanical",
    },
    {
      id: "demo-p2",
      kind: "parking" as const,
      name: "Hartshead Moor Services",
      mile: 85,
      detail: "M62 · truck parking westbound",
    },
    {
      id: "demo-f3",
      kind: "fuel" as const,
      name: "Birch Services",
      mile: 95,
      detail: "M62 · HGV lane",
    },
    {
      id: "demo-p3",
      kind: "parking" as const,
      name: "Lymm Truckstop",
      mile: 110,
      detail: "M6/M62 · confirm space if artic",
    },
    {
      id: "demo-r2",
      kind: "repair" as const,
      name: "Manchester Freight Repair",
      mile: 115,
      detail: "Commercial tyres · call ahead",
    },
  ] satisfies CorridorRibbonStop[],
};
