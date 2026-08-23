"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "@/lib/data/store";
import { youtubeId } from "@/lib/data/film-types";
import type { StudySessionInput, StudyNoteKind } from "@/lib/data/study-types";

export type Result = { ok: true; id?: string; demo?: boolean } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, userId: null };
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

export async function startStudySession(input: StudySessionInput): Promise<Result> {
  if (!input.title?.trim()) return { ok: false, error: "Give the session a title." };

  if (isDemoMode) {
    const id = demoStore.createStudySession(input);
    return { ok: true, id, demo: true };
  }
  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  // Resolve the video source kind for the study_sessions row.
  let sourceKind = "video";
  if (input.videoId) {
    const { data: v } = await supabase.from("videos").select("source, external_url").eq("id", input.videoId).maybeSingle();
    if (v?.source === "youtube" || (v?.external_url && youtubeId(v.external_url as string))) sourceKind = "youtube";
  }

  const { data, error } = await supabase
    .from("study_sessions")
    .insert({ title: input.title.trim(), goal_id: input.goalId ?? null, source_kind: sourceKind, source_ref: input.videoId ?? null })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

export async function addStudyNote(
  sessionId: string,
  kind: StudyNoteKind,
  body: string,
  atSeconds?: number | null
): Promise<Result> {
  if (!body?.trim()) return { ok: false, error: "Write a note." };

  if (isDemoMode) {
    const id = demoStore.addStudyNote(sessionId, kind, body.trim(), atSeconds ?? null);
    revalidatePath(`/app/film-room/study/${sessionId}`);
    return { ok: true, id, demo: true };
  }
  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };
  const { data, error } = await supabase
    .from("study_notes")
    .insert({ session_id: sessionId, kind, body: body.trim(), at_seconds: atSeconds ?? null })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/film-room/study/${sessionId}`);
  return { ok: true, id: data.id };
}

export async function deleteStudyNote(id: string, sessionId: string): Promise<Result> {
  if (isDemoMode) {
    demoStore.deleteStudyNote(id);
    revalidatePath(`/app/film-room/study/${sessionId}`);
    return { ok: true, demo: true };
  }
  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };
  const { error } = await supabase.from("study_notes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/film-room/study/${sessionId}`);
  return { ok: true };
}

/**
 * Complete a study session. Its summary + any Action notes become Insight
 * evidence on the linked development goal — study flows into the loop.
 */
export async function completeStudySession(
  sessionId: string,
  summary: string,
  goalId: string | null
): Promise<Result> {
  if (isDemoMode) {
    demoStore.completeStudySession(sessionId, summary);
    if (goalId && summary.trim()) {
      demoStore.addEvidence(goalId, { kind: "insight", note: summary.trim() });
      revalidatePath(`/app/development/${goalId}`);
    }
    revalidatePath(`/app/film-room/study/${sessionId}`);
    revalidatePath("/app");
    return { ok: true, demo: true };
  }
  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase
    .from("study_sessions")
    .update({ summary: summary || null, completed: true })
    .eq("id", sessionId);
  if (error) return { ok: false, error: error.message };

  if (goalId && summary.trim()) {
    await supabase.from("development_evidence").insert({ goal_id: goalId, kind: "insight", note: summary.trim() });
    revalidatePath(`/app/development/${goalId}`);
  }
  revalidatePath(`/app/film-room/study/${sessionId}`);
  revalidatePath("/app");
  return { ok: true };
}
