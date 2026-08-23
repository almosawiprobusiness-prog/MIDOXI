"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProgram,
  updateProgram,
  deleteProgram,
  getProgram,
  getAthlete,
  listAssessments,
  replaceSchedule,
  toggleSessionComplete,
} from "@/lib/data/trainer";
import { composeProgram } from "@/lib/data/trainer-compose";
import { draftProgram } from "@/lib/ai/trainer-engine";
import type { ProgramInput } from "@/lib/data/trainer-types";

export type Result = { ok: true; id?: string; message?: string } | { ok: false; error: string };

function revalidate(id?: string) {
  revalidatePath("/app/programs");
  revalidatePath("/app");
  if (id) revalidatePath(`/app/programs/${id}`);
}

export async function addProgram(input: ProgramInput): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: "Give the block a title." };
  const id = await createProgram({ ...input, title: input.title.trim() });
  if (!id) return { ok: false, error: "Could not create the block." };
  revalidate(id);
  return { ok: true, id };
}

export async function editProgram(id: string, input: ProgramInput): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: "Give the block a title." };
  const ok = await updateProgram(id, { ...input, title: input.title.trim() });
  if (!ok) return { ok: false, error: "Could not save the block." };
  revalidate(id);
  return { ok: true, id };
}

export async function removeProgram(id: string): Promise<Result> {
  const ok = await deleteProgram(id);
  if (!ok) return { ok: false, error: "Could not delete the block." };
  revalidate();
  redirect("/app/programs");
}

export async function toggleSession(programId: string, sessionId: string): Promise<Result> {
  const ok = await toggleSessionComplete(sessionId);
  if (!ok) return { ok: false, error: "Could not update the session." };
  revalidate(programId);
  return { ok: true };
}

/**
 * Build the block. `mode: "library"` is the deterministic composition — free
 * and always available. `mode: "mido"` adds the metered Claude pass, which
 * falls back to the same composition with an honest note.
 */
export async function buildSchedule(programId: string, mode: "library" | "mido"): Promise<Result> {
  const detail = await getProgram(programId);
  if (!detail) return { ok: false, error: "Block not found." };
  if (!detail.program.objective.trim()) {
    return { ok: false, error: "Write the objective first — the block is built from what it is for." };
  }

  const athlete = detail.program.athleteId ? await getAthlete(detail.program.athleteId) : null;
  const ctx = {
    objective: detail.program.objective,
    weeks: detail.program.weeks,
    sessionsPerWeek: detail.program.sessionsPerWeek,
    limitations: athlete?.limitations ?? "",
    position: athlete?.position ?? "",
  };

  const built =
    mode === "library"
      ? composeProgram(ctx)
      : await draftProgram(
          ctx,
          athlete
            ? {
                name: athlete.name,
                position: athlete.position,
                objective: athlete.objective ?? "",
                limitations: athlete.limitations ?? "",
                assessments: await listAssessments(athlete.id),
              }
            : null,
        );

  const ok = await replaceSchedule(programId, built.sessions, built.qualities, built.source);
  if (!ok) return { ok: false, error: "Could not write the block." };
  revalidate(programId);

  return {
    ok: true,
    id: programId,
    message:
      built.note ??
      (built.source === "mido"
        ? "MIDO built the block from this athlete's objective, limitations and recorded tests. Edit anything."
        : `Built from the MIDO physical library — ${built.sessions.length} sessions across ${detail.program.weeks} weeks.`),
  };
}
