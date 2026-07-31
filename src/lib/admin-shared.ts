import type { User } from "@supabase/supabase-js";

export type AppRole = "driver" | "admin";

const BOOTSTRAP_ADMIN_EMAILS = ["aruotu@gmail.com"];

export function isBootstrapAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return BOOTSTRAP_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/** Client-safe check (email allowlist + metadata). */
export function userLooksAdmin(user: User | null | undefined) {
  if (!user?.email) return false;
  if (isBootstrapAdminEmail(user.email)) return true;
  const role = user.app_metadata?.role ?? user.user_metadata?.role;
  return role === "admin";
}
