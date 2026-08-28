import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getSignedInUser } from "@/lib/billing-profile";
import { SHIPLY_SIGN_IN_MESSAGE } from "@/lib/shiply-auth-shared";

export { SHIPLY_SIGN_IN_MESSAGE } from "@/lib/shiply-auth-shared";

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
