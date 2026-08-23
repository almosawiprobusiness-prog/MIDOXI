"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createOppositionReport,
  updateOppositionReport,
  deleteOppositionReport,
  getOppositionReport,
  saveMatchPlan,
} from "@/lib/data/coach";
import { draftMatchPlan } from "@/lib/ai/coach-engine";
import type { OppositionReportInput } from "@/lib/data/coach-types";

export type Result = { ok: true; id?: string; message?: string } | { ok: false; error: string };

function revalidate(id?: string) {
  revalidatePath("/app/opposition");
  revalidatePath("/app");
  if (id) revalidatePath(`/app/opposition/${id}`);
}

export async function createReport(input: OppositionReportInput): Promise<Result> {
  if (!input.opponent.trim()) return { ok: false, error: "Name the opponent." };
  const id = await createOppositionReport({ ...input, opponent: input.opponent.trim() });
  if (!id) return { ok: false, error: "Could not create the report." };
  revalidate(id);
  return { ok: true, id };
}

export async function updateReport(id: string, input: OppositionReportInput): Promise<Result> {
  if (!input.opponent.trim()) return { ok: false, error: "Name the opponent." };
  const ok = await updateOppositionReport(id, { ...input, opponent: input.opponent.trim() });
  if (!ok) return { ok: false, error: "Could not save the report." };
  revalidate(id);
  return { ok: true, id };
}

export async function removeReport(id: string): Promise<Result> {
  const ok = await deleteOppositionReport(id);
  if (!ok) return { ok: false, error: "Could not delete the report." };
  revalidate();
  redirect("/app/opposition");
}

/**
 * Build the match plan. MIDO reads only what the coach recorded, and refuses
 * when there is nothing to read.
 */
export async function buildMatchPlan(id: string): Promise<Result> {
  const report = await getOppositionReport(id);
  if (!report) return { ok: false, error: "Report not found." };

  const result = await draftMatchPlan(report);
  if (!result.ok) return { ok: false, error: result.error };

  const saved = await saveMatchPlan(id, result.plan, result.source === "mido" ? "mido" : "coach");
  if (!saved) return { ok: false, error: "Could not save the plan." };
  revalidate(id);

  return {
    ok: true,
    id,
    message:
      result.note ??
      (result.source === "mido"
        ? "Match plan built from your recorded observations."
        : "Plan built by restructuring your own observations."),
  };
}
