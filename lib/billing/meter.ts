import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { checkFeature, currentPeriodStart, bumpDemoUsage, dropDemoUsage } from "./membership";
import { invalidateAiSpend } from "./budget";
import { estimateCostUsd, type AiTier } from "@/lib/ai/pricing";
import type { MeteredFeature } from "./plans";

/*
  Metering. Entitlement writes bypass RLS (usage_periods is owner-readable only)
  so they run through the service-role client. All functions are best-effort and
  never throw — a metering hiccup must not break a feature.
*/

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Gate + consume one unit of a metered feature. Returns true only when the user
 * is Pro, within quota, and the counter was incremented. Callers run the paid
 * work only when this resolves true.
 */
export async function consumeFeature(feature: MeteredFeature): Promise<boolean> {
  const gate = await checkFeature(feature);
  if (!gate.allowed) return false;

  if (isDemoMode) {
    bumpDemoUsage(feature);
    return true;
  }

  const userId = await currentUserId();
  if (!userId) return false;
  const admin = createAdminClient();
  if (!admin) return false;

  const period = currentPeriodStart();
  const { data: existing } = await admin
    .from("usage_periods")
    .select("id, counters")
    .eq("user_id", userId)
    .eq("period_start", period)
    .maybeSingle();

  const counters = { ...(existing?.counters as Record<string, number> | null ?? {}) };
  counters[feature] = (counters[feature] ?? 0) + 1;

  if (existing) {
    await admin.from("usage_periods").update({ counters }).eq("id", existing.id);
  } else {
    // period_end = last day of the month
    const d = new Date();
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    await admin.from("usage_periods").insert({
      user_id: userId,
      period_start: period,
      period_end: end.toISOString().slice(0, 10),
      counters,
    });
  }
  return true;
}

/*
  Give a consumed unit back.

  A metered feature is consumed BEFORE the paid work runs, because the
  alternative is doing the work and then discovering the user could not afford
  it. That is the right order, and it leaves one hole: work that is charged for
  and then fails for a reason the user had nothing to do with.

  This is not hypothetical. The video model's free tier allows 20 requests per
  window; hit that and the player loses one of their twenty film reads for the
  MONTH and gets an error back. The same applies when a model is unreachable or
  an upload fails.

  So: refund whenever the failure is ours. Never refund a failure that is the
  answer — a read that came back empty, or footage MIDO genuinely could not use,
  did the work and cost the money.

  Deliberately cannot go below zero, and deliberately best-effort: a failed
  refund must not turn one bad response into two.
*/
export async function releaseFeature(feature: MeteredFeature): Promise<void> {
  if (isDemoMode) {
    dropDemoUsage(feature);
    return;
  }

  try {
    const userId = await currentUserId();
    if (!userId) return;
    const admin = createAdminClient();
    if (!admin) return;

    const period = currentPeriodStart();
    const { data: existing } = await admin
      .from("usage_periods")
      .select("id, counters")
      .eq("user_id", userId)
      .eq("period_start", period)
      .maybeSingle();
    if (!existing) return;

    const counters = { ...(existing.counters as Record<string, number> | null ?? {}) };
    counters[feature] = Math.max(0, (counters[feature] ?? 0) - 1);
    await admin.from("usage_periods").update({ counters }).eq("id", existing.id);
  } catch {
    // A refund that fails leaves the user one unit down. Worth logging one day;
    // never worth throwing over, since we are already handling an error.
  }
}

/** Best-effort telemetry for an AI call — powers the economics dashboard. */
export async function logAiUsage(input: {
  feature: MeteredFeature | string;
  tier: AiTier;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  latencyMs?: number;
  cached?: boolean;
  status?: "ok" | "error";
}): Promise<void> {
  if (isDemoMode) return;
  try {
    const userId = await currentUserId();
    if (!userId) return;
    const admin = createAdminClient();
    if (!admin) return;
    const estCost = estimateCostUsd(input);
    await admin.from("ai_usage_events").insert({
      user_id: userId,
      feature: input.feature,
      model: input.model ?? null,
      // Cache reads are input tokens the model saw, so they belong in the input
      // count; the cost column is what separates them.
      input_tokens: (input.inputTokens ?? 0) + (input.cacheReadTokens ?? 0),
      output_tokens: input.outputTokens ?? 0,
      estimated_cost_usd: Number(estCost.toFixed(5)),
      latency_ms: input.latencyMs ?? null,
      status: input.status ?? "ok",
      cached: input.cached ?? (input.cacheReadTokens ?? 0) > 0,
    });
    // Reflect the new spend in the budget cap on the next check.
    invalidateAiSpend();
  } catch {
    // telemetry is never load-bearing
  }
}
