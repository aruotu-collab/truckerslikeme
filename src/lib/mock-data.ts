import type { LiveActivity, PlannedRoute } from "@/types";

/**
 * Seed corridor intel grounded in public sources (Jul 2026):
 * - EIA on-highway diesel: U.S. avg $5.313, Midwest $5.196, Gulf Coast $5.087 (week of 7/27/26)
 * - FHWA / ATA: national truck parking shortage; lots fill by ~3–5 PM on major corridors
 * - Real stops: Pilot #701 Ardmore OK (I-35 Ex 33), Flying J #1061 Springfield MO (I-44 Ex 72),
 *   Petro Joplin (I-44 Ex 4, ~465 spaces), Love's #282 Joplin (25 spaces),
 *   TA Antioch TN (I-24 Ex 62), Love's #603 Joliet (I-55 & US-52)
 * - MoDOT: I-44 St. Clair / Franklin Co. weigh-scale reconstruction (WB site closed → Mid-2027)
 * - Joliet freight hub: I-80 congestion; intermodal waits often >2 hours
 * Prices at individual pumps fluctuate; seed values are illustrative near EIA regional averages.
 */

export const liveActivities: LiveActivity[] = [
  {
    id: "1",
    kind: "parking",
    message:
      "I-40 corridor parking filling early — arrive by 3–4 PM or reserve a spot",
    location: "I-40 Nashville approach, TN",
    minutesAgo: 9,
  },
  {
    id: "2",
    kind: "traffic",
    message: "Heavy congestion on I-80 between I-55 and US-30",
    location: "Joliet / Chicago freight belt, IL",
    minutesAgo: 6,
  },
  {
    id: "3",
    kind: "parking",
    message: "TA Antioch lot tightening — 122 spaces, expect wait after 8 PM",
    location: "I-24 Exit 62, Antioch, TN",
    minutesAgo: 14,
  },
  {
    id: "4",
    kind: "delay",
    message: "Intermodal yard waits over 2 hours at peak — detention likely",
    location: "Joliet intermodal, IL",
    minutesAgo: 11,
  },
  {
    id: "5",
    kind: "fuel",
    message: "Midwest diesel near $5.20/gal EIA — Gulf Coast still cheaper",
    location: "EIA PADD 2 / PADD 3 averages",
    minutesAgo: 22,
  },
  {
    id: "6",
    kind: "fuel",
    message: "Love's #266 Ardmore cash diesel reported near $4.98 earlier this week",
    location: "I-35 Exit 32, Ardmore, OK",
    minutesAgo: 31,
  },
  {
    id: "7",
    kind: "weather",
    message: "Crosswind risk on open plains — drop speed if gusts exceed 35 mph",
    location: "I-44 / I-70 plains corridor",
    minutesAgo: 18,
  },
  {
    id: "8",
    kind: "parking",
    message: "Love's #282 Joplin only ~25 spaces — Petro Joplin (Ex 4) still has room",
    location: "I-44 Exit 4, Joplin, MO",
    minutesAgo: 7,
  },
  {
    id: "9",
    kind: "delay",
    message: "MoDOT: I-44 St. Clair WB weigh scale closed for rebuild through mid-2027",
    location: "I-44 Franklin County, MO",
    minutesAgo: 45,
  },
  {
    id: "10",
    kind: "route",
    message: "Dallas→Chicago via I-35 / I-44 / I-55 still ~925 miles / ~14.5 hrs",
    location: "South-Central to Midwest corridor",
    minutesAgo: 3,
  },
];

export const sampleRoute: PlannedRoute = {
  origin: "Dallas, TX",
  destination: "Chicago, IL",
  miles: 925,
  hours: 14.5,
  insights: [
    "EIA Midwest diesel ~$5.20/gal (week of Jul 27, 2026) — Gulf Coast stops run cheaper",
    "I-44 east of Tulsa: watch lane work and the St. Clair weigh-scale rebuild",
    "Parking fills by mid-afternoon on I-40/I-44 — plan overnight by 3–4 PM",
    "Joliet/Chicago: I-80 backups + intermodal detention often exceed 2 hours",
  ],
  stops: [
    {
      id: "s1",
      type: "fuel",
      label: "Pilot #701 Ardmore",
      detail: "I-35 Exit 33 · ~$5.05–5.15/gal · 24h · CAT scale · showers",
      mile: 98,
      status: "good",
    },
    {
      id: "s2",
      type: "alert",
      label: "I-44 construction / St. Clair scales",
      detail: "WB weigh site closed for rebuild · expect patrol at EB scale",
      mile: 520,
      status: "warn",
    },
    {
      id: "s3",
      type: "parking",
      label: "Petro Joplin (I-44 Exit 4)",
      detail: "~465 truck spaces · Reserve-It available · Iron Skillet",
      mile: 380,
      status: "good",
    },
    {
      id: "s4",
      type: "fuel",
      label: "Flying J #1061 Springfield, MO",
      detail: "I-44 Exit 72 · ~$5.12/gal · Prime Parking · DEF lanes",
      mile: 450,
      status: "good",
    },
    {
      id: "s5",
      type: "parking",
      label: "Love's #603 Joliet",
      detail: "I-55 & US-52 · lot tight after 7 PM near freight parks",
      mile: 880,
      status: "warn",
    },
    {
      id: "s6",
      type: "weigh",
      label: "Illinois I-55 weigh enforcement",
      detail: "Check GettingAroundIllinois / 511 · status changes by shift",
      mile: 840,
      status: "good",
    },
  ],
};

export const citySuggestions = [
  "Dallas, TX",
  "Chicago, IL",
  "Joliet, IL",
  "St. Louis, MO",
  "Springfield, MO",
  "Tulsa, OK",
  "Oklahoma City, OK",
  "Ardmore, OK",
  "Joplin, MO",
  "Nashville, TN",
  "Kansas City, MO",
  "Indianapolis, IN",
  "Atlanta, GA",
  "Houston, TX",
  "Memphis, TN",
];
