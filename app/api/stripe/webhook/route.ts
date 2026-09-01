import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env, features } from "@/lib/env";
import { getStripe, planIdForPrice } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/observability/log";
import { tierOf, TIER_CARDS } from "@/lib/billing/plans";
import { recordAccountUpdated, recordTrainerPurchasePaid } from "@/lib/billing/connect";
import { REWARD } from "@/lib/data/referral-types";
import { trackFor } from "@/lib/analytics/track";

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

  await settleReferral(admin, userId, sub, planId);
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
  sub: Stripe.Subscription,
  planId: NonNullable<ReturnType<typeof planIdForPrice>>,
) {
  const status = sub.status;
  try {
    if (status === "active" || status === "trialing") {
      await admin.rpc("convert_referral", {
        p_user: userId,
        p_tier: tierOf(planId),
        p_hold_days: REWARD.holdDays,
      });
      await creditJoiner(admin, userId, sub, planId);
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

/*
  Pay the joiner the free month the signup page promised them.

  "Your first paid month comes with 1 free month" was written on the signup
  screen and delivered to nobody: `ripen_referral_rewards` mints a reward row
  for the referrer and for no one else. Migration 0042 explains why comped
  access cannot fix it — Stripe keeps charging alongside it — so the month is
  paid as money: a negative customer balance transaction, which Stripe applies
  to the next invoice on its own.

  That timing also disposes of the refund risk without a hold. The credit can
  only ever be consumed by an invoice that has not happened yet, so somebody
  who cancels inside the hold window simply never has one — the money stays
  unspent rather than being clawed back.

  Claimed in the database before it is spent in Stripe, and handed back if
  Stripe refuses, so the pair of events Stripe sends on every new subscription
  (created and updated, plus retries) can credit exactly once.
*/
async function creditJoiner(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  sub: Stripe.Subscription,
  planId: NonNullable<ReturnType<typeof planIdForPrice>>,
) {
  const months = REWARD.monthsForJoiner;
  if (months < 1) return;

  const stripe = getStripe();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!stripe || !customerId) return;

  /*
    A month of the tier they actually bought, at that tier's monthly price —
    read from the canonical plan cards rather than the price they happen to be
    paying, so an annual subscriber gets a month rather than a twelfth of one.
  */
  const monthlyCents = TIER_CARDS.find((c) => c.tier === tierOf(planId))?.monthlyCents ?? 0;
  const amount = monthlyCents * months;
  if (amount <= 0) return;

  const currency = sub.items.data[0]?.price?.currency ?? "usd";

  const { data } = await admin.rpc("claim_joiner_credit", { p_user: userId });
  if ((data as { claimed?: boolean } | null)?.claimed !== true) return;

  try {
    await stripe.customers.createBalanceTransaction(
      customerId,
      {
        // Negative is a credit: it reduces what the next invoice asks for.
        amount: -amount,
        currency,
        description: `MIDO XI referral — ${months} free month`,
        metadata: { kind: "referral_joiner_credit", user_id: userId, plan_id: planId },
      },
      { idempotencyKey: `referral-joiner-credit-${userId}` },
    );
    logEvent("info", "stripe.webhook.referral_joiner_credited", {
      userId,
      planId,
      amount,
      currency,
    });
  } catch (err) {
    /*
      Give the claim back. Keeping it would mark the month paid on the strength
      of a call that failed, and the joiner would never see the credit — the
      exact silent non-delivery this whole change exists to end.
    */
    try {
      await admin.rpc("release_joiner_credit", { p_user: userId });
    } catch {
      // Both calls failing leaves the claim set and the month unpaid; the log
      // below is what makes that visible rather than silent.
    }
    logEvent("error", "stripe.webhook.referral_joiner_credit_failed", {
      userId,
      planId,
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
          /*
            Capture → Training attribution: the purchase closed and it
            began at a saved lesson. `trackFor` because a webhook has no
            user session and the RLS insert path would silently no-op.
            After the entitlement write, so a tracking hiccup can never
            make Stripe retry a recorded subscription.
          */
          if (session.metadata?.source === "capture_training" && session.metadata.user_id) {
            await trackFor(session.metadata.user_id, "capture_training_purchase_completed", {
              plan: session.metadata.plan_id ?? "unknown",
            });
          }
        } else if (session.metadata?.kind === "trainer_product") {
          /*
            Gated on payment_status, per Stripe's fulfillment rule: an
            async payment method (bank debit) completes the SESSION
            before the money moves. "paid" flips the row now; anything
            else waits for async_payment_succeeded below. Same
            throw-to-retry contract as above.
          */
          if (session.payment_status === "paid") {
            await recordTrainerPurchasePaid(session);
          }
        }
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.kind === "trainer_product") {
          await recordTrainerPurchasePaid(session);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await upsertSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "account.updated": {
        // A Connect account's capabilities changed (verification
        // finished, payouts enabled). Mirror Stripe's answer.
        await recordAccountUpdated(event.data.object as Stripe.Account);
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
