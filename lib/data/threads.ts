import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "./store";
import { groupConceptThreads, type ConceptThread } from "./development-types";

/*
  Concept threads — the read side of "the fourth time this appears".

  Counted from filed development_evidence rows, never generated: a
  thread exists only because the player confirmed the same concept onto
  their record more than once. The grouping itself is pure and lives in
  development-types.ts under test; this file only fetches.
*/

export async function listConceptThreads(minCount = 2): Promise<ConceptThread[]> {
  if (isDemoMode) {
    return groupConceptThreads(demoStore.listAllEvidence(), minCount);
  }

  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("development_evidence")
    .select("concept, goal_id, created_at")
    .not("concept", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  return groupConceptThreads(
    (data ?? []).map((r) => ({
      concept: r.concept as string,
      goalId: String(r.goal_id),
      createdAt: String(r.created_at),
    })),
    minCount,
  );
}

/**
 * Which of these captures are already filed as evidence, by ref_id.
 * Lets the Film Room say "filed" instead of offering the button twice.
 */
export async function filedCaptureRefs(captureIds: string[]): Promise<Set<string>> {
  if (captureIds.length === 0) return new Set();

  if (isDemoMode) {
    const refs = new Set(
      demoStore
        .listAllEvidence()
        .map((e) => e.refId)
        .filter((r): r is string => Boolean(r)),
    );
    return new Set(captureIds.filter((id) => refs.has(id)));
  }

  const supabase = await createClient();
  if (!supabase) return new Set();
  const { data } = await supabase
    .from("development_evidence")
    .select("ref_id")
    .in("ref_id", captureIds);
  return new Set((data ?? []).map((r) => String(r.ref_id)));
}
