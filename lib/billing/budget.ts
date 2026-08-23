import "server-only";
import { env, isDemoMode } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

/*
  Global AI budget cap. A hard ceiling on Claude spend per calendar month,
  summed from ai_usage_events. Once crossed, the AI path is switched off for
  everyone (the heuristic Study Engine keeps working) until the next month or a
  raised cap. This is the ops safety net on top of per-user Pro metering.

  Spend is cached briefly so the check is effectively free on the render path;
  logAiUsage invalidates the cache so the cap reacts within one call.
*/

const CACHE_TTL_MS = 60_000;
const g = globalThis as unknown as { __midoAiSpend?: { at: number; spend: number } };
const cache = (g.__midoAiSpend ??= { at: 0, spend: 0 });

/** Configured ceiling in USD (0 = no cap). */
export function aiBudgetLimit(): number {
  return env.aiMonthlyBudgetUsd;
}

/** Force a re-read on the next spend query. */
export function invalidateAiSpend(): void {
  cache.at = 0;
}

function monthStartISO(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

/** Cumulative estimated Claude spend (USD) this calendar month. */
export async function getAiMonthlySpend(): Promise<number> {
  if (isDemoMode) return 0;
  if (Date.now() - cache.at < CACHE_TTL_MS) return cache.spend;
  const admin = createAdminClient();
  if (!admin) return 0;
  try {
    const { data } = await admin
      .from("ai_usage_events")
      .select("estimated_cost_usd")
      .gte("created_at", monthStartISO())
      .limit(20000);
    const spend = (data ?? []).reduce((s, r) => s + (Number(r.estimated_cost_usd) || 0), 0);
    cache.at = Date.now();
    cache.spend = spend;
    return spend;
  } catch {
    return cache.spend; // fail open to the last known value
  }
}

/** True when AI calls are still under the monthly ceiling (or no cap set). */
export async function withinAiBudget(): Promise<boolean> {
  const limit = aiBudgetLimit();
  if (limit <= 0) return true;
  return (await getAiMonthlySpend()) < limit;
}

export interface AiBudgetStatus {
  limit: number;
  spend: number;
  capped: boolean;
  /** 0–100; 0 when no cap configured. */
  pct: number;
}

export async function aiBudgetStatus(): Promise<AiBudgetStatus> {
  const limit = aiBudgetLimit();
  if (limit <= 0) return { limit: 0, spend: 0, capped: false, pct: 0 };
  const spend = await getAiMonthlySpend();
  return {
    limit,
    spend: Number(spend.toFixed(4)),
    capped: spend >= limit,
    pct: Math.min(100, Math.round((spend / limit) * 100)),
  };
}
