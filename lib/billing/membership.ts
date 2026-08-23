import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import {
  PLANS,
  isProPlan,
  type PlanId,
  type MeteredFeature,
  type Entitlements,
} from "./plans";

export interface Membership {
  planId: PlanId;
  isPro: boolean;
  status: string; // stripe status, 'demo', 'comped', or 'free'
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  entitlements: Entitlements;
  /** Set when this access was earned by referring people, not paid for. */
  comped: { source: string; endsAt: string } | null;
}

const FREE: Membership = {
  planId: "free",
  isPro: false,
  status: "free",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  entitlements: PLANS.free.entitlements,
  comped: null,
};

/** A status counts as an active Pro subscription. */
function activeStatus(s: string): boolean {
  return s === "active" || s === "trialing" || s === "past_due";
}

export async function getMembership(): Promise<Membership> {
  if (isDemoMode) {
    // Demo has no billing backend — everyone is on the free OS.
    return { ...FREE, status: "demo" };
  }

  const supabase = await createClient();
  if (!supabase) return FREE;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return FREE;

  const { data } = await supabase
    .from("subscriptions")
    .select("plan_id, status, current_period_end, cancel_at_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data || !activeStatus(String(data.status))) {
    // No paid subscription — but months earned by referring people are real
    // access, so they are checked before falling back to free.
    return (await compedMembership(supabase)) ?? FREE;
  }

  const planId = (data.plan_id as PlanId) ?? "free";
  const plan = PLANS[planId] ?? PLANS.free;
  return {
    planId,
    isPro: isProPlan(planId),
    status: String(data.status),
    currentPeriodEnd: (data.current_period_end as string) ?? null,
    cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
    entitlements: plan.entitlements,
    comped: null,
  };
}

/*
  Referral months, redeemed as access.

  A reward that only changed a number on a dashboard would be a fake reward, so
  a spent month writes a `comped_access` window and this reads it back as a real
  entitlement — same shape, same metering, same ceilings as a paid plan. It is
  labelled `comped` rather than `active` so the membership page can say plainly
  where the access came from and when it runs out.
*/
async function compedMembership(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
): Promise<Membership | null> {
  const { data } = await supabase
    .from("comped_access")
    .select("tier, source, ends_at")
    .gt("ends_at", new Date().toISOString())
    .order("ends_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  /*
    A comped window records the tier it granted. Referral rewards grant
    `player`, which is what a free month of MIDO XI means; the column allows
    richer grants later without changing this read.
  */
  const granted = String(data.tier);
  const planId: PlanId =
    granted === "club" ? "club_monthly"
    : granted === "touchline" ? "touchline_monthly"
    : "player_monthly";
  return {
    planId,
    isPro: true,
    status: "comped",
    currentPeriodEnd: String(data.ends_at),
    cancelAtPeriodEnd: true,
    entitlements: PLANS[planId].entitlements,
    comped: { source: String(data.source ?? "referral"), endsAt: String(data.ends_at) },
  };
}

/** First day of the current usage period (calendar month), as a date string. */
export function currentPeriodStart(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export type UsageMap = Partial<Record<MeteredFeature, number>>;

/** Counters used so far this period. */
export async function getUsage(): Promise<UsageMap> {
  if (isDemoMode) return demoUsage();
  const supabase = await createClient();
  if (!supabase) return {};
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const { data } = await supabase
    .from("usage_periods")
    .select("counters")
    .eq("user_id", user.id)
    .eq("period_start", currentPeriodStart())
    .maybeSingle();
  return ((data?.counters as UsageMap) ?? {}) as UsageMap;
}

export interface FeatureUsage {
  feature: MeteredFeature;
  used: number;
  limit: number; // 0 when the plan doesn't include the feature
  remaining: number;
  unlimited: boolean;
}

export interface MembershipOverview {
  membership: Membership;
  usage: FeatureUsage[];
}

export async function getMembershipOverview(): Promise<MembershipOverview> {
  const [membership, used] = await Promise.all([getMembership(), getUsage()]);
  const features = Object.keys(membership.entitlements) as MeteredFeature[];
  // When on free, still surface the Pro allowances as locked (limit 0).
  const keys = features.length
    ? features
    : (["study_discoveries", "deep_analyses", "ai_interactions"] as MeteredFeature[]);
  const usage: FeatureUsage[] = keys.map((feature) => {
    const limit = membership.entitlements[feature] ?? 0;
    const u = used[feature] ?? 0;
    return { feature, used: u, limit, remaining: Math.max(0, limit - u), unlimited: false };
  });
  return { membership, usage };
}

/**
 * Is the current user allowed to consume one unit of a metered feature right
 * now? Pro-gated + quota-checked. Read-only (does not consume).
 */
export async function checkFeature(
  feature: MeteredFeature,
): Promise<{ allowed: boolean; reason: "not_pro" | "quota" | null; used: number; limit: number }> {
  const membership = await getMembership();
  const limit = membership.entitlements[feature] ?? 0;
  if (!membership.isPro || limit <= 0) return { allowed: false, reason: "not_pro", used: 0, limit };
  const used = (await getUsage())[feature] ?? 0;
  if (used >= limit) return { allowed: false, reason: "quota", used, limit };
  return { allowed: true, reason: null, used, limit };
}

// ---- demo in-memory usage (so the meters move without a DB) ----
const g = globalThis as unknown as { __midoDemoUsage?: UsageMap };
function demoUsage(): UsageMap {
  return (g.__midoDemoUsage ??= {});
}
export function bumpDemoUsage(feature: MeteredFeature) {
  const u = demoUsage();
  u[feature] = (u[feature] ?? 0) + 1;
}

/** The refund path's demo counterpart. Never goes below zero. */
export function dropDemoUsage(feature: MeteredFeature) {
  const u = demoUsage();
  u[feature] = Math.max(0, (u[feature] ?? 0) - 1);
}
