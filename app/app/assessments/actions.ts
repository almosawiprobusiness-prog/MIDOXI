"use server";

import { revalidatePath } from "next/cache";
import { createAssessment, deleteAssessment, unitFor } from "@/lib/data/trainer";
import { test as testMeta } from "@/lib/knowledge/physical";
import type { AssessmentInput } from "@/lib/data/trainer-types";

export type Result = { ok: true; id?: string; message?: string } | { ok: false; error: string };

function revalidate(athleteId?: string) {
  revalidatePath("/app/assessments");
  revalidatePath("/app");
  if (athleteId) revalidatePath(`/app/athletes/${athleteId}`);
}

export async function recordAssessment(input: AssessmentInput): Promise<Result> {
  if (!input.athleteId) return { ok: false, error: "Choose the athlete." };
  const meta = testMeta(input.test);
  if (!meta) return { ok: false, error: "Choose a test." };
  if (!Number.isFinite(input.value) || input.value <= 0) {
    return { ok: false, error: `Enter the result in ${meta.unit}.` };
  }

  const id = await createAssessment({ ...input, unit: unitFor(input.test) || meta.unit });
  if (!id) return { ok: false, error: "Could not record the result." };
  revalidate(input.athleteId);
  return { ok: true, id, message: `${meta.label} recorded.` };
}

export async function removeAssessment(id: string, athleteId: string): Promise<Result> {
  const ok = await deleteAssessment(id);
  if (!ok) return { ok: false, error: "Could not delete the result." };
  revalidate(athleteId);
  return { ok: true };
}
