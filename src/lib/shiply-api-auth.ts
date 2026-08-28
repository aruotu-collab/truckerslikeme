import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getSignedInUser } from "@/lib/billing-profile";

export const SHIPLY_SIGN_IN_MESSAGE =
  "Create a free account to connect Shiply. Manual entry and screenshots still work without signing in.";

export async function requireSignedInForShiply(): Promise<
  { user: User } | NextResponse
> {
  const { user } = await getSignedInUser();
  if (!user) {
    return NextResponse.json(
      { error: SHIPLY_SIGN_IN_MESSAGE, requiresAuth: true },
      { status: 401 },
    );
  }
  return { user };
}
