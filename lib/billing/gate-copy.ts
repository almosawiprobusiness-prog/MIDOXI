import {
  FEATURE_LABELS,
  PLANS,
  cheapestPlanFor,
  formatPrice,
  type MeteredFeature,
  type PlanId,
} from "./plans";
import type { RoleId } from "@/lib/roles/roles";

/*
  What MIDO says when it will not do the AI thing.

  There is one of these sentences behind every metered feature, and they were
  written five separate times — four of them saying "this is a Pro feature".
  Pro has not existed since the tiers became Free / Player / Touchline / Club,
  so the product was pointing people at a plan they could not buy.

  Two rules, and they are the difference between an upsell and a wall:

  1. NAME THE PLAN AND THE PRICE. "A paid feature" tells someone they cannot
     have it. "Player, $9.99 a month, twenty film reads" tells them what to do.

  2. SAY WHAT STAYS FREE. Every one of these refusals sits next to something
     that still works, and a player who thinks the whole page is locked leaves.

  Client-safe: pure strings over the plan catalogue.
*/

/** What each metered feature is called, and what still works without it. */
const FEATURE_COPY: Record<MeteredFeature, { noun: string; stillFree: string }> = {
  deep_analyses: {
    noun: "Film reads",
    stillFree: "Clips, tags and notes stay free.",
  },
  ai_interactions: {
    noun: "Drafting with MIDO",
    stillFree: "The curated football library is free, and complete.",
  },
  study_discoveries: {
    noun: "Personalised study",
    stillFree: "Every curated study is free, and complete.",
  },
};

function label(feature: MeteredFeature): string {
  return FEATURE_LABELS.find((f) => f.key === feature)?.label ?? feature;
}

/**
 * The plan a person on `role` would have to buy, with what it includes.
 *
 * Keyed on role, not on tier, because the cheapest plan that opens the Coach
 * system is not the cheapest plan overall — telling a coach to buy Player
 * would sell them something that does not open their own product.
 */
export function upgradeReason(feature: MeteredFeature, role: RoleId): string {
  const copy = FEATURE_COPY[feature];
  const plan = cheapestPlanFor(role);
  if (!plan) return `${copy.noun} needs a paid plan. ${copy.stillFree}`;

  const included = plan.entitlements[feature] ?? 0;
  if (included === 0) return `${copy.noun} needs a paid plan. ${copy.stillFree}`;

  /*
    A quoted plan has no monthly number to name, and `formatPrice(0)` would
    cheerfully say "Free" — advertising Managed at nothing. Rule 1 above still
    holds: name the plan and say what to do about it. "Quoted for your club" is
    the honest version of a price when the price is a conversation.
  */
  if (plan.quoted) {
    return `${copy.noun} across a club comes with ${plan.name}, quoted for your squad. ${copy.stillFree}`;
  }

  const price = `${formatPrice(plan.priceCents)}/month`;
  return `${copy.noun} comes with ${plan.name} — ${price}, ${included} ${label(feature).toLowerCase()} a month. ${copy.stillFree}`;
}

/**
 * Used up, rather than not bought. A different sentence on purpose: one is an
 * upsell and the other is "come back", and telling someone to upgrade when
 * they already pay is the fastest way to lose them.
 */
export function quotaReason(feature: MeteredFeature, used: number, limit: number): string {
  const copy = FEATURE_COPY[feature];
  return `You have used all ${limit} of this month's ${label(feature).toLowerCase()} (${used}/${limit}). They reset at the start of next month. ${copy.stillFree}`;
}

export interface Gate {
  allowed: boolean;
  reason: "not_pro" | "quota" | null;
  used: number;
  limit: number;
}

/**
 * The sentence for a gate that has already refused.
 *
 * Callers reach this inside `if (!gate.allowed)`, so it always has something to
 * say — returning `string` rather than `string | null` keeps a fallback that
 * could never be shown out of every call site.
 */
export function refusalReason(gate: Gate, feature: MeteredFeature, role: RoleId): string {
  return gate.reason === "quota"
    ? quotaReason(feature, gate.used, gate.limit)
    : upgradeReason(feature, role);
}

/** Nullable form, for a status check that may or may not have been refused. */
export function gateReason(gate: Gate, feature: MeteredFeature, role: RoleId): string | null {
  return gate.allowed ? null : refusalReason(gate, feature, role);
}

/**
 * What is left, for showing BEFORE someone runs out.
 *
 * A limit a person only discovers by hitting it is not a limit they can plan
 * around — they simply lose the thing they were in the middle of doing.
 */
export function allowanceLabel(feature: MeteredFeature, used: number, limit: number): string | null {
  if (limit <= 0) return null;
  const left = Math.max(0, limit - used);
  const noun = label(feature).toLowerCase();
  if (left === 0) return `No ${noun} left this month`;
  if (left === 1) return `1 ${noun.replace(/s$/, "")} left this month`;
  return `${left} of ${limit} ${noun} left this month`;
}

/** Everything a plan grants, for a pricing or membership surface. */
export function planAllowances(planId: PlanId): { feature: MeteredFeature; label: string; limit: number }[] {
  const e = PLANS[planId]?.entitlements ?? {};
  return (Object.keys(e) as MeteredFeature[]).map((feature) => ({
    feature,
    label: label(feature),
    limit: e[feature] ?? 0,
  }));
}
