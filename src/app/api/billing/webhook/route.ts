import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function setPlanForUser(
  userId: string,
  plan: "free" | "pro",
  extras?: { customerId?: string; subscriptionId?: string | null },
) {
  const admin = createAdminClient();
  if (!admin || !userId) return;

  const patch: Record<string, string | null> = { plan };
  if (extras?.customerId) patch.stripe_customer_id = extras.customerId;
  if (extras && "subscriptionId" in extras) {
    patch.stripe_subscription_id = extras.subscriptionId ?? null;
  }

  await admin.from("profiles").update(patch).eq("id", userId);
}

async function resolveUserId(
  session: Stripe.Checkout.Session | Stripe.Subscription,
): Promise<string | null> {
  const fromMeta =
    session.metadata?.supabase_user_id ||
    ("client_reference_id" in session ? session.client_reference_id : null);
  if (fromMeta) return fromMeta;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  if (!customerId) return null;

  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 503 },
    );
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        const userId = await resolveUserId(session);
        if (!userId) break;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        await setPlanForUser(userId, "pro", {
          customerId: customerId ?? undefined,
          subscriptionId: subId ?? null,
        });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(sub);
        if (!userId) break;
        const active =
          sub.status === "active" || sub.status === "trialing";
        await setPlanForUser(userId, active ? "pro" : "free", {
          subscriptionId: active ? sub.id : null,
        });
        break;
      }
      default:
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Handler error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
