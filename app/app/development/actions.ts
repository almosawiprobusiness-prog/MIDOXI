"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "@/lib/data/store";
import type { GoalInput, EvidenceInput } from "@/lib/data/development-types";

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

export async function createGoal(input: GoalInput): Promise<Result> {
  if (!input.title?.trim()) return { ok: false, error: "Give the goal a title." };

  if (isDemoMode) {
    const id = demoStore.createGoal(input);
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
  revalidate();
  return { ok: true, id: data.id };
}

export async function updateGoal(id: string, input: GoalInput): Promise<Result> {
  if (!input.title?.trim()) return { ok: false, error: "Give the goal a title." };

  if (isDemoMode) {
    demoStore.updateGoal(id, input);
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
