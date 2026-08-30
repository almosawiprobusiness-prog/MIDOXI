import "server-only";
import type Stripe from "stripe";
import { env, features, isDemoMode } from "@/lib/env";
import { getStripe } from "./stripe";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { listAthletes } from "@/lib/data/trainer";
import { applicationFeeCents, connectFeeBps, PRODUCT_MAX_CENTS, PRODUCT_MIN_CENTS } from "./connect-fee";
import { logEvent } from "@/lib/observability/log";

/*
  Stripe Connect for the Lab — Express accounts, destination charges.

  The shape of trust here mirrors the subscription webhook: STRIPE IS
  THE SOURCE OF TRUTH about money, and every row in trainer_accounts /
  trainer_purchases is a mirror of something Stripe just said — written
  with the service role, never by a browser. MIDO XI itself never sees
  bank details (Express onboarding is Stripe-hosted) and never moves
  money outside a Stripe object with a Stripe receipt.

  Fee policy: Option B — see connect-fee.ts. The fee is computed from
  the trainer's ACTIVE roster at link creation and frozen into the
  purchase row; the metadata carries only ids, the row carries the
  money facts.
*/

export interface TrainerAccount {
  stripeAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export interface TrainerProduct {
  id: string;
  title: string;
  amountCents: number;
  currency: string;
  active: boolean;
}

export interface TrainerPurchase {
  id: string;
  productTitle: string | null;
  amountCents: number;
  feeCents: number;
  feeBps: number;
  status: "pending" | "paid" | "expired" | "refunded";
  createdAt: string;
  paidAt: string | null;
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** The mirror row, or null when onboarding has never started. */
export async function getTrainerAccount(): Promise<TrainerAccount | null> {
  if (isDemoMode) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("trainer_accounts")
    .select("stripe_account_id, charges_enabled, payouts_enabled, details_submitted")
    .maybeSingle();
  if (!data) return null;
  return {
    stripeAccountId: data.stripe_account_id as string,
    chargesEnabled: Boolean(data.charges_enabled),
    payoutsEnabled: Boolean(data.payouts_enabled),
    detailsSubmitted: Boolean(data.details_submitted),
  };
}

/**
 * Ask Stripe what the account can do now, and mirror the answer.
 * Called on Lab page load once an account exists — the flags change
 * on Stripe's side (verification finishing) with no request from us.
 */
export async function refreshTrainerAccount(): Promise<TrainerAccount | null> {
  const existing = await getTrainerAccount();
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!existing || !stripe || !admin) return existing;

  try {
    const acct = await stripe.accounts.retrieve(existing.stripeAccountId);
    const next: TrainerAccount = {
      stripeAccountId: existing.stripeAccountId,
      chargesEnabled: Boolean(acct.charges_enabled),
      payoutsEnabled: Boolean(acct.payouts_enabled),
      detailsSubmitted: Boolean(acct.details_submitted),
    };
    const userId = await currentUserId();
    if (userId) {
      await admin.from("trainer_accounts").update({
        charges_enabled: next.chargesEnabled,
        payouts_enabled: next.payoutsEnabled,
        details_submitted: next.detailsSubmitted,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
    }
    return next;
  } catch (err) {
    // Stripe unreachable: the mirror stands; the page renders what we knew.
    logEvent("warn", "connect.refresh_failed", { message: (err as Error).message });
    return existing;
  }
}

export type ConnectResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Start (or resume) Express onboarding. Returns the Stripe-hosted URL
 * the trainer finishes identity and bank details on — MIDO XI never
 * sees either.
 */
export async function startConnectOnboarding(): Promise<ConnectResult<{ url: string }>> {
  if (!features.billing) return { ok: false, error: "Payments are not configured on this deployment." };
  const stripe = getStripe();
  const admin = createAdminClient();
  const userId = await currentUserId();
  if (!stripe || !admin || !userId) return { ok: false, error: "You must be signed in." };

  let account = await getTrainerAccount();

  try {
    if (!account) {
      const created = await stripe.accounts.create({
        type: "express",
        metadata: { user_id: userId },
      });
      const { error } = await admin.from("trainer_accounts").insert({
        user_id: userId,
        stripe_account_id: created.id,
      });
      if (error) {
        logEvent("error", "connect.account_record_failed", { message: error.message });
        return { ok: false, error: "The account could not be recorded. Nothing was charged." };
      }
      account = {
        stripeAccountId: created.id,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      };
    }

    const link = await stripe.accountLinks.create({
      account: account.stripeAccountId,
      type: "account_onboarding",
      refresh_url: `${env.appUrl}/app/payments`,
      return_url: `${env.appUrl}/app/payments`,
    });
    return { ok: true, data: { url: link.url } };
  } catch (err) {
    logEvent("error", "connect.onboarding_failed", { message: (err as Error).message });
    return { ok: false, error: "Stripe could not start onboarding just now." };
  }
}

export async function listTrainerProducts(): Promise<TrainerProduct[]> {
  if (isDemoMode) {
    return [
      { id: "tp_demo1", title: "1-to-1 session", amountCents: 6000, currency: "usd", active: true },
      { id: "tp_demo2", title: "6-session block", amountCents: 30000, currency: "usd", active: true },
    ];
  }
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("trainer_products")
    .select("id, title, amount_cents, currency, active")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    amountCents: r.amount_cents as number,
    currency: r.currency as string,
    active: Boolean(r.active),
  }));
}

