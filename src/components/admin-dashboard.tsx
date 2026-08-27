"use client";

import { useState } from "react";
import Link from "next/link";

type MemberRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: "driver" | "admin";
  plan: "free" | "pro";
  created_at: string;
  ai_queries_used: number | null;
  analyses_used: number | null;
  last_seen_at: string | null;
};

type Overview = {
  stats: {
    members: number;
    alerts: number;
    savedRoutes: number;
    loadAnalyses: number;
    places: number;
    placeFeedback: number;
    visits24h: number;
    visits7d: number;
    visits30d: number;
    clicks7d: number;
    memberVisits7d: number;
    guestVisits7d: number;
  };
  topPages: { path: string; visit_count: number }[];
  topCountries: { country: string; visit_count: number }[];
  topClicks: { event_name: string; label: string; click_count: number }[];
  recentVisits: {
    id: number;
    path: string;
    country: string | null;
    ip_hash: string | null;
    referrer: string | null;
    visited_at: string;
    user_id: string | null;
    email: string | null;
    display_name: string | null;
  }[];
  members: MemberRow[];
  recentAlerts: {
    id: string;
    kind: string;
    message: string;
    location: string;
    created_at: string;
  }[];
  recentRoutes: {
    id: string;
    origin: string;
    destination: string;
    miles: number | null;
    created_at: string;
  }[];
  recentAnalyses: {
    id: string;
    origin: string | null;
    destination: string | null;
    miles: number;
    rate_total: number;
    net_profit: number | null;
    score: string;
    created_at: string;
  }[];
  recentFeedback: {
    id: string;
    place_id: string;
    did_park: boolean;
    created_at: string;
  }[];
  ops: {
    fuelLatest: {
      region: string;
      price_usd: number;
      fetched_at: string;
    } | null;
    intelLatest: {
      kind: string;
      message: string;
      updated_at: string;
    } | null;
  };
  errors?: { members?: string | null; visits?: string | null; analytics?: string | null };
};

type Tab =
  | "overview"
  | "traffic"
  | "clicks"
  | "members"
  | "content"
  | "ops";

function timeAgo(iso: string) {
  const mins = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-l-2 border-amber bg-white px-4 py-3">
      <p className="font-display text-3xl text-asphalt">{value}</p>
      <p className="mt-1 text-xs tracking-wide text-muted uppercase">{label}</p>
    </div>
  );
}

function DataTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: (string | number | null)[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-muted">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead>
          <tr className="border-b border-asphalt/10 text-xs tracking-wide text-muted uppercase">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-asphalt/10">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-asphalt">
                  {cell ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "traffic", label: "Traffic" },
  { id: "clicks", label: "Clicks" },
  { id: "members", label: "Members" },
  { id: "content", label: "Content" },
  { id: "ops", label: "Ops" },
];

