import "server-only";
import Stripe from "stripe";
import { env, features } from "@/lib/env";
import { logEvent } from "@/lib/observability/log";
import { createAdminClient } from "@/lib/supabase/server";
import { TIER_CARDS, tierOf, type PlanId } from "./plans";
import type { CheckoutAttribution } from "./attribution";

/*
  Stripe integration — code-first. Every entry point is guarded by
  `features.billing` (both secret + publishable keys present), so the app runs
  and the membership UI renders honestly before any Stripe key is wired.
*/

let _stripe: Stripe | null = null;
export function getStripe(): Stripe | null {
  if (!features.billing) return null;
  if (!_stripe) {
    /*
      Pinned, not left to the SDK's own default.

      stripe-node ships pinned to whatever API version was current when
      that package version was published — currently 2026-07-29 — and
      silently moves to a newer one the next time `stripe` gets bumped
      by a routine `npm update`, with no code change to flag it. That is
      exactly the shape of bug the comment in `upsertSubscription` below
      already describes once: Stripe moved `current_period_end` from the
      subscription to the subscription item, and everything reading the
      old field silently started reading undefined. Pinning here means
      an SDK upgrade can only break loudly, in a diff, not quietly in
      production the next time Stripe ships a version bump.
    */
    _stripe = new Stripe(env.stripeSecret, { apiVersion: "2026-07-29.dahlia" });
  }
  return _stripe;
}

const PRICE_ENV: Record<Exclude<PlanId, "free">, () => string> = {
  player_monthly: () => env.stripePricePlayerMonthly,
  player_annual: () => env.stripePricePlayerAnnual,
  touchline_monthly: () => env.stripePriceTouchlineMonthly,
  touchline_annual: () => env.stripePriceTouchlineAnnual,
  club_monthly: () => env.stripePriceClubMonthly,
  club_annual: () => env.stripePriceClubAnnual,
};

export function priceIdFor(planId: PlanId): string | null {
  if (planId === "free") return null;
  return PRICE_ENV[planId]?.() || null;
}

/** Find or create the Stripe customer for a user, persisting the mapping. */
async function ensureCustomer(userId: string, email: string | null): Promise<string | null> {
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return null;

  const { data: existing } = await admin
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing?.stripe_customer_id) return existing.stripe_customer_id as string;

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { user_id: userId },
  });
  await admin
    .from("billing_customers")
    .upsert({ user_id: userId, stripe_customer_id: customer.id });
  return customer.id;
}

/*
  Turn a Stripe failure into something a person can act on.

  A misconfigured key used to throw all the way out of the server action and
  trip the error boundary — the whole Membership screen replaced by "this
  section could not load", which tells the user nothing and the operator less.
  Stripe's own error types are specific; this passes that specificity through.
*/
function stripeErrorMessage(err: unknown): string {
  const e = err as { type?: string; code?: string; message?: string };
  switch (e?.type) {
    case "StripeAuthenticationError":
      return "Billing is misconfigured — the Stripe secret key was rejected. Nothing has been charged.";
    case "StripeInvalidRequestError":
      return "That plan is not set up correctly in Stripe yet. Nothing has been charged.";
    case "StripeConnectionError":
    case "StripeAPIError":
      return "Stripe could not be reached just now. Nothing has been charged — try again in a moment.";
    case "StripeRateLimitError":
      return "Too many attempts at once. Wait a few seconds and try again.";
    default:
      return "Checkout could not be started. Nothing has been charged.";
  }
}

export async function createCheckoutSession(input: {
  userId: string;
  email: string | null;
  planId: PlanId;
  /**
   * Where this purchase came from (already sanitized — see
   * lib/billing/attribution.ts). Rides Stripe metadata as a source
   * enum plus, at most, a capture UUID in the success URL so the
   * return can deliver the training the player paid for. Never text.
   */
  attribution?: CheckoutAttribution | null;
}): Promise<{ url: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Billing is not configured yet." };
  const price = priceIdFor(input.planId);
  if (!price) return { error: "That plan is not available yet." };

  let customerId: string | null;
  try {
    customerId = await ensureCustomer(input.userId, input.email);
  } catch (err) {
    logEvent("error", "stripe.checkout.customer_failed", { message: (err as Error).message });
    return { error: stripeErrorMessage(err) };
  }
  if (!customerId) return { error: "Could not set up billing account." };

  /*
    The trial is declared on the tier card, so what checkout does and what the
    pricing page promised cannot drift apart. Club has no trial — an
    organisation buying ten seats has a conversation, not a free week.

    A card is still collected up front. It roughly doubles trial-to-paid against
    a no-card trial, and it means the subscription simply begins rather than
    silently lapsing on day eight.
  */
  const trialDays = TIER_CARDS.find((c) => c.tier === tierOf(input.planId))?.trialDays;

  const base = env.appUrl;
  /*
    Attribution: the source enum reaches metadata so the webhook can say
    which funnel produced the purchase; the capture id reaches only the
    success URL, where the membership page uses it to send the player
    straight back to "build the session from this lesson" — the outcome
    they just paid for.
  */
  const metadata: Record<string, string> = { user_id: input.userId, plan_id: input.planId };
  if (input.attribution) metadata.source = input.attribution.source;
  const successUrl =
    `${base}/app/membership?checkout=success` +
    (input.attribution?.captureId ? `&train_capture=${input.attribution.captureId}` : "");
  let session;
  try {
    session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    success_url: successUrl,
    cancel_url: `${base}/app/membership?checkout=cancelled`,
    // Lets FOUNDING50 and any later code be entered at checkout.
    allow_promotion_codes: true,
    subscription_data: {
      ...(trialDays ? { trial_period_days: trialDays } : {}),
      metadata,
    },
    metadata,
    });
  } catch (err) {
    logEvent("error", "stripe.checkout.failed", {
      planId: input.planId,
      type: (err as { type?: string }).type,
      message: (err as Error).message,
    });
    return { error: stripeErrorMessage(err) };
  }

  return session.url ? { url: session.url } : { error: "Could not start checkout." };
}

export async function createPortalSession(input: {
  userId: string;
}): Promise<{ url: string } | { error: string }> {
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return { error: "Billing is not configured yet." };

  const { data } = await admin
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", input.userId)
    .maybeSingle();
  const customerId = data?.stripe_customer_id as string | undefined;
  if (!customerId) return { error: "No billing account found." };

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.appUrl}/app/membership`,
  });
  return { url: session.url };
}

/**
 * Map a Stripe subscription price back to our plan id.
 *
 * Returns `null` when the price is not one we recognise, and the caller must
 * treat that as "do not change the plan". Guessing here would be the worst kind
 * of bug: a price we cannot identify silently becoming the cheapest tier means
 * someone pays for Club and is entitled to Player.
 */
export function planIdForPrice(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const [planId, read] of Object.entries(PRICE_ENV)) {
    const configured = read();
    if (configured && configured === priceId) return planId as PlanId;
  }
  return null;
}
