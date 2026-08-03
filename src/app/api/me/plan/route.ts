import { NextResponse } from "next/server";
import {
  getProfileBilling,
  getSignedInUser,
  ensureAnalysesQuota,
  userHasProAccess,
} from "@/lib/billing-profile";
import { FREE_ANALYSES_PER_MONTH } from "@/lib/plan";
import { isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user } = await getSignedInUser();
  if (!user) {
    return NextResponse.json({ signedIn: false });
  }

  const profile = await getProfileBilling(user.id);
  const pro = userHasProAccess(profile, user.email);
  const quota = profile
    ? await ensureAnalysesQuota(profile)
    : {
        allowed: true,
        remaining: FREE_ANALYSES_PER_MONTH,
        used: 0,
        limit: FREE_ANALYSES_PER_MONTH,
        pro: false,
      };

  return NextResponse.json({
    signedIn: true,
    email: user.email,
    plan: pro ? "pro" : (profile?.plan ?? "free"),
    isPro: pro,
    stripeReady: isStripeConfigured(),
    assumptions: profile
      ? {
          mpg: profile.mpg,
          costPerMile: profile.cost_per_mile,
          dieselPriceOverride: profile.diesel_price_override,
        }
      : null,
    quota: {
      used: quota.used,
      limit: pro ? null : FREE_ANALYSES_PER_MONTH,
      remaining: pro ? null : quota.remaining,
    },
  });
}
