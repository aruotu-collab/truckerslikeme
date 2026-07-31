import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBootstrapAdminEmail } from "@/lib/admin-shared";

export {
  isBootstrapAdminEmail,
  userLooksAdmin,
  type AppRole,
} from "@/lib/admin-shared";

/** Server-side: verify signed-in user is admin via profile + bootstrap email. */
export async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) {
    return { ok: false as const, error: "Supabase is not configured.", user: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Sign in required.", user: null };
  }

  if (isBootstrapAdminEmail(user.email)) {
    return { ok: true as const, error: null, user };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") {
    return { ok: true as const, error: null, user };
  }

  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (data?.role === "admin") {
      return { ok: true as const, error: null, user };
    }
  }

  return { ok: false as const, error: "Admin access required.", user };
}
