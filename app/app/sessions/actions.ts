"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSessionPlan,
  updateSessionPlan,
  deleteSessionPlan,
  addSessionBlock,
  updateSessionBlock,
  deleteSessionBlock,
  moveSessionBlock,
  replaceSessionBlocks,
  getSessionPlan,
  listSquad,
} from "@/lib/data/coach";
import { draftSession } from "@/lib/ai/coach-engine";
import { methodologyContext } from "@/lib/data/club";
import type { SessionPlanInput, SessionBlockInput } from "@/lib/data/coach-types";

export type Result = { ok: true; id?: string; message?: string } | { ok: false; error: string };

function revalidate(id?: string) {
  revalidatePath("/app/sessions");
  revalidatePath("/app");
  if (id) revalidatePath(`/app/sessions/${id}`);
}

export async function createPlan(input: SessionPlanInput): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: "Give the session a title." };
  const id = await createSessionPlan({ ...input, title: input.title.trim() });
  if (!id) return { ok: false, error: "Could not create the session." };
  revalidate(id);
  return { ok: true, id };
}

export async function updatePlan(id: string, input: SessionPlanInput): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: "Give the session a title." };
  const ok = await updateSessionPlan(id, { ...input, title: input.title.trim() });
  if (!ok) return { ok: false, error: "Could not save the session." };
  revalidate(id);
  return { ok: true, id };
}

export async function removePlan(id: string): Promise<Result> {
  const ok = await deleteSessionPlan(id);
  if (!ok) return { ok: false, error: "Could not delete the session." };
  revalidate();
  redirect("/app/sessions");
}

export async function addBlock(planId: string, input: SessionBlockInput): Promise<Result> {
  if (!input.name.trim()) return { ok: false, error: "Name the block." };
  const ok = await addSessionBlock(planId, { ...input, name: input.name.trim() });
  if (!ok) return { ok: false, error: "Could not add the block." };
  revalidate(planId);
  return { ok: true };
}

export async function editBlock(
  planId: string,
  blockId: string,
  input: SessionBlockInput,
): Promise<Result> {
  if (!input.name.trim()) return { ok: false, error: "Name the block." };
  const ok = await updateSessionBlock(blockId, { ...input, name: input.name.trim() });
  if (!ok) return { ok: false, error: "Could not save the block." };
  revalidate(planId);
  return { ok: true };
}

export async function removeBlock(planId: string, blockId: string): Promise<Result> {
  const ok = await deleteSessionBlock(blockId);
  if (!ok) return { ok: false, error: "Could not delete the block." };
  revalidate(planId);
  return { ok: true };
}

export async function moveBlock(planId: string, blockId: string, direction: -1 | 1): Promise<Result> {
  const ok = await moveSessionBlock(blockId, direction);
  if (!ok) return { ok: false, error: "Could not reorder." };
  revalidate(planId);
  return { ok: true };
}

/**
 * MIDO drafts the session. The coach asked for it explicitly, and what comes
 * back replaces the blocks of a plan they own — which they can then edit.
 */
export async function draftWithMido(planId: string): Promise<Result> {
  const detail = await getSessionPlan(planId);
  if (!detail) return { ok: false, error: "Session not found." };
  if (!detail.plan.objective.trim()) {
    return { ok: false, error: "Write the objective first — MIDO drafts from what the session is for." };
  }

  const [squad, methodology] = await Promise.all([listSquad(), methodologyContext("play")]);
  const drafted = await draftSession({
    objective: detail.plan.objective,
    durationMin: detail.plan.durationMin ?? 75,
    playersCount: detail.plan.playersCount ?? (squad.filter((p) => p.status === "active").length || null),
    pitch: detail.plan.pitch,
    squadFocus: squad.map((p) => p.focus).filter((f): f is string => Boolean(f)).slice(0, 6),
    methodology,
  });

  const ok = await replaceSessionBlocks(planId, drafted.blocks);
  if (!ok) return { ok: false, error: "Could not write the drafted blocks." };
  revalidate(planId);

  const inside = drafted.methodologyApplied
    ? ` Written inside your club methodology (${drafted.methodologyApplied} principles).`
    : "";

  return {
    ok: true,
    id: planId,
    message:
      (drafted.note ??
        (drafted.source === "mido"
          ? "MIDO drafted the session. Edit anything — it is your session."
          : "Drafted from the MIDO coaching library. Edit anything.")) + inside,
  };
}
