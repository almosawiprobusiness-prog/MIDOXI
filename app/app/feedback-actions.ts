"use server";

import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

/*
  The Founding XI's channel back to us.

  Deliberately not a support system — no tickets, no threads, no status.
  Eleven players' honest reactions, written down where we will actually
  read them, are worth more than a month of speculative development. The
  rows are insert-only and read with the service role; a player's
  feedback is addressed to us, not to their own record.
*/

export type FeedbackKind = "problem" | "feedback" | "ai_rating";

export type FeedbackResult = { ok: true } | { ok: false; error: string };

export async function sendFeedback(input: {
  kind: FeedbackKind;
  subject?: string;
  rating?: 1 | -1;
  body?: string;
}): Promise<FeedbackResult> {
  const body = input.body?.trim().slice(0, 2000) || null;

  // A rating can stand alone; words cannot be empty if words are the point.
  if (input.kind !== "ai_rating" && !body) {
    return { ok: false, error: "Write a line first — even a short one helps." };
  }

  if (isDemoMode) return { ok: true };

  try {
    const supabase = await createClient();
    if (!supabase) return { ok: false, error: "Backend unavailable." };

    const { error } = await supabase.from("beta_feedback").insert({
      kind: input.kind,
      subject: input.subject?.slice(0, 200) || null,
      rating: input.rating ?? null,
      body,
    });
    if (error) return { ok: false, error: "Could not send right now — try again in a moment." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not send right now — try again in a moment." };
  }
}
