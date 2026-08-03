import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FREE_ANALYSES_PER_MONTH,
  isProPlan,
  type PlanTier,
} from "@/lib/plan";
import { isBootstrapAdminEmail } from "@/lib/admin-shared";

export type ProfileBilling = {
  id: string;
  plan: PlanTier;
  role: string;
  mpg: number;
  cost_per_mile: number;
  diesel_price_override: number | null;
  analyses_used: number;
  analyses_reset_at: string | null;
  stripe_customer_id: string | null;
  email: string | null;
};

function startOfMonthIso() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function getSignedInUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Prefer service role; fall back to the signed-in user's client (RLS). */
export function dbWriter(
  userClient: SupabaseClient | null,
): SupabaseClient | null {
  return createAdminClient() ?? userClient;
}

export async function getProfileBilling(
  userId: string,
  userClient?: SupabaseClient | null,
): Promise<ProfileBilling | null> {
  const client = createAdminClient() ?? userClient ?? (await createClient());
  if (!client) return null;

  const full = await client
    .from("profiles")
    .select(
      "id, plan, role, mpg, cost_per_mile, diesel_price_override, analyses_used, analyses_reset_at, stripe_customer_id, email",
    )
    .eq("id", userId)
    .maybeSingle();

  if (full.data && !full.error) {
    const data = full.data;
    return {
      id: data.id,
      plan: (data.plan as PlanTier) || "free",
      role: data.role ?? "driver",
      mpg: Number(data.mpg ?? 6.5),
      cost_per_mile: Number(data.cost_per_mile ?? 0.65),
      diesel_price_override:
        data.diesel_price_override == null
          ? null
          : Number(data.diesel_price_override),
      analyses_used: Number(data.analyses_used ?? 0),
      analyses_reset_at: data.analyses_reset_at ?? null,
      stripe_customer_id: data.stripe_customer_id ?? null,
      email: data.email ?? null,
    };
  }

  // Pre-migration: columns from schema-money.sql may not exist yet
  const basic = await client
    .from("profiles")
    .select("id, plan, role, email")
    .eq("id", userId)
    .maybeSingle();

  if (!basic.data) return null;

  return {
    id: basic.data.id,
    plan: (basic.data.plan as PlanTier) || "free",
    role: basic.data.role ?? "driver",
    mpg: 6.5,
    cost_per_mile: 0.65,
    diesel_price_override: null,
    analyses_used: 0,
    analyses_reset_at: null,
    stripe_customer_id: null,
    email: basic.data.email ?? null,
  };
}

export async function ensureAnalysesQuota(
  profile: ProfileBilling,
  writer?: SupabaseClient | null,
) {
  if (isProPlan(profile.plan) || profile.role === "admin") {
    return {
      allowed: true,
      remaining: Infinity as number | typeof Infinity,
      used: profile.analyses_used,
      limit: null as number | null,
      pro: true,
    };
  }

  const monthStart = startOfMonthIso();
  let used = profile.analyses_used;
  const resetAt = profile.analyses_reset_at;

  if (!resetAt || resetAt < monthStart) {
    used = 0;
    const db = writer ?? createAdminClient();
    if (db) {
      await db
        .from("profiles")
        .update({ analyses_used: 0, analyses_reset_at: monthStart })
        .eq("id", profile.id);
    }
  }

  const remaining = Math.max(0, FREE_ANALYSES_PER_MONTH - used);
  return {
    allowed: remaining > 0,
    remaining,
    used,
    limit: FREE_ANALYSES_PER_MONTH,
    pro: false,
  };
}

export async function incrementAnalysesUsed(
  userId: string,
  current: number,
  writer?: SupabaseClient | null,
) {
  const db = writer ?? createAdminClient();
  if (!db) return;
  const monthStart = startOfMonthIso();
  await db
    .from("profiles")
    .update({
      analyses_used: current + 1,
      analyses_reset_at: monthStart,
    })
    .eq("id", userId);
}

export function userHasProAccess(
  profile: ProfileBilling | null,
  email: string | null | undefined,
) {
  if (isBootstrapAdminEmail(email)) return true;
  if (!profile) return false;
  if (profile.role === "admin") return true;
  return isProPlan(profile.plan);
}

export type LoadAnalysisRow = {
  id: string;
  origin: string | null;
  destination: string | null;
  miles: number;
  rate_total: number;
  net_profit: number;
  net_per_mile: number;
  score: string;
  created_at: string;
};

export async function fetchUserAnalyses(
  userId: string,
  userClient?: SupabaseClient | null,
  limit = 10,
): Promise<LoadAnalysisRow[]> {
  const client = createAdminClient() ?? userClient;
  if (!client) return [];

  const { data, error } = await client
    .from("load_analyses")
    .select(
      "id, origin, destination, miles, rate_total, net_profit, net_per_mile, score, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as LoadAnalysisRow[];
}
