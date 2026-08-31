"use server";

import { features } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";
import { createCheckoutSession, createPortalSession } from "@/lib/billing/stripe";
import { sanitizeCheckoutAttribution } from "@/lib/billing/attribution";
import { track } from "@/lib/analytics/track";
import type { PlanId } from "@/lib/billing/plans";

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

export async function startCheckout(
  planId: PlanId,
  rawAttribution?: { source?: string; captureId?: string },
): Promise<CheckoutResult> {
  if (!features.billing) {
    return { ok: false, error: "Pro isn’t live yet — billing is being wired up. Check back soon." };
  }
  const user = await getCurrentUser();
  if (!user || user.isDemo) {
    return { ok: false, error: "Sign in to upgrade." };
  }
  // Client-supplied, so re-sanitized here — a server action's arguments
  // are as forgeable as a form field.
  const attribution = rawAttribution ? sanitizeCheckoutAttribution(rawAttribution) : null;
  const res = await createCheckoutSession({ userId: user.id, email: user.email, planId, attribution });
  if ("error" in res) return { ok: false, error: res.error };
  if (attribution?.source === "capture_training") {
    await track("capture_training_checkout_started", { plan: planId });
  }
  return { ok: true, url: res.url };
}

export async function openBillingPortal(): Promise<CheckoutResult> {
  if (!features.billing) {
    return { ok: false, error: "Billing is not configured yet." };
  }
  const user = await getCurrentUser();
  if (!user || user.isDemo) return { ok: false, error: "Sign in to manage billing." };
  const res = await createPortalSession({ userId: user.id });
  if ("error" in res) return { ok: false, error: res.error };
  return { ok: true, url: res.url };
}
