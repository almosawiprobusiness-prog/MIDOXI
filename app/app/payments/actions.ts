"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { startConnectOnboarding, createPaymentLink } from "@/lib/billing/connect";
import { PRODUCT_MAX_CENTS, PRODUCT_MIN_CENTS } from "@/lib/billing/connect-fee";
import { track } from "@/lib/analytics/track";

export type Result<T = undefined> =
  | { ok: true; data?: T; demo?: boolean }
  | { ok: false; error: string };

/** Kick off (or resume) Stripe-hosted Express onboarding. */
export async function beginOnboarding(): Promise<Result<{ url: string }>> {
  if (isDemoMode) {
    return { ok: false, error: "Demo mode never touches Stripe — this flow needs a real account." };
  }
  const res = await startConnectOnboarding();
  if (!res.ok) return res;
  await track("trainer_onboarding_started", {});
  return { ok: true, data: { url: res.data.url } };
}

export async function createProduct(input: { title: string; amountCents: number }): Promise<Result> {
  const title = input.title?.trim() ?? "";
  if (title.length < 3) return { ok: false, error: "Give it a name a client would recognise." };
  const amount = Math.round(input.amountCents);
  if (!Number.isFinite(amount) || amount < PRODUCT_MIN_CENTS || amount > PRODUCT_MAX_CENTS) {
    return { ok: false, error: "Price must be between $1 and $5,000." };
  }

  if (isDemoMode) return { ok: true, demo: true };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "You must be signed in." };
  const { error } = await supabase
    .from("trainer_products")
    .insert({ title, amount_cents: amount });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/payments");
  return { ok: true };
}

export async function deactivateProduct(id: string): Promise<Result> {
  if (isDemoMode) return { ok: true, demo: true };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "You must be signed in." };
  const { error } = await supabase.from("trainer_products").update({ active: false }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/payments");
  return { ok: true };
}

/** The Checkout URL the trainer sends, with the fee they saw frozen in. */
export async function makePaymentLink(
  productId: string,
): Promise<Result<{ url: string; feeCents: number; feeBps: number }>> {
  if (isDemoMode) {
    return { ok: false, error: "Demo mode never touches Stripe — links need a real account." };
  }
  const res = await createPaymentLink(productId);
  if (!res.ok) return res;
  await track("trainer_payment_link_created", { feeBps: res.data.feeBps });
  revalidatePath("/app/payments");
  return { ok: true, data: res.data };
}
