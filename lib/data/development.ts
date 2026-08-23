import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "./store";
import type { DevelopmentGoal, DevelopmentCategory } from "@/lib/types";
import type { EvidenceEntry, EvidenceKind, GoalDetail } from "./development-types";

function rowToGoal(g: Record<string, unknown>, counts: EvidenceEntry[] = []): DevelopmentGoal {
  return {
    id: g.id as string,
    index: 0,
    category: g.category as DevelopmentCategory,
    title: g.title as string,
    status: (g.status as DevelopmentGoal["status"]) ?? "active",
    createdLabel: new Date((g.created_at as string) ?? Date.now()).toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    }),
    why: (g.why as string) ?? "",
    evidence: {
      clips: counts.filter((e) => e.kind === "film").length,
      training: counts.filter((e) => e.kind === "training").length,
      study: counts.filter((e) => e.kind === "insight").length,
      coachNotes: counts.filter((e) => e.kind === "coach").length,
      matches: counts.filter((e) => e.kind === "match").length,
    },
    progress: (g.progress as number) ?? 0,
  };
}

function rowToEvidence(e: Record<string, unknown>): EvidenceEntry {
  return {
    id: e.id as string,
    goalId: e.goal_id as string,
    kind: e.kind as EvidenceKind,
    note: (e.note as string) ?? "",
    createdAt: (e.created_at as string) ?? new Date().toISOString(),
  };
}

/**
 * @param forUser read somebody else's goals with the service role. Only the
 * public share route may pass this, with an id from a validated token — and
 * the explicit `user_id` filters below are the whole isolation on that path,
 * because RLS is bypassed.
 */
export async function listGoals(forUser?: string): Promise<DevelopmentGoal[]> {
  if (isDemoMode) return demoStore.listGoals();

  const supabase = forUser ? createAdminClient() : await createClient();
  if (!supabase) return [];
  const goalQuery = supabase.from("development_goals").select("*").order("created_at", { ascending: true });
  const evidenceQuery = supabase.from("development_evidence").select("id, goal_id, kind, note, created_at");
  const [{ data: goals }, { data: evidence }] = await Promise.all([
    forUser ? goalQuery.eq("user_id", forUser) : goalQuery,
    forUser ? evidenceQuery.eq("user_id", forUser) : evidenceQuery,
  ]);
  const ev = (evidence ?? []).map(rowToEvidence);
  return (goals ?? []).map((g) => rowToGoal(g, ev.filter((e) => e.goalId === (g.id as string))));
}

export async function getGoalDetail(id: string, forUser?: string): Promise<GoalDetail | null> {
  if (isDemoMode) return demoStore.getGoal(id);

  const supabase = forUser ? createAdminClient() : await createClient();
  if (!supabase) return null;

  const goalQuery = supabase.from("development_goals").select("*").eq("id", id);
  const { data: goal } = await (forUser ? goalQuery.eq("user_id", forUser) : goalQuery).maybeSingle();
  if (!goal) return null;

  const evidenceQuery = supabase
    .from("development_evidence")
    .select("id, goal_id, kind, note, created_at")
    .eq("goal_id", id);
  const { data: evidence } = await (forUser ? evidenceQuery.eq("user_id", forUser) : evidenceQuery)
    .order("created_at", { ascending: false });

  const ev = (evidence ?? []).map(rowToEvidence);
  return { goal: rowToGoal(goal, ev), evidence: ev };
}
