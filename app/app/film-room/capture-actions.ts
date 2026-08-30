"use server";

import { revalidatePath } from "next/cache";
import { track } from "@/lib/analytics/track";
import { deleteCapture, getCapture } from "@/lib/data/captures";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "@/lib/data/store";
import { concept } from "@/lib/knowledge/concepts";
import { formatTimestamp } from "@/lib/data/capture-types";
import { emitMidoEvent } from "@/lib/events/emit";
import { idempotencyKey } from "@/lib/events/types";

/*
  The Player OS side of captured moments.

  markCaptureOpened is the third leg of the extension's funnel — a
  moment was not just saved but come back to, which is the behaviour
  the whole experiment exists to measure. It records THAT a moment was
  opened, never what it said.
*/

export async function markCaptureOpened(captureId: string): Promise<void> {
  if (!/^[\w:-]{1,64}$/.test(captureId)) return;
  await track("capture_opened_in_mido", { captureId });
}

export type Result = { ok: true } | { ok: false; error: string };

export type FileCaptureResult = { ok: true; evidenceId: string } | { ok: false; error: string };

/*
  A captured moment becomes evidence on a development goal.

  This is the capture's way into the loop: until now the extension's
  moments were displayed but never counted. The player chooses the goal
  and — optionally — names the curated concept the moment is an example
  of; the concept is what the Threads panel and the context selector
  count, so it is never inferred from the capture's category. The
  player watched the clip; the category did not.

  Evidence provenance is `self`: the player noticed this themselves in
  the browser. When a concept is named, FILM_OBSERVATION_CREATED is
  emitted so the NBA scorer and the session engine see what the player
  keeps noticing — the same signal path an AI film read feeds.
*/
export async function fileCapture(input: {
  captureId: string;
  goalId: string;
  conceptSlug?: string | null;
}): Promise<FileCaptureResult> {
  if (!/^[\w:-]{1,64}$/.test(input.captureId)) return { ok: false, error: "Not a capture id." };
  if (!/^[\w-]{1,64}$/.test(input.goalId)) return { ok: false, error: "Not a goal id." };

  const slug = input.conceptSlug || null;
  if (slug && !concept(slug)) return { ok: false, error: "Unknown concept." };

  const capture = await getCapture(input.captureId);
  if (!capture) return { ok: false, error: "That moment no longer exists." };

  const note = `${formatTimestamp(capture.timestampSeconds)} — ${capture.observation}`.slice(0, 300);

  let evidenceId: string;
  if (isDemoMode) {
    evidenceId = demoStore.addEvidence(input.goalId, {
      kind: "film",
      note,
      concept: slug,
      atSeconds: capture.timestampSeconds,
      refId: capture.id,
      source: "self",
    });
  } else {
    const supabase = await createClient();
    if (!supabase) return { ok: false, error: "You must be signed in." };
    const { data, error } = await supabase
      .from("development_evidence")
      .insert({
        goal_id: input.goalId,
        kind: "film",
        note,
        ref_id: capture.id,
        concept: slug,
        at_seconds: capture.timestampSeconds,
        // The player noticed this themselves — MIDO proposed nothing.
        source: "self",
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: `The evidence could not be saved: ${error.message}` };
    evidenceId = data.id as string;
  }

  await track("capture_filed_as_evidence", { hasConcept: Boolean(slug) });
  if (slug) {
    await emitMidoEvent({
      type: "FILM_OBSERVATION_CREATED",
      subjectType: "study",
      subjectId: capture.id,
      source: "user",
      payload: {
        concept: slug,
        atSeconds: capture.timestampSeconds,
        goalId: input.goalId,
        // The player asserted it about footage they watched.
        confidence: "observed",
      },
      idempotencyKey: idempotencyKey(["capture", "filed", capture.id]),
    });
  }

  revalidatePath("/app/film-room");
  revalidatePath(`/app/development/${input.goalId}`);
  revalidatePath("/app/development");
  revalidatePath("/app/timeline");
  revalidatePath("/app");
  return { ok: true, evidenceId };
}

export async function removeCapture(id: string): Promise<Result> {
  if (!/^[\w:-]{1,64}$/.test(id)) return { ok: false, error: "Not a capture id." };
  const done = await deleteCapture(id);
  if (!done) return { ok: false, error: "Could not delete the moment." };
  revalidatePath("/app/film-room");
  return { ok: true };
}
