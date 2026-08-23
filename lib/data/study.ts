import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "./store";
import type { StudySession, StudyNote, StudySessionDetail, StudyNoteKind } from "./study-types";

function rowToSession(s: Record<string, unknown>): StudySession {
  return {
    id: s.id as string,
    videoId: (s.source_ref as string) ?? null,
    title: (s.title as string) ?? "",
    goalId: (s.goal_id as string) ?? null,
    summary: (s.summary as string) ?? "",
    completed: (s.completed as boolean) ?? false,
    createdAt: (s.created_at as string) ?? new Date().toISOString(),
  };
}

function rowToNote(n: Record<string, unknown>): StudyNote {
  return {
    id: n.id as string,
    sessionId: n.session_id as string,
    kind: (n.kind as StudyNoteKind) ?? "observation",
    body: (n.body as string) ?? "",
    atSeconds: n.at_seconds == null ? null : Number(n.at_seconds),
    createdAt: (n.created_at as string) ?? new Date().toISOString(),
  };
}

export async function listStudySessions(): Promise<StudySession[]> {
  if (isDemoMode) return demoStore.listStudySessions();
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from("study_sessions").select("*").order("created_at", { ascending: false });
  return (data ?? []).map(rowToSession);
}

export async function getStudySessionDetail(id: string): Promise<StudySessionDetail | null> {
  if (isDemoMode) return demoStore.getStudySession(id);
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: s } = await supabase.from("study_sessions").select("*").eq("id", id).maybeSingle();
  if (!s) return null;
  const { data: notes } = await supabase
    .from("study_notes")
    .select("*")
    .eq("session_id", id)
    .order("created_at", { ascending: true });
  return { session: rowToSession(s), notes: (notes ?? []).map(rowToNote) };
}
