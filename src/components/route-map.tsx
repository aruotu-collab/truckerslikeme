import type { PlannedRoute } from "@/types";

const stopColor: Record<PlannedRoute["stops"][number]["type"], string> = {
  fuel: "#3d6b4f",
  parking: "#e09b1e",
  alert: "#c45c26",
  weigh: "#8fb4c9",
};

type RouteMapProps = {
  route: PlannedRoute;
};

export function RouteMap({ route }: RouteMapProps) {
  const points = route.stops.map((stop, index) => {
    const t = (index + 1) / (route.stops.length + 1);
    const x = 40 + t * 320;
    const y = 40 + Math.sin(t * Math.PI) * 90 + (index % 2 === 0 ? -18 : 22);
    return { ...stop, x, y };
  });

  return (
    <div className="relative overflow-hidden rounded-sm border border-white/10 bg-road">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#4a6f86_0%,transparent_45%),radial-gradient(circle_at_80%_70%,#2c313a_0%,transparent_40%)]" />
        <div className="highway-lines absolute inset-x-8 top-1/2 h-1 opacity-70" />
      </div>

      <div className="relative p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-display text-sm tracking-[0.18em] text-chrome uppercase">
            Corridor map
          </p>
          <p className="text-xs text-chrome">Shell · Mapbox later</p>
        </div>

        <svg
          viewBox="0 0 400 220"
          className="h-auto w-full"
          role="img"
          aria-label={`Route map from ${route.origin} to ${route.destination}`}
        >
          <path
            d="M28 170 C 90 150, 120 60, 200 90 S 320 40, 372 70"
            fill="none"
            stroke="#e09b1e"
            strokeWidth="3"
            strokeDasharray="10 8"
            opacity="0.9"
          />
          <circle cx="28" cy="170" r="8" fill="#f0b429" />
          <circle cx="372" cy="70" r="8" fill="#f0b429" />
          <text x="28" y="196" fill="#c5ccd4" fontSize="11" textAnchor="middle">
            {route.origin.split(",")[0]}
          </text>
          <text x="372" y="56" fill="#c5ccd4" fontSize="11" textAnchor="middle">
            {route.destination.split(",")[0]}
          </text>

          {points.map((point) => (
            <g key={point.id}>
              <circle
                cx={point.x}
                cy={point.y}
                r="7"
                fill={stopColor[point.type]}
                stroke="#1a1d23"
                strokeWidth="2"
              />
              <text
                x={point.x}
                y={point.y - 14}
                fill="#edf1f4"
                fontSize="10"
                textAnchor="middle"
              >
                {point.type}
              </text>
            </g>
          ))}
        </svg>

        <ul className="mt-4 grid grid-cols-2 gap-2 text-xs text-chrome sm:grid-cols-4">
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-diesel" /> Fuel
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-amber" /> Parking
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-alert" /> Alert
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-sky" /> Weigh
          </li>
        </ul>
      </div>
    </div>
  );
}
