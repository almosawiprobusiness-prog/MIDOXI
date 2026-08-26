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

/**
 * The two halves of the funnel the server cannot see.
 *
 * Completing and dismissing already go through server actions, so they
 * are counted where they happen. Opening a recommendation is a link
 * click and asking "why this?" is a disclosure toggle — both happen
 * entirely in the browser, and without this the funnel would have a
 * denominator and an outcome with nothing in between.
 *
 * Narrow on purpose: two names, no free parameters. A general-purpose
 * "track anything from the client" endpoint is how an analytics
 * vocabulary stops being a vocabulary.
 */
export async function trackRecommendationInteraction(
  what: "opened" | "why_viewed",
  kind: string,
): Promise<void> {
  await track(
    what === "opened" ? "recommendation_opened" : "recommendation_why_viewed",
    { kind: kind.slice(0, 40) },
  );
}