export function AdminDashboard({
  data,
  busyId,
  onRefresh,
  onUpdateMember,
}: {
  data: Overview;
  busyId: string | null;
  onRefresh: () => void;
  onUpdateMember: (
    userId: string,
    patch: { plan?: "free" | "pro"; role?: "driver" | "admin" },
  ) => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-2 border-b border-asphalt/10 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-sm px-3 py-2 text-xs font-semibold tracking-wide uppercase sm:text-sm ${
              tab === t.id
                ? "bg-asphalt text-white"
                : "text-muted hover:bg-asphalt/5 hover:text-asphalt"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onRefresh}
          className="ml-auto rounded-sm border border-asphalt/15 px-3 py-2 text-xs font-semibold uppercase"
        >
          Refresh
        </button>
      </div>

      {(data.errors?.visits || data.errors?.analytics) && (
        <p className="mt-4 text-sm text-muted">
          Analytics need{" "}
          <code className="text-asphalt">schema-analytics.sql</code> run in
          Supabase. Until then, visit counts may work but top pages / clicks /
          countries need the migration.
        </p>
      )}

      {tab === "overview" && (
        <div className="mt-6 space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <StatCard label="Members" value={data.stats.members} />
            <StatCard label="Visits 24h" value={data.stats.visits24h} />
            <StatCard label="Visits 7d" value={data.stats.visits7d} />
            <StatCard label="Visits 30d" value={data.stats.visits30d} />
            <StatCard label="Clicks 7d" value={data.stats.clicks7d} />
            <StatCard label="Driver reports" value={data.stats.alerts} />
            <StatCard label="Saved routes" value={data.stats.savedRoutes} />
            <StatCard label="Load analyses" value={data.stats.loadAnalyses} />
            <StatCard label="Places" value={data.stats.places} />
            <StatCard label="Place feedback" value={data.stats.placeFeedback} />
            <StatCard
              label="Member visits 7d"
              value={data.stats.memberVisits7d}
            />
            <StatCard label="Guest visits 7d" value={data.stats.guestVisits7d} />
          </div>
        </div>
      )}

      {tab === "traffic" && (
        <div className="mt-6 grid gap-10 lg:grid-cols-2">
          <section>
            <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
              Top pages (7d)
            </h2>
            <div className="mt-4 border border-asphalt/10 bg-white">
              <DataTable
                headers={["Page", "Visits"]}
                rows={data.topPages.map((r) => [r.path, r.visit_count])}
                empty="No page visits yet."
              />
            </div>
          </section>
          <section>
            <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
              Top countries (7d)
            </h2>
            <div className="mt-4 border border-asphalt/10 bg-white">
              <DataTable
                headers={["Country", "Visits"]}
                rows={data.topCountries.map((r) => [r.country, r.visit_count])}
                empty="No country data yet."
              />
            </div>
          </section>
          <section className="lg:col-span-2">
            <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
              Recent visitors
            </h2>
            <p className="mt-1 text-sm text-muted">
              IP shown as hashed fingerprint — same hash = same visitor, not
              reversible.
            </p>
            <div className="mt-4 border border-asphalt/10 bg-white">
              <DataTable
                headers={[
                  "When",
                  "Page",
                  "Who",
                  "Country",
                  "IP hash",
                  "Referrer",
                ]}
                rows={data.recentVisits.map((v) => [
                  timeAgo(v.visited_at),
                  v.path,
                  v.email ?? v.display_name ?? (v.user_id ? "Member" : "Guest"),
                  v.country,
                  v.ip_hash,
                  v.referrer
                    ? v.referrer.replace(/^https?:\/\//, "").slice(0, 40)
                    : null,
                ])}
                empty="No visits recorded yet."
              />
            </div>
          </section>
        </div>
      )}

      {tab === "clicks" && (
        <div className="mt-6">
          <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
            Top clicks (7d)
          </h2>
          <div className="mt-4 border border-asphalt/10 bg-white">
            <DataTable
              headers={["Event", "Label", "Clicks"]}
              rows={data.topClicks.map((r) => [
                r.event_name,
                r.label,
                r.click_count,
              ])}
              empty="No clicks tracked yet."
            />
          </div>
        </div>
      )}

      {tab === "members" && (
        <section className="mt-6">
          <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
            Members ({data.stats.members})
          </h2>
          <ul className="mt-4 divide-y divide-asphalt/10 border-y border-asphalt/10">
            {data.members.map((member) => (
              <li
                key={member.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-asphalt">
                    {member.display_name || "Driver"}{" "}
                    <span className="text-xs tracking-wide text-muted uppercase">
                      {member.role} · {member.plan}
                    </span>
                  </p>
                  <p className="truncate text-sm text-muted">
                    {member.email || member.id}
                  </p>
                  <p className="text-xs text-muted">
                    Joined {timeAgo(member.created_at)}
                    {member.last_seen_at
                      ? ` · Last seen ${timeAgo(member.last_seen_at)}`
                      : ""}
                    {" · "}
                    Analyses {member.analyses_used ?? 0} · AI{" "}
                    {member.ai_queries_used ?? 0}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === member.id}
                    onClick={() =>
                      onUpdateMember(member.id, {
                        plan: member.plan === "pro" ? "free" : "pro",
                      })
                    }
                    className="rounded-sm border border-asphalt/20 px-3 py-2 text-xs font-semibold uppercase"
                  >
                    {member.plan === "pro" ? "Set free" : "Set pro"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === member.id}
                    onClick={() =>
                      onUpdateMember(member.id, {
                        role: member.role === "admin" ? "driver" : "admin",
                      })
                    }
                    className="rounded-sm border border-asphalt/20 px-3 py-2 text-xs font-semibold uppercase"
                  >
                    {member.role === "admin" ? "Make driver" : "Make admin"}
                  </button>
                </div>
              </li>
            ))}
            {data.members.length === 0 && (
              <li className="py-6 text-muted">No members yet.</li>
            )}
          </ul>
        </section>
      )}

      {tab === "content" && (
        <div className="mt-6 grid gap-10 lg:grid-cols-2">
          <section>
            <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
              Recent driver reports
            </h2>
            <ul className="mt-4 divide-y divide-asphalt/10 border-y border-asphalt/10">
              {data.recentAlerts.map((alert) => (
                <li key={alert.id} className="py-3">
                  <p className="text-xs tracking-wide text-amber uppercase">
                    {alert.kind} · {timeAgo(alert.created_at)}
                  </p>
                  <p className="mt-1 text-asphalt">{alert.message}</p>
                  <p className="text-sm text-muted">{alert.location}</p>
                </li>
              ))}
              {data.recentAlerts.length === 0 && (
                <li className="py-6 text-muted">No reports yet.</li>
              )}
            </ul>
          </section>
          <section>
            <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
              Recent saved routes
            </h2>
            <ul className="mt-4 divide-y divide-asphalt/10 border-y border-asphalt/10">
              {data.recentRoutes.map((route) => (
                <li key={route.id} className="py-3">
                  <p className="font-medium text-asphalt">
                    {route.origin} → {route.destination}
                  </p>
                  <p className="text-sm text-muted">
                    {route.miles != null ? `${route.miles} mi · ` : ""}
                    {timeAgo(route.created_at)}
                  </p>
                </li>
              ))}
              {data.recentRoutes.length === 0 && (
                <li className="py-6 text-muted">No saved routes yet.</li>
              )}
            </ul>
          </section>
          <section>
            <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
              Recent load analyses
            </h2>
            <ul className="mt-4 divide-y divide-asphalt/10 border-y border-asphalt/10">
              {data.recentAnalyses.map((a) => (
                <li key={a.id} className="py-3">
                  <p className="font-medium text-asphalt">
                    {a.origin ?? "?"} → {a.destination ?? "?"} · £
                    {Number(a.rate_total).toFixed(0)}
                  </p>
                  <p className="text-sm text-muted">
                    {a.score} · net £{Number(a.net_profit ?? 0).toFixed(0)} ·{" "}
                    {a.miles} mi · {timeAgo(a.created_at)}
                  </p>
                </li>
              ))}
              {data.recentAnalyses.length === 0 && (
                <li className="py-6 text-muted">No analyses yet.</li>
              )}
            </ul>
          </section>
          <section>
            <h2 className="font-display text-xl tracking-wide text-asphalt uppercase">
              Recent place feedback
            </h2>
            <ul className="mt-4 divide-y divide-asphalt/10 border-y border-asphalt/10">
              {data.recentFeedback.map((f) => (
                <li key={f.id} className="py-3">
                  <p className="text-asphalt">
                    {f.did_park ? "Parked" : "Did not park"} · place{" "}
                    {f.place_id.slice(0, 8)}…
                  </p>
                  <p className="text-sm text-muted">{timeAgo(f.created_at)}</p>
                </li>
              ))}
              {data.recentFeedback.length === 0 && (
                <li className="py-6 text-muted">No feedback yet.</li>
              )}
            </ul>
          </section>
        </div>
      )}

      {tab === "ops" && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="border border-asphalt/10 bg-white px-5 py-4">
            <h2 className="font-display text-lg tracking-wide text-asphalt uppercase">
              Fuel intel (EIA)
            </h2>
            {data.ops.fuelLatest ? (
              <>
                <p className="mt-2 text-asphalt">
                  {data.ops.fuelLatest.region} · $
                  {Number(data.ops.fuelLatest.price_usd).toFixed(3)}/gal
                </p>
                <p className="text-sm text-muted">
                  Last fetch {timeAgo(data.ops.fuelLatest.fetched_at)}
                </p>
              </>
            ) : (
              <p className="mt-2 text-muted">No fuel snapshots yet.</p>
            )}
          </div>
          <div className="border border-asphalt/10 bg-white px-5 py-4">
            <h2 className="font-display text-lg tracking-wide text-asphalt uppercase">
              System alerts (NWS / cron)
            </h2>
            {data.ops.intelLatest ? (
              <>
                <p className="mt-2 text-asphalt">{data.ops.intelLatest.message}</p>
                <p className="text-sm text-muted">
                  {data.ops.intelLatest.kind} · updated{" "}
                  {timeAgo(data.ops.intelLatest.updated_at)}
                </p>
              </>
            ) : (
              <p className="mt-2 text-muted">No system alerts yet.</p>
            )}
          </div>
          <div className="border border-asphalt/10 bg-white px-5 py-4 sm:col-span-2">
            <h2 className="font-display text-lg tracking-wide text-asphalt uppercase">
              External analytics
            </h2>
            <p className="mt-2 text-sm text-muted">
              Google Analytics (if configured) complements first-party data
              here.
            </p>
            <a
              className="mt-3 inline-block text-sm font-semibold text-amber underline"
              href="https://analytics.google.com/"
              target="_blank"
              rel="noreferrer"
            >
              Open Google Analytics →
            </a>
          </div>
          <div className="border border-asphalt/10 bg-white px-5 py-4 sm:col-span-2">
            <h2 className="font-display text-lg tracking-wide text-asphalt uppercase">
              Quick links
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/live"
                className="rounded-sm border border-asphalt/15 px-3 py-2 text-xs font-semibold uppercase"
              >
                Live feed
              </Link>
              <Link
                href="/map"
                className="rounded-sm border border-asphalt/15 px-3 py-2 text-xs font-semibold uppercase"
              >
                Job Board
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export type { Overview, MemberRow };
