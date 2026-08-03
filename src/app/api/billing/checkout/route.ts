import { NextResponse } from "next/server";
import {
  getProfileBilling,
  getSignedInUser,
  userHasProAccess,
} from "@/lib/billing-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  appBaseUrl,
  getStripe,
  isStripeConfigured,
  stripePriceMonthly,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Stripe is not configured. Add STRIPE_SECRET_KEY and STRIPE_PRICE_MONTHLY.",
      },
      { status: 503 },
    );
  }

  const { user } = await getSignedInUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const profile = await getProfileBilling(user.id);
  if (userHasProAccess(profile, user.email)) {
    return NextResponse.json(
      { error: "You already have Pro.", alreadyPro: true },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const priceId = stripePriceMonthly();
  if (!stripe || !priceId) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 },
    );
  }

  let body: { interval?: string } = {};
  try {
    body = (await request.json()) as { interval?: string };
  } catch {
    // empty body ok
  }

  const base = appBaseUrl();
  let customerId = profile?.stripe_customer_id ?? undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    const admin = createAdminClient();
    if (admin) {
      await admin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/members?upgraded=1`,
    cancel_url: `${base}/members?billing=cancelled`,
    client_reference_id: user.id,
    metadata: {
      supabase_user_id: user.id,
      interval: body.interval ?? "month",
    },
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Could not create checkout session." },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
