"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "@/lib/data/store";
import type { GoalInput, EvidenceInput } from "@/lib/data/development-types";
import { emitMidoEvent } from "@/lib/events/emit";
import { idempotencyKey } from "@/lib/events/types";
import { track } from "@/lib/analytics/track";

export type Result = { ok: true; id?: string; demo?: boolean } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, userId: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

function revalidate(id?: string) {
  revalidatePath("/app/development");
  revalidatePath("/app");
  if (id) revalidatePath(`/app/development/${id}`);
}

/*
  Tell the event log a goal changed.

  Written once here rather than at each of the four `return { ok: true }`
  points, so the payload cannot drift between the demo and Supabase
  branches — which is exactly how an event log ends up with two shapes
  for the same event.

  Deliberately NOT awaited into the action's result. `emitMidoEvent` never
  throws and its failure must not fail the goal the player just saved;
  see the note at the top of lib/events/emit.ts.

  The payload carries the title and category and nothing else: the goal
  itself is already in `development_goals` and is reachable by subjectId.
*/
async function recordGoal(
  kind: "created" | "updated",
  id: string,
  input: GoalInput,
) {
  // A goal reaching `achieved` is a different event from an edit — it is
  // the one a recommendation should react to.
  const achieved = input.status === "achieved";
  const type = kind === "created" ? "GOAL_CREATED" : achieved ? "GOAL_COMPLETED" : "GOAL_UPDATED";
  if (kind === "created") await track("goal_created", { category: input.category });

  await emitMidoEvent({
    type,
    subjectType: "goal",
    subjectId: id,
    payload: { title: input.title.trim(), category: input.category, progress: input.progress },
    /*
      Creation and completion happen once and are keyed so a retry or a
      double submit cannot double-count them. An ordinary edit is
      genuinely repeatable and is left unkeyed — keying it would silently
      swallow the second real edit.
    */
    idempotencyKey:
      type === "GOAL_UPDATED" ? undefined : idempotencyKey(["goal", type, id]),
  });
}

export async function createGoal(input: GoalInput): Promise<Result> {
  if (!input.title?.trim()) return { ok: false, error: "Give the goal a title." };

  if (isDemoMode) {
    const id = demoStore.createGoal(input);
    await recordGoal("created", id, input);
    revalidate();
    return { ok: true, id, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase
    .from("development_goals")
    .insert({
      category: input.category,
      title: input.title.trim(),
      why: input.why || null,
      status: input.status,
      progress: input.progress,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  await recordGoal("created", data.id, input);
  revalidate();
  return { ok: true, id: data.id };
}

export async function updateGoal(id: string, input: GoalInput): Promise<Result> {
  if (!input.title?.trim()) return { ok: false, error: "Give the goal a title." };

  if (isDemoMode) {
    demoStore.updateGoal(id, input);
    await recordGoal("updated", id, input);
    revalidate(id);
    return { ok: true, id, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase
    .from("development_goals")
    .update({
      category: input.category,
      title: input.title.trim(),
      why: input.why || null,
      status: input.status,
      progress: input.progress,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  await recordGoal("updated", id, input);
  revalidate(id);
  return { ok: true, id };
}

export async function deleteGoal(id: string): Promise<Result> {
  if (isDemoMode) {
    demoStore.deleteGoal(id);
    revalidate();
    return { ok: true, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase.from("development_goals").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function addEvidence(goalId: string, input: EvidenceInput): Promise<Result> {
  if (!input.note?.trim()) return { ok: false, error: "Add a short note." };

  if (isDemoMode) {
    const id = demoStore.addEvidence(goalId, input);
    revalidate(goalId);
    return { ok: true, id, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase
    .from("development_evidence")
    .insert({ goal_id: goalId, kind: input.kind, note: input.note.trim() })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidate(goalId);
  return { ok: true, id: data.id };
}

export async function deleteEvidence(id: string, goalId: string): Promise<Result> {
  if (isDemoMode) {
    demoStore.deleteEvidence(id);
    revalidate(goalId);
    return { ok: true, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase.from("development_evidence").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate(goalId);
  return { ok: true };
}
