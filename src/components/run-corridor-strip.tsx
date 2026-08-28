"use client";

import { HScroll } from "@/components/h-scroll";
import type { RunCombo, RunJob } from "@/lib/run-builder";

type Node = {
  id: string;
  place: string;
  kind: "pickup" | "drop" | "link" | "delivery";
  mile: number;
  detail?: string;
};

function shortPlace(place: string) {
  return place.trim();
}

function cityMatch(a: string, b: string) {
  const ca = a.split(",")[0]?.trim().toLowerCase() || "";
  const cb = b.split(",")[0]?.trim().toLowerCase() || "";
  if (!ca || !cb) return false;
  return ca.includes(cb) || cb.includes(ca);
}

/** Build A → mid → B nodes from a run combo’s job legs. */
export function nodesFromRunJobs(jobs: RunJob[]): Node[] {
  if (!jobs.length) return [];
  const nodes: Node[] = [];
  let mile = 0;

  const first = jobs[0]!;
  nodes.push({
    id: "a",
    place: first.origin || "Start",
    kind: "pickup",
    mile: 0,
    detail: "Pickup",
  });

  jobs.forEach((job, i) => {
    const legMiles =
      typeof job.miles === "number" && job.miles > 0 ? job.miles : 80;
    mile += legMiles;

    const isLast = i === jobs.length - 1;
    const dest = job.destination || "Delivery";

    if (!isLast) {
      nodes.push({
        id: `drop-${job.id}`,
        place: dest,
        kind: "drop",
        mile: Math.round(mile),
        detail: `Job ${i + 1} drop`,
      });

      const next = jobs[i + 1];
      const nextOrigin = next?.origin || "";
      if (nextOrigin && !cityMatch(dest, nextOrigin)) {
        // Deadhead / reposition to next collection
        const emptyGuess = Math.max(15, Math.round(legMiles * 0.1));
        mile += emptyGuess;
        nodes.push({
          id: `link-${job.id}`,
          place: nextOrigin,
          kind: "link",
          mile: Math.round(mile),
          detail: "Next collect",
        });
      }
    } else {
      nodes.push({
        id: "b",
        place: dest,
        kind: "delivery",
        mile: Math.round(mile),
        detail: "Delivery",
      });
    }
  });

  return nodes;
}

const kindTone: Record<Node["kind"], string> = {
  pickup: "bg-emerald-700 text-white",
  drop: "bg-amber text-asphalt",
  link: "bg-sky-deep text-white",
  delivery: "bg-alert text-white",
};

const kindMark: Record<Node["kind"], string> = {
  pickup: "A",
  drop: "●",
  link: "→",
  delivery: "B",
};

export function RunCorridorStrip({
  combo,
  jobs,
}: {
  combo?: RunCombo | null;
  jobs?: RunJob[];
}) {
  const list = jobs ?? combo?.jobs ?? [];
  const nodes = nodesFromRunJobs(list);
  if (nodes.length < 2) return null;

  const start = nodes[0]!;
  const end = nodes[nodes.length - 1]!;
  const mid = nodes.slice(1, -1);

  return (
    <div className="mt-5 border border-asphalt/10 bg-white">
      <div className="border-b border-asphalt/10 px-4 py-3 sm:px-5">
        <p className="font-display text-xs tracking-[0.16em] text-muted uppercase">
          Corridor
        </p>
        <p className="mt-1 text-sm text-muted">
          Pickup and final delivery stay fixed — job drops and links sit in
          between.
        </p>
      </div>

      <div className="[--h-scroll-fade:#ffffff] px-3 py-5 sm:px-5">
        <div className="flex items-start gap-1 sm:gap-2">
          <div className="relative z-20 flex w-[4.5rem] shrink-0 flex-col items-center text-center sm:w-[5.5rem]">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-sm text-xs font-bold tracking-wide ${kindTone.pickup}`}
            >
              A
            </span>
            <span className="mt-2 line-clamp-3 px-0.5 text-[10px] font-semibold leading-tight tracking-wide text-asphalt uppercase sm:text-[11px]">
              {shortPlace(start.place)}
            </span>
            <span className="mt-1 text-[10px] text-muted">Pickup · mi 0</span>
          </div>

          <div
            className="mt-5 h-0.5 w-2 shrink-0 bg-asphalt/20 sm:w-3"
            aria-hidden
          />

          <div className="min-w-0 flex-1">
            {mid.length > 0 ? (
              <HScroll
                aria-label="Stops between pickup and delivery"
                role="list"
                hint="Swipe for more stops"
                showScrollbar
              >
                <div className="flex min-w-min items-start gap-0">
                  {mid.map((node, index) => (
                    <div
                      key={node.id}
                      className="relative flex shrink-0 items-start"
                    >
                      {index > 0 && (
                        <div
                          className="mt-5 h-0.5 w-5 shrink-0 bg-asphalt/20 sm:w-8"
                          aria-hidden
                        />
                      )}
                      <div
                        className="relative z-10 flex w-[4.75rem] flex-col items-center text-center sm:w-24"
                        title={`${node.place} · mi ${node.mile}`}
                      >
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-sm text-xs font-bold ${kindTone[node.kind]}`}
                        >
                          {node.kind === "drop"
                            ? String(
                                mid
                                  .slice(0, index + 1)
                                  .filter((n) => n.kind === "drop").length,
                              )
                            : kindMark[node.kind]}
                        </span>
                        <span className="mt-2 line-clamp-2 px-0.5 text-[10px] font-medium leading-tight text-asphalt sm:text-[11px]">
                          {shortPlace(node.place)}
                        </span>
                        <span className="mt-1 font-display text-[10px] tracking-wide text-muted uppercase">
                          mi {node.mile}
                          <span className="mx-1 text-asphalt/30">·</span>
                          {node.detail || node.kind}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </HScroll>
            ) : (
              <div className="flex h-10 items-center">
                <div className="h-0.5 w-full bg-asphalt/20" aria-hidden />
              </div>
            )}
          </div>

          <div
            className="mt-5 h-0.5 w-2 shrink-0 bg-asphalt/20 sm:w-3"
            aria-hidden
          />

          <div className="relative z-20 flex w-[4.5rem] shrink-0 flex-col items-center text-center sm:w-[5.5rem]">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-sm text-xs font-bold tracking-wide ${kindTone.delivery}`}
            >
              B
            </span>
            <span className="mt-2 line-clamp-3 px-0.5 text-[10px] font-semibold leading-tight tracking-wide text-asphalt uppercase sm:text-[11px]">
              {shortPlace(end.place)}
            </span>
            <span className="mt-1 text-[10px] text-muted">
              Delivery · mi {end.mile}
            </span>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          A and B stay put. Job drops
          {mid.some((n) => n.kind === "link") ? " and next-collect links" : ""}{" "}
          sit between them
          {combo?.jobs && combo.jobs.length > 1
            ? ` · ${combo.jobs.length} jobs combined`
            : ""}
          .
        </p>
      </div>
    </div>
  );
}
