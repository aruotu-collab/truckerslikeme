import { NextResponse } from "next/server";
import {
  fetchUserAnalyses,
  getSignedInUser,
} from "@/lib/billing-profile";

export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase, user } = await getSignedInUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const items = await fetchUserAnalyses(user.id, supabase, 15);
  return NextResponse.json({ items });
}
