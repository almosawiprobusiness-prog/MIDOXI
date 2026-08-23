import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { aiBudgetStatus, type AiBudgetStatus } from "@/lib/billing/budget";

/*
  Admin observability aggregates. Read through the service-role client (these
  span all users, past RLS). Every query is defensive: a failure degrades that
  metric to zero rather than 500-ing the dashboard.
*/

export interface AdminOverview {
  available: boolean;
  users: { total: number; new7d: number };
  subscriptions: { activePro: number; byPlan: Record<string, number>; mrrCents: number };
  ai: {
    calls30d: number;
    errors30d: number;
    tokens30d: number;
    costUsd30d: number;
    cacheRate: number;
    byFeature: { feature: string; calls: number; costUsd: number }[];
  };
  aiBudget: AiBudgetStatus;
}

const EMPTY: AdminOverview = {
  available: false,
  users: { total: 0, new7d: 0 },
  subscriptions: { activePro: 0, byPlan: {}, mrrCents: 0 },
  ai: { calls30d: 0, errors30d: 0, tokens30d: 0, costUsd30d: 0, cacheRate: 0, byFeature: [] },
  aiBudget: { limit: 0, spend: 0, capped: false, pct: 0 },
};

/*
  Every paid plan's monthly-equivalent revenue, derived from the catalogue
  rather than listed by hand — a tier added to PLANS and forgotten here would
  quietly vanish from MRR.
*/
const MONTHLY_CENTS: Record<string, number> = Object.fromEntries(
  Object.values(PLANS)
    .filter((p) => p.priceCents > 0)
    .map((p) => [p.id, p.interval === "year" ? Math.round(p.priceCents / 12) : p.priceCents]),
);

export async function getAdminOverview(): Promise<AdminOverview> {
  const admin = createAdminClient();
  if (!admin) return EMPTY;

  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const overview: AdminOverview = { ...EMPTY, available: true };

  // ---- users ----
  try {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
    overview.users.total = count ?? 0;
    const { count: recent } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since7);
    overview.users.new7d = recent ?? 0;
  } catch {
    /* leave zeros */
  }

  // ---- subscriptions ----
  try {
    const { data } = await admin.from("subscriptions").select("plan_id, status");
    const byPlan: Record<string, number> = {};
    let activePro = 0;
    let mrr = 0;
    for (const s of data ?? []) {
      const status = String(s.status);
      if (status !== "active" && status !== "trialing" && status !== "past_due") continue;
      const plan = String(s.plan_id) as PlanId;
      byPlan[plan] = (byPlan[plan] ?? 0) + 1;
      if (plan !== "free") {
        activePro += 1;
        mrr += MONTHLY_CENTS[plan] ?? 0;
      }
    }
    overview.subscriptions = { activePro, byPlan, mrrCents: mrr };
  } catch {
    /* leave zeros */
  }

  // ---- AI usage (30d) ----
  try {
    const { data } = await admin
      .from("ai_usage_events")
      .select("feature, input_tokens, output_tokens, estimated_cost_usd, status, cached")
      .gte("created_at", since30)
      .limit(5000);
    const rows = data ?? [];
    const byFeature = new Map<string, { calls: number; costUsd: number }>();
    let tokens = 0;
    let cost = 0;
    let cached = 0;
    let errors = 0;
    for (const r of rows) {
      tokens += (Number(r.input_tokens) || 0) + (Number(r.output_tokens) || 0);
      const c = Number(r.estimated_cost_usd) || 0;
      cost += c;
      if (r.cached) cached += 1;
      if (String(r.status) !== "ok") errors += 1;
      const f = String(r.feature);
      const agg = byFeature.get(f) ?? { calls: 0, costUsd: 0 };
      agg.calls += 1;
      agg.costUsd += c;
      byFeature.set(f, agg);
    }
    overview.ai = {
      calls30d: rows.length,
      errors30d: errors,
      tokens30d: tokens,
      costUsd30d: Number(cost.toFixed(4)),
      cacheRate: rows.length ? Math.round((cached / rows.length) * 100) : 0,
      byFeature: [...byFeature.entries()]
        .map(([feature, v]) => ({ feature, calls: v.calls, costUsd: Number(v.costUsd.toFixed(4)) }))
        .sort((a, b) => b.calls - a.calls),
    };
  } catch {
    /* leave zeros */
  }

  // ---- AI budget cap ----
  try {
    overview.aiBudget = await aiBudgetStatus();
  } catch {
    /* leave default */
  }

  return overview;
}
