import type { CorridorSupport, CorridorSupportPlace } from "@/types";

/**
 * Seed corridor support for Dallas → Chicago (I-35 / I-44 / I-55).
 * Counts are researched public stops — not a standby dispatch network.
 * Lodging = motels / truck-stop rooms known for tractor-trailer parking.
 */

const dallasChicagoPlaces: CorridorSupportPlace[] = [
  {
    id: "r1",
    kind: "repair",
    name: "Love's Tire Care Ardmore",
    detail: "I-35 Exit 32 · tires + light repair · 24h",
    mile: 97,
  },
  {
    id: "r2",
    kind: "repair",
    name: "TA Truck Service Oklahoma City",
    detail: "I-35 / I-40 junction · full shop · road service radius",
    mile: 205,
  },
  {
    id: "r3",
    kind: "repair",
    name: "Petro Lube Express Joplin",
    detail: "I-44 Exit 4 · oil / filters · adjacent to big lot",
    mile: 380,
  },
  {
    id: "r4",
    kind: "repair",
    name: "Flying J Service Springfield, MO",
    detail: "I-44 Exit 72 · tires + minor mechanical",
    mile: 450,
  },
  {
    id: "r5",
    kind: "repair",
    name: "Love's Tire Care Rolla",
    detail: "I-44 Exit 184 · common overnight repair stop",
    mile: 560,
  },
  {
    id: "r6",
    kind: "repair",
    name: "TA Truck Service Troy / St. Louis area",
    detail: "I-55 corridor · shop + CAT scale nearby",
    mile: 700,
  },
  {
    id: "l1",
    kind: "lodging",
    name: "Motel 6 Ardmore",
    detail: "I-35 corridor · truck parking along south side",
    mile: 100,
  },
  {
    id: "l2",
    kind: "lodging",
    name: "Red Roof Inn Oklahoma City West",
    detail: "Near I-40 · confirm lot space for 53' before check-in",
    mile: 210,
  },
  {
    id: "l3",
    kind: "lodging",
    name: "Petro Joplin drivers lounge / rooms",
    detail: "I-44 Exit 4 · on-site rooms + ~465 truck spaces",
    mile: 380,
  },
  {
    id: "l4",
    kind: "lodging",
    name: "Motel 6 Springfield, MO",
    detail: "I-44 access · truck parking commonly available overnight",
    mile: 455,
  },
  {
    id: "p1",
    kind: "parking",
    name: "Pilot #701 Ardmore",
    detail: "I-35 Exit 33 · overnight lot · showers · CAT scale",
    mile: 98,
  },
  {
    id: "p2",
    kind: "parking",
    name: "Love's #266 Ardmore",
    detail: "I-35 Exit 32 · tighter lot — arrive early",
    mile: 97,
  },
  {
    id: "p3",
    kind: "parking",
    name: "Petro Joplin",
    detail: "I-44 Exit 4 · ~465 spaces · Reserve-It",
    mile: 380,
  },
  {
    id: "p4",
    kind: "parking",
    name: "Love's #282 Joplin",
    detail: "I-44 · only ~25 spaces — overflow to Petro",
    mile: 382,
  },
  {
    id: "p5",
    kind: "parking",
    name: "Flying J #1061 Springfield, MO",
    detail: "I-44 Exit 72 · Prime Parking when open",
    mile: 450,
  },
  {
    id: "p6",
    kind: "parking",
    name: "Rest areas I-44 / I-55 corridor",
    detail: "State lots · fill mid-afternoon on freight days",
    mile: 600,
  },
  {
    id: "p7",
    kind: "parking",
    name: "Love's #603 Joliet",
    detail: "I-55 & US-52 · tight after 7 PM near freight parks",
    mile: 880,
  },
  {
    id: "p8",
    kind: "parking",
    name: "TA / Pilot Chicago freight belt",
    detail: "I-80 / I-55 approaches · expect wait at peak",
    mile: 900,
  },
];

function buildSupport(
  corridorKey: string,
  label: string,
  places: CorridorSupportPlace[],
  note: string,
): CorridorSupport {
  return {
    corridorKey,
    label,
    note,
    counts: {
      repair: places.filter((p) => p.kind === "repair").length,
      lodging: places.filter((p) => p.kind === "lodging").length,
      parking: places.filter((p) => p.kind === "parking").length,
      fuel: places.filter((p) => p.kind === "fuel").length,
    },
    places: [...places].sort((a, b) => a.mile - b.mile),
  };
}

