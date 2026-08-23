import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env, features } from "@/lib/env";
import { getStripe, planIdForPrice } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/observability/log";
import { tierOf } from "@/lib/billing/plans";
import { REWARD } from "@/lib/data/referral-types";

/*
  Stripe webhook. Stripe is the source of truth for subscription state — we
  mirror it into `subscriptions` via the service-role client on each event.
  Signature is verified against STRIPE_WEBHOOK_SECRET; unverified bodies are
  rejected.
*/

async function resolveUserId(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  sub: Stripe.Subscription,
): Promise<string | null> {
  const fromMeta = sub.metadata?.user_id;
  if (fromMeta) return fromMeta;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return null;
  const { data } = await admin
    .from("billing_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data?.user_id as string) ?? null;
}

/*
  Mirror a Stripe subscription into our database.

  Every failure path here used to `return` silently, so a payment Stripe had
  accepted could vanish with no trace. That is exactly what happened: migration
  0013 emptied `subscription_plans`, which `subscriptions.plan_id` references,
  so every write failed on a foreign key — and because the upsert's error was
  never read, the webhook answered 200 and Stripe recorded a clean delivery.

  Now nothing fails quietly. Anything that stops the mirror is logged, and a
  write failure **throws**, so the route answers 500 and Stripe retries — which
  is the whole point of it having a retry schedule.
*/
async function upsertSubscription(sub: Stripe.Subscription) {
  const admin = createAdminClient();
  if (!admin) {
    logEvent("error", "stripe.webhook.no_admin_client", {
      subscription: sub.id,
      hint: "SUPABASE_SERVICE_ROLE_KEY missing — the subscription cannot be recorded",
    });
    throw new Error("No admin client; cannot record subscription");
  }

  const userId = await resolveUserId(admin, sub);
  if (!userId) {
    logEvent("error", "stripe.webhook.no_user", {
      subscription: sub.id,
      customer: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
      hint: "No user_id in metadata and no billing_customers row for this customer",
    });
    throw new Error("Could not resolve the user for this subscription");
  }

  const priceId = sub.items.data[0]?.price?.id ?? null;
  const periodEnd = sub.items.data[0]?.current_period_end ?? null;
  const planId = planIdForPrice(priceId);
  if (!planId) {
    /*
      A price we do not recognise. Refusing is the only safe move: writing a
      guess would entitle the customer to whatever we guessed, and the cheapest
      guess means someone pays for Club and gets Player. Loud, because it means
      a price exists in Stripe that no env var points at.
    */
    logEvent("error", "stripe.webhook.unknown_price", { priceId, subscription: sub.id });
    return;
  }

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan_id: planId,
      status: sub.status,
      stripe_subscription_id: sub.id,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    /*
      Throwing rather than returning is deliberate. A 200 here tells Stripe the
      event was handled and it will never send it again — so a customer who paid
      stays on the free tier forever, and the only symptom is that nobody
      complains until they do. A 500 gets it retried.
    */
    logEvent("error", "stripe.webhook.subscription_write_failed", {
      userId,
      planId,
      subscription: sub.id,
      code: error.code,
      message: error.message,
      hint:
        error.code === "23503"
          ? "Foreign key: subscription_plans has no row for this plan_id. Run migration 0014."
          : undefined,
    });
    throw new Error(`Could not record subscription: ${error.message}`);
  }

  logEvent("info", "stripe.webhook.subscription_recorded", { userId, planId, status: sub.status });

  await settleReferral(admin, userId, sub.status, planId);
}

/*
  The referral programme's only source of truth about money.

  `convert_referral` and `void_referral` are revoked from every client role on
  purpose: "this person started paying" is a claim only Stripe gets to make, so
  it is made here, with the service key, off a signed webhook. The conversion is
  held for REWARD.holdDays before it becomes a reward, so a refund inside the
  hold reverses it instead of paying it.
*/
async function settleReferral(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  status: Stripe.Subscription.Status,
  planId: NonNullable<ReturnType<typeof planIdForPrice>>,
) {
  try {
    if (status === "active" || status === "trialing") {
      await admin.rpc("convert_referral", {
        p_user: userId,
        p_tier: tierOf(planId),
        p_hold_days: REWARD.holdDays,
      });
    } else if (status === "canceled" || status === "incomplete_expired" || status === "unpaid") {
      await admin.rpc("void_referral", { p_user: userId, p_reason: status });
    }
  } catch (err) {
    // A referral that fails to settle must never fail the subscription mirror —
    // the money is the part that matters, and ripening is idempotent and
    // retried whenever the referrer opens their dashboard.
    logEvent("warn", "stripe.webhook.referral_settle_failed", {
      message: (err as Error).message,
    });
  }
}

export async function POST(req: Request) {
  if (!features.billing) {
    return NextResponse.json({ error: "billing not configured" }, { status: 503 });
  }
  const stripe = getStripe();
  if (!stripe || !env.stripeWebhookSecret) {
    return NextResponse.json({ error: "billing not configured" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.stripeWebhookSecret);
  } catch (err) {
    logEvent("warn", "stripe.webhook.bad_signature", { message: (err as Error).message });
    return NextResponse.json({ error: `invalid signature: ${(err as Error).message}` }, { status: 400 });
  }

  logEvent("info", "stripe.webhook.received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subId =
            typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await upsertSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await upsertSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    logEvent("error", "stripe.webhook.handler_failed", { type: event.type, message: (err as Error).message });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
