import type { User } from "@supabase/supabase-js";
import type { ActivityKind, LiveActivity, PlannedRoute } from "@/types";
import { createClient } from "@/lib/supabase/client";

export type SavedRouteRow = {
  id: string;
  origin: string;
  destination: string;
  miles: number | null;
  created_at: string;
};

function minutesAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / 60000));
}

export async function ensureProfile(user: User) {
  const supabase = createClient();
  if (!supabase) return { error: "Supabase is not configured." };

  const displayName =
    (typeof user.user_metadata?.display_name === "string" &&
      user.user_metadata.display_name) ||
    user.email?.split("@")[0] ||
    "Driver";

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: displayName,
    },
    { onConflict: "id" },
  );

  if (error) {
    return {
      error:
        error.message.includes("schema cache") ||
        error.message.includes("does not exist")
          ? "Database tables are missing. Run supabase/schema.sql in the Supabase SQL Editor."
          : error.message,
    };
  }

  return { error: null };
}

export async function fetchAlerts(limit = 40): Promise<{
  items: LiveActivity[];
  error: string | null;
}> {
  const supabase = createClient();
  if (!supabase) return { items: [], error: null };

  const { data, error } = await supabase
    .from("alerts")
    .select("id, kind, message, location, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { items: [], error: error.message };
  }

  const items: LiveActivity[] = (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind as ActivityKind,
    message: row.message,
    location: row.location,
    minutesAgo: minutesAgo(row.created_at),
  }));

  return { items, error: null };
}

export async function createAlert(input: {
  user: User;
  kind: ActivityKind;
  message: string;
  location: string;
}): Promise<{ item: LiveActivity | null; error: string | null }> {
  const supabase = createClient();
  if (!supabase) {
    return { item: null, error: "Supabase is not configured." };
  }

  const profile = await ensureProfile(input.user);
  if (profile.error) return { item: null, error: profile.error };

  const { data, error } = await supabase
    .from("alerts")
    .insert({
      user_id: input.user.id,
      kind: input.kind,
      message: input.message,
      location: input.location,
    })
    .select("id, kind, message, location, created_at")
    .single();

  if (error) {
    return {
      item: null,
      error:
        error.message.includes("schema cache") ||
        error.message.includes("does not exist")
          ? "Database tables are missing. Run supabase/schema.sql in the Supabase SQL Editor."
          : error.message,
    };
  }

  return {
    item: {
      id: data.id,
      kind: data.kind as ActivityKind,
      message: data.message,
      location: data.location,
      minutesAgo: 0,
    },
    error: null,
  };
}

export async function saveRoute(input: {
  user: User;
  route: PlannedRoute;
}): Promise<{ error: string | null }> {
  const supabase = createClient();
  if (!supabase) return { error: "Supabase is not configured." };

  const profile = await ensureProfile(input.user);
  if (profile.error) return { error: profile.error };

  const { error } = await supabase.from("saved_routes").insert({
    user_id: input.user.id,
    origin: input.route.origin,
    destination: input.route.destination,
    miles: input.route.miles,
    payload: input.route,
  });

  if (error) {
    return {
      error:
        error.message.includes("schema cache") ||
        error.message.includes("does not exist")
          ? "Database tables are missing. Run supabase/schema.sql in the Supabase SQL Editor."
          : error.message,
    };
  }

  return { error: null };
}

export async function fetchSavedRoutes(userId: string): Promise<{
  routes: SavedRouteRow[];
  error: string | null;
}> {
  const supabase = createClient();
  if (!supabase) return { routes: [], error: null };

  const { data, error } = await supabase
    .from("saved_routes")
    .select("id, origin, destination, miles, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return { routes: [], error: error.message };
  }

  return { routes: data ?? [], error: null };
}
