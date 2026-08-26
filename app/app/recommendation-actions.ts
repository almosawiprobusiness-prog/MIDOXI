"use server";

import { revalidatePath } from "next/cache";
import { completeRecommendation, dismissRecommendation } from "@/lib/data/recommendations";
import { track } from "@/lib/analytics/track";

/*
  Acting on what MIDO suggested.

  Both close the recommendation and emit an event, which is what lets the
  next ranking know. Completing is the loop closing; dismissing is the
  player telling MIDO it was wrong, and both are worth recording.
*/

export type Result = { ok: true } | { ok: false; error: string };

export async function markRecommendationDone(id: string): Promise<Result> {
  const ok = await completeRecommendation(id);
  if (!ok) return { ok: false, error: "That suggestion could not be updated." };
  await track("recommendation_completed");
  revalidatePath("/app");
  return { ok: true };
}

export async function markRecommendationDismissed(id: string): Promise<Result> {
  const ok = await dismissRecommendation(id);
  if (!ok) return { ok: false, error: "That suggestion could not be updated." };
  await track("recommendation_dismissed");
  revalidatePath("/app");
  return { ok: true };
}
