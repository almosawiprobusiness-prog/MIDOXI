import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import type { CaptureInput, StudyCapture } from "./capture-types";

/*
  Study captures — the server's side of the MIDO XI Capture extension.

  Reads go through RLS like every other owner-scoped table. Writes take
  the validated wire shape from capture-types.ts; validation itself is
  the caller's job (the API route), because this layer trusts its input
  the way study.ts and development.ts do.

  Demo mode keeps captures in module memory (the emit.ts pattern) so the
  whole capture loop is testable locally with no Supabase keys. store.ts
  is not involved: captures are a leaf feature and the demo store is
  already the largest file in lib/data.
*/

interface DemoCaptureDB {
  captures: StudyCapture[];
  seq: number;
}
const g = globalThis as unknown as { __midoCaptureDB?: DemoCaptureDB };
const demoDB: DemoCaptureDB = (g.__midoCaptureDB ??= { captures: [], seq: 1 });

function rowToCapture(r: Record<string, unknown>): StudyCapture {
  return {
    id: r.id as string,
    videoId: r.video_id as string,
    sourceUrl: r.source_url as string,
    videoTitle: (r.video_title as string) ?? "",
    channelName: (r.channel_name as string) ?? null,
    thumbnailUrl: (r.thumbnail_url as string) ?? null,
    timestampSeconds: Number(r.timestamp_seconds ?? 0),
    observation: (r.observation as string) ?? "",
    category: (r.category as StudyCapture["category"]) ?? null,
    goalId: (r.goal_id as string) ?? null,
    studyId: (r.study_id as string) ?? null,
    origin: (r.origin as StudyCapture["origin"]) ?? "chrome_extension",
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

export type SaveCaptureResult =
  | { ok: true; id: string; deduped?: boolean }
  | { ok: false; error: string; status: number };

/**
 * Persist one capture for the signed-in user.
 *
 * Assumes `input` already passed captureIssue(). Goal ownership is
 * verified here — a goalId the caller does not own is rejected rather
 * than silently dropped, because a capture that quietly loses its goal
 * connection would look saved and be wrong.
 */
export async function saveCapture(input: CaptureInput): Promise<SaveCaptureResult> {
  if (isDemoMode) {
    if (input.clientKey) {
      const seen = demoDB.captures.find((c) => c.id.endsWith(`:${input.clientKey}`));
      if (seen) return { ok: true, id: seen.id, deduped: true };
    }
    const id = `cap${demoDB.seq++}${input.clientKey ? `:${input.clientKey}` : ""}`;
    demoDB.captures.unshift({
      id,
      videoId: input.videoId,
      sourceUrl: input.sourceUrl,
      videoTitle: input.videoTitle.trim(),
      channelName: input.channelName?.trim() || null,
      thumbnailUrl: input.thumbnailUrl || null,
      timestampSeconds: Math.floor(input.timestampSeconds),
      observation: input.observation.trim(),
      category: input.category ?? null,
      goalId: input.goalId || null,
      studyId: null,
      origin: "chrome_extension",
      createdAt: new Date().toISOString(),
    });
    return { ok: true, id };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Service unavailable.", status: 503 };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in.", status: 401 };

  if (input.goalId) {
    // RLS scopes the read to the caller, so an unowned goal reads as absent.
    const { data: goal } = await supabase
      .from("development_goals")
      .select("id")
      .eq("id", input.goalId)
      .maybeSingle();
    if (!goal) return { ok: false, error: "That goal is not yours.", status: 403 };
  }

  const { data, error } = await supabase
    .from("study_captures")
    .insert({
      video_id: input.videoId,
      source_url: input.sourceUrl,
      video_title: input.videoTitle.trim(),
      channel_name: input.channelName?.trim() || null,
      thumbnail_url: input.thumbnailUrl || null,
      timestamp_seconds: Math.floor(input.timestampSeconds),
      observation: input.observation.trim(),
      category: input.category ?? null,
      goal_id: input.goalId || null,
      origin: "chrome_extension",
      client_key: input.clientKey || null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 on the client-key index: this exact capture already landed.
    // The retry worked the first time; say so instead of failing.
    if (error.code === "23505" && input.clientKey) {
      const { data: existing } = await supabase
        .from("study_captures")
        .select("id")
        .eq("client_key", input.clientKey)
        .maybeSingle();
      if (existing) return { ok: true, id: existing.id, deduped: true };
    }
    return { ok: false, error: error.message, status: 400 };
  }
  return { ok: true, id: data.id };
}

/** The player's captured moments, newest first. */
export async function listCaptures(limit = 50): Promise<StudyCapture[]> {
  if (isDemoMode) return demoDB.captures.slice(0, limit);
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("study_captures")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 200));
  return (data ?? []).map(rowToCapture);
}

/** Captures standing as study evidence on one development goal. */
export async function listCapturesForGoal(goalId: string, limit = 20): Promise<StudyCapture[]> {
  if (isDemoMode) return demoDB.captures.filter((c) => c.goalId === goalId).slice(0, limit);
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("study_captures")
    .select("*")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 100));
  return (data ?? []).map(rowToCapture);
}

export async function deleteCapture(id: string): Promise<boolean> {
  if (isDemoMode) {
    const before = demoDB.captures.length;
    demoDB.captures = demoDB.captures.filter((c) => c.id !== id);
    return demoDB.captures.length < before;
  }
  const supabase = await createClient();
  if (!supabase) return false;
  const { error } = await supabase.from("study_captures").delete().eq("id", id);
  return !error;
}