export async function listTrainerPurchases(limit = 20): Promise<TrainerPurchase[]> {
  if (isDemoMode) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("trainer_purchases")
    .select("id, amount_cents, fee_cents, fee_bps, status, created_at, paid_at, trainer_products(title)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    productTitle:
      (r.trainer_products as { title?: string } | null)?.title ?? null,
    amountCents: r.amount_cents as number,
    feeCents: r.fee_cents as number,
    feeBps: r.fee_bps as number,
    status: r.status as TrainerPurchase["status"],
    createdAt: r.created_at as string,
    paidAt: (r.paid_at as string) ?? null,
  }));
}

/** How many athletes count toward the fee tier, right now. */
export async function activeAthleteCount(): Promise<number> {
  const athletes = await listAthletes().catch(() => []);
  return athletes.filter((a) => a.status === "active").length;
}

/**
 * A Checkout link for one product — the thing the trainer sends.
 *
 * The purchase row is written FIRST (pending, fee frozen), then the
 * session is created carrying only ids in metadata; the webhook flips
 * the row to paid off checkout.session.completed. A destination
 * charge on the platform account means the existing webhook endpoint
 * receives that event with no extra Connect configuration.
 */
export async function createPaymentLink(
  productId: string,
): Promise<ConnectResult<{ url: string; feeCents: number; feeBps: number }>> {
  if (!features.billing) return { ok: false, error: "Payments are not configured on this deployment." };
  const stripe = getStripe();
  const admin = createAdminClient();
  const supabase = await createClient();
  const userId = await currentUserId();
  if (!stripe || !admin || !supabase || !userId) return { ok: false, error: "You must be signed in." };

  const account = await getTrainerAccount();
  if (!account?.chargesEnabled) {
    return { ok: false, error: "Finish Stripe onboarding first — charges are not enabled yet." };
  }

  // RLS scopes this read to the owner, so a foreign productId comes back null.
  const { data: product } = await supabase
    .from("trainer_products")
    .select("id, title, amount_cents, currency, active")
    .eq("id", productId)
    .maybeSingle();
  if (!product || !product.active) return { ok: false, error: "That product does not exist or is inactive." };

  const amount = product.amount_cents as number;
  if (amount < PRODUCT_MIN_CENTS || amount > PRODUCT_MAX_CENTS) {
    return { ok: false, error: "The product's price is out of bounds." };
  }

  const athletes = await activeAthleteCount();
  const feeBps = connectFeeBps(athletes);
  const feeCents = applicationFeeCents(amount, athletes);

  const { data: purchase, error: purchaseErr } = await admin
    .from("trainer_purchases")
    .insert({
      trainer_id: userId,
      product_id: product.id,
      amount_cents: amount,
      fee_cents: feeCents,
      fee_bps: feeBps,
    })
    .select("id")
    .single();
  if (purchaseErr) {
    logEvent("error", "connect.purchase_record_failed", { message: purchaseErr.message });
    return { ok: false, error: "The payment could not be recorded. No link was created." };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: product.currency as string,
            unit_amount: amount,
            product_data: { name: product.title as string },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: feeCents,
        transfer_data: { destination: account.stripeAccountId },
      },
      metadata: {
        kind: "trainer_product",
        purchase_id: purchase.id as string,
        trainer_id: userId,
      },
      success_url: `${env.appUrl}/pay/done`,
      cancel_url: `${env.appUrl}/pay/done?cancelled=1`,
    });

    await admin
      .from("trainer_purchases")
      .update({ checkout_session_id: session.id })
      .eq("id", purchase.id as string);

    if (!session.url) return { ok: false, error: "Stripe returned no payment URL." };
    return { ok: true, data: { url: session.url, feeCents, feeBps } };
  } catch (err) {
    // The pending row without a session id is inert; nothing was charged.
    logEvent("error", "connect.checkout_failed", { message: (err as Error).message });
    return { ok: false, error: "Stripe could not create the payment link just now." };
  }
}

/**
 * Webhook half: a trainer-product Checkout finished. Flip the frozen
 * purchase row to paid. Throwing makes the webhook 500 so Stripe
 * retries — the same contract the subscription mirror keeps.
 */
export async function recordTrainerPurchasePaid(session: Stripe.Checkout.Session): Promise<void> {
  const admin = createAdminClient();
  if (!admin) throw new Error("No admin client; cannot record the payment");

  const purchaseId = session.metadata?.purchase_id;
  if (!purchaseId) {
    logEvent("error", "connect.webhook_no_purchase_id", { session: session.id });
    throw new Error("trainer_product session carries no purchase_id");
  }

  const { error } = await admin
    .from("trainer_purchases")
    .update({ status: "paid", paid_at: new Date().toISOString(), checkout_session_id: session.id })
    .eq("id", purchaseId);
  if (error) throw new Error(`Could not mark purchase paid: ${error.message}`);

  logEvent("info", "connect.purchase_paid", { purchaseId, session: session.id });
}

/** Webhook half: a Connect account's capabilities changed. Mirror it. */
export async function recordAccountUpdated(account: Stripe.Account): Promise<void> {
  const admin = createAdminClient();
  if (!admin) throw new Error("No admin client; cannot mirror the account");
  const { error } = await admin
    .from("trainer_accounts")
    .update({
      charges_enabled: Boolean(account.charges_enabled),
      payouts_enabled: Boolean(account.payouts_enabled),
      details_submitted: Boolean(account.details_submitted),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", account.id);
  if (error) throw new Error(`Could not mirror account: ${error.message}`);
}
