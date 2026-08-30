"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "@/lib/data/store";
import type { TrainingInput } from "@/lib/data/training-types";
import { emitMidoEvent } from "@/lib/events/emit";
import { idempotencyKey } from "@/lib/events/types";
import { track } from "@/lib/analytics/track";

export type Result = { ok: true; id?: string; demo?: boolean } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, userId: null };
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

function revalidate() {
  revalidatePath("/app/training");
  revalidatePath("/app");
}

function hasLog(input: TrainingInput) {
  return input.rpe != null || input.physicalFeel != null || input.technicalFeel != null || !!input.improved || !!input.feltOff;
}

async function writeLog(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, sessionId: string, input: TrainingInput) {
  // Idempotent: replace any existing log for this session.
  await supabase.from("training_logs").delete().eq("session_id", sessionId);
  if (!hasLog(input)) return;
  await supabase.from("training_logs").insert({
    session_id: sessionId,
    rpe: input.rpe ?? null,
    physical_feel: input.physicalFeel ?? null,
    technical_feel: input.technicalFeel ?? null,
    improved: input.improved || null,
    felt_off: input.feltOff || null,
  });
}

/*
  A session was logged.

  `occurredAt` is the session's own scheduled time, not now — the same
  reason a match is dated by when it was played. "Days since training" is
  a signal the scorer leans on, and it has to mean days since the work,
  not days since the typing.

  The payload carries the shape of the session, never its contents: kind,
  minutes, and whether an objective was written. The session itself is in
  `training_sessions` and is reachable by subjectId.

  `concepts` rides along only when the session came from the session
  engine — the film concepts the plan trained. It is what lets the loop
  say "trained what the film showed" arithmetically, the way film
  observations already carry their concept.
*/
async function recordTraining(id: string, input: TrainingInput) {
  await track("training_completed", { kind: input.kind });
  await emitMidoEvent({
    type: "TRAINING_LOGGED",
    subjectType: "training",
    subjectId: id,
    occurredAt: input.scheduledAt,
    payload: {
      kind: input.kind,
      durationMin: input.durationMin ?? null,
      hasObjective: Boolean(input.objective?.trim()),
      ...(input.concepts?.length ? { concepts: input.concepts.slice(0, 8) } : {}),
    },
    idempotencyKey: idempotencyKey(["training", "logged", id]),
  });
}

/*
  The accepted plan, persisted where 0001 always intended plans to
  live. Column mapping is documented in lib/data/training.ts. Failure
  is swallowed on purpose: the session row is already saved and losing
  the block detail must not fail the save the player just confirmed.
*/
async function writePlan(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  sessionId: string,
  input: TrainingInput,
) {
  if (!input.plan?.length) return;
  await supabase.from("training_blocks").insert(
    input.plan.slice(0, 8).map((b, i) => ({
      session_id: sessionId,
      name: b.name,
      notes: b.detail,
      rest: b.work,
      distance: b.source || null,
      position: i,
    })),
  );
}

export async function createTraining(input: TrainingInput): Promise<Result> {
  if (!input.title?.trim()) return { ok: false, error: "Give the session a title." };
  if (!input.scheduledAt) return { ok: false, error: "Session date is required." };

  if (isDemoMode) {
    const id = demoStore.createTraining(input);
    await recordTraining(id, input);
    revalidate();
    return { ok: true, id, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase
    .from("training_sessions")
    .insert({
      kind: input.kind,
      title: input.title.trim(),
      scheduled_at: input.scheduledAt,
      duration_min: input.durationMin ?? null,
      objective: input.objective || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await writeLog(supabase, data.id, input);
  await writePlan(supabase, data.id, input);
  await recordTraining(data.id, input);
  revalidate();
  return { ok: true, id: data.id };
}

/**
 * Draft a session from the player's record. Returns the proposal plus
 * the resolved source labels — the player confirms before anything is
 * written, the same contract as voice logging and film evidence.
 */
export async function generateSession(): Promise<
  | { ok: true; proposal: import("@/lib/intelligence/session-plan").SessionProposal; sources: Record<string, string> }
  | { ok: false; error: string }
> {
  try {
    const { draftSession } = await import("@/lib/ai/session-engine");
    const { sourceLabel } = await import("@/lib/intelligence/session-plan");
    const { proposal, context } = await draftSession();
    const sources: Record<string, string> = {};
    for (const b of proposal.blocks) sources[b.sourceKey] = sourceLabel(b.sourceKey, context);
    return { ok: true, proposal, sources };
  } catch {
    return { ok: false, error: "MIDO could not draft a session just now." };
  }
}

export async function updateTraining(id: string, input: TrainingInput): Promise<Result> {
  if (!input.title?.trim()) return { ok: false, error: "Give the session a title." };

  if (isDemoMode) {
    demoStore.updateTraining(id, input);
    revalidate();
    return { ok: true, id, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase
    .from("training_sessions")
    .update({
      kind: input.kind,
      title: input.title.trim(),
      scheduled_at: input.scheduledAt,
      duration_min: input.durationMin ?? null,
      objective: input.objective || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await writeLog(supabase, id, input);
  revalidate();
  return { ok: true, id };
}

export async function deleteTraining(id: string): Promise<Result> {
  if (isDemoMode) {
    demoStore.deleteTraining(id);
    revalidate();
    return { ok: true, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase.from("training_sessions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