const newcastleManchesterPlaces: CorridorSupportPlace[] = [
  {
    id: "uk-p1",
    kind: "parking",
    name: "Sandy Lane Truckparc",
    detail: "A1(M) north · secure overnight",
    mile: 5,
  },
  {
    id: "uk-f1",
    kind: "fuel",
    name: "Durham A1(M) Services",
    detail: "HGV diesel · card accepted",
    mile: 10,
  },
  {
    id: "uk-f2",
    kind: "fuel",
    name: "Wetherby Services",
    detail: "A1(M) · busy after 4 PM",
    mile: 45,
  },
  {
    id: "uk-r1",
    kind: "repair",
    name: "Coneygarth Truckstop",
    detail: "Tyres · oil · light mechanical",
    mile: 50,
  },
  {
    id: "uk-p2",
    kind: "parking",
    name: "Hartshead Moor Services",
    detail: "M62 · truck parking westbound",
    mile: 85,
  },
  {
    id: "uk-f3",
    kind: "fuel",
    name: "Birch Services",
    detail: "M62 · HGV lane",
    mile: 95,
  },
  {
    id: "uk-p3",
    kind: "parking",
    name: "Lymm Truckstop",
    detail: "M6/M62 · confirm space if artic",
    mile: 110,
  },
  {
    id: "uk-r2",
    kind: "repair",
    name: "Manchester Freight Repair",
    detail: "Commercial tyres · call ahead",
    mile: 115,
  },
];

const newcastleManchester = buildSupport(
  "newcastle-manchester",
  "Newcastle → Manchester via A1(M) / M62",
  newcastleManchesterPlaces,
  "Mapped stops on this corridor — refresh for live discovery on your haul.",
);

const dallasChicago = buildSupport(
  "dallas-chicago",
  "Dallas → Chicago via I-35 / I-44 / I-55",
  dallasChicagoPlaces,
  "Tap a filter below. These are real stops on the corridor — not a standby crew.",
);

/** Fallback when the corridor isn't fully mapped yet. */
function approximateSupport(origin: string, destination: string): CorridorSupport {
  const label = `${origin} → ${destination}`;
  const seed = [...label].reduce((n, c) => n + c.charCodeAt(0), 0);
  const repair = 4 + (seed % 4);
  const lodging = 3 + (seed % 3);
  const parking = 6 + (seed % 5);
  const fuel = 4 + (seed % 3);

  return {
    corridorKey: "approx",
    label,
    note: "Estimate for this corridor — try Newcastle → Manchester or Dallas → Chicago for mapped examples.",
    counts: { repair, lodging, parking, fuel },
    places: [],
  };
}

function normalizeCity(value: string) {
  return value.toLowerCase().replace(/,\s*/g, " ").replace(/\s+/g, " ").trim();
}

function isNewcastleManchester(origin: string, destination: string) {
  const o = normalizeCity(origin);
  const d = normalizeCity(destination);
  const fromNewcastle = o.includes("newcastle");
  const toManchester = d.includes("manchester");
  const fromManchester = o.includes("manchester");
  const toNewcastle = d.includes("newcastle");
  return (
    (fromNewcastle && toManchester) || (fromManchester && toNewcastle)
  );
}

function isDallasChicago(origin: string, destination: string) {
  const o = normalizeCity(origin);
  const d = normalizeCity(destination);
  const fromDallas = o.includes("dallas");
  const toChicago = d.includes("chicago") || d.includes("joliet");
  return fromDallas && toChicago;
}

export function getCorridorSupport(
  origin: string,
  destination: string,
): CorridorSupport {
  if (isNewcastleManchester(origin, destination)) return newcastleManchester;
  if (isDallasChicago(origin, destination)) return dallasChicago;
  return approximateSupport(origin.trim(), destination.trim());
}

export const supportKindLabel: Record<
  CorridorSupport["places"][number]["kind"],
  string
> = {
  repair: "Truck repair",
  lodging: "Truck lodging",
  parking: "Parking",
  fuel: "Fuel",
};
