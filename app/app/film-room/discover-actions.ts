"use server";

import { revalidatePath } from "next/cache";
import { addVideo } from "./actions";
import { startStudySession } from "./study/actions";
import { consumeFeature, logAiUsage } from "@/lib/billing/meter";
import { checkFeature } from "@/lib/billing/membership";
import { runAiPicks } from "@/lib/data/discover";
import type { AiPicksResult } from "@/lib/data/discover-types";

export type SaveResult =
  | { ok: true; videoId?: string; studyId?: string; demo?: boolean }
  | { ok: false; error: string };

/**
 * Turn a Discover recommendation into the study loop: add the YouTube video to
 * the Film Room, then open a linked study session on it. Returns the study
 * session id so the client can jump straight into taking notes.
 */
export async function studyRecommendation(input: {
  title: string;
  url: string;
}): Promise<SaveResult> {
  const added = await addVideo({ title: input.title, url: input.url });
  if (!added.ok) return added;

  const session = await startStudySession({
    title: `Study — ${input.title}`.slice(0, 120),
    videoId: added.id ?? null,
  });

  revalidatePath("/app/film-room");
  if (!session.ok) {
    // Video landed; session didn't. Still a success — send them to the video.
    return { ok: true, videoId: added.id, demo: added.demo };
  }
  return { ok: true, videoId: added.id, studyId: session.id, demo: added.demo };
}

/**
 * Generate AI-personalised study picks. Pro-gated + metered: consumes one
 * `study_discoveries` unit only when the call actually produces picks (failures
 * are not charged). Free/out-of-quota users get a typed paywall reason.
 */
export async function generateAiPicks(): Promise<AiPicksResult> {
  // Pre-check the gate so we can return a precise paywall reason without spending.
  const gate = await checkFeature("study_discoveries");
  if (!gate.allowed) {
    return { ok: false, reason: gate.reason === "quota" ? "quota" : "not_pro" };
  }

  const started = Date.now();
  const result = await runAiPicks();
  if (!result.ok) {
    /*
      Nothing produced, so the user's allowance is NOT consumed — but tokens may
      already have been spent on the way to giving up, and the global budget
      ceiling has to see them. Charging the account for a failure would be
      wrong; hiding the cost from ops would be worse.
    */
    if (result.usage) {
      await logAiUsage({
        feature: "study_discoveries",
        tier: "standard",
        model: "claude-sonnet-5",
        inputTokens: result.usage.input,
        outputTokens: result.usage.output,
        cacheReadTokens: result.usage.cacheRead,
        cacheWriteTokens: result.usage.cacheWrite,
        latencyMs: Date.now() - started,
        status: "error",
      });
    }
    return { ok: false, reason: result.reason === "no_credits" ? "no_credits" : "unavailable" };
  }

  // Success — consume one unit and log telemetry for both calls it took.
  await consumeFeature("study_discoveries");
  await logAiUsage({
    feature: "study_discoveries",
    tier: "standard",
    model: "claude-sonnet-5",
    inputTokens: result.usage.input,
    outputTokens: result.usage.output,
    cacheReadTokens: result.usage.cacheRead,
    cacheWriteTokens: result.usage.cacheWrite,
    latencyMs: Date.now() - started,
  });

  const remaining = Math.max(0, gate.limit - (gate.used + 1));
  return { ok: true, recommendations: result.recommendations, remaining };
}
