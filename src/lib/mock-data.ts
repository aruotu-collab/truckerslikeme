import type { LiveActivity, PlannedRoute } from "@/types";

export const liveActivities: LiveActivity[] = [
  {
    id: "1",
    kind: "route",
    message: "42 truckers stopped in Oklahoma City today",
    location: "Oklahoma City, OK",
    minutesAgo: 12,
  },
  {
    id: "2",
    kind: "traffic",
    message: "18 drivers reported heavy traffic on I-40",
    location: "I-40 Westbound",
    minutesAgo: 8,
  },
  {
    id: "3",
    kind: "parking",
    message: "12 parking spaces left at Love's Nashville",
    location: "Nashville, TN",
    minutesAgo: 4,
  },
  {
    id: "4",
    kind: "route",
    message: "31 drivers heading towards Chicago",
    location: "Midwest corridor",
    minutesAgo: 21,
  },
  {
    id: "5",
    kind: "delay",
    message: "8 warehouse delays reported this hour",
    location: "Dallas–Fort Worth",
    minutesAgo: 6,
  },
  {
    id: "6",
    kind: "fuel",
    message: "Diesel dropped 9¢ at Pilot near Springfield",
    location: "Springfield, IL",
    minutesAgo: 15,
  },
  {
    id: "7",
    kind: "weather",
    message: "High wind advisory on I-70 through Kansas",
    location: "I-70 Kansas",
    minutesAgo: 28,
  },
  {
    id: "8",
    kind: "parking",
    message: "Avoid TA Joplin tonight — lot nearly full",
    location: "Joplin, MO",
    minutesAgo: 11,
  },
];

export const sampleRoute: PlannedRoute = {
  origin: "Dallas, TX",
  destination: "Chicago, IL",
  miles: 925,
  hours: 14.5,
  insights: [
    "High winds ahead near Wichita",
    "I-44 roadworks east of Tulsa",
    "Parking 93% full near Springfield",
    "Cheapest diesel on route: $3.41 near St. Louis",
  ],
  stops: [
    {
      id: "s1",
      type: "fuel",
      label: "Pilot Ardmore",
      detail: "$3.52 / gal · open 24h",
      mile: 98,
      status: "good",
    },
    {
      id: "s2",
      type: "alert",
      label: "I-44 construction",
      detail: "Lane closures · expect 25 min delay",
      mile: 240,
      status: "warn",
    },
    {
      id: "s3",
      type: "parking",
      label: "Love's Springfield",
      detail: "7 spaces · showers available",
      mile: 510,
      status: "warn",
    },
    {
      id: "s4",
      type: "fuel",
      label: "Flying J Collinsville",
      detail: "$3.41 / gal · best on route",
      mile: 720,
      status: "good",
    },
    {
      id: "s5",
      type: "weigh",
      label: "Illinois weigh station",
      detail: "Open · southbound only",
      mile: 860,
      status: "good",
    },
  ],
};

export const citySuggestions = [
  "Dallas, TX",
  "Chicago, IL",
  "Atlanta, GA",
  "Houston, TX",
  "Los Angeles, CA",
  "Phoenix, AZ",
  "Denver, CO",
  "Nashville, TN",
  "Kansas City, MO",
  "Indianapolis, IN",
];
