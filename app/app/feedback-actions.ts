"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

/*
  The Founding XI's channel back to us.

  Deliberately not a support system — no tickets, no threads, no status
  visible to the player. Eleven players' honest reactions, written down
  where we will actually read them, are worth more than a month of
  speculative development.

  THE TAXONOMY IS THE POINT. "Something is broken" and "I did not
  understand this" arrive through the same button and mean opposite
  things: one is a defect, the other is a design failure. A product that
  cannot tell them apart fixes the wrong one — it patches the code a
  confused player was looking at instead of the sentence that confused
  them. So the player picks, in their own words, and never has to know
  the word "severity".
*/

export type FeedbackKind = "bug" | "confusing" | "idea" | "ai_feedback" | "other";

export type FeedbackResult = { ok: true } | { ok: false; error: string };

/**
 * Roughly what they were on, and nothing more.
 *
 * Three buckets, from the one header every request already carries. No
 * user-agent string is stored, no screen size, no session id — a report
 * needs to tell us "phone" so we know where to reproduce it, and
 * anything finer is a fingerprint we would have to justify keeping.
 */
function deviceClassFrom(ua: string): "mobile" | "tablet" | "desktop" {
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

export async function sendFeedback(input: {
  kind: FeedbackKind;
  /** Where they were. Passed by the client, which is the only thing that knows. */
  route?: string;
  /** The thing being talked about: a video id, a study slug, a recommendation id. */
  objectId?: string;
  /** Kept for the thumbs on AI output: 1 useful, -1 not useful. */
  rating?: 1 | -1;
  body?: string;
}): Promise<FeedbackResult> {
  const body = input.body?.trim().slice(0, 2000) || null;

  // A rating can stand alone; words cannot be empty if words are the point.
  if (!input.rating && !body) {
    return { ok: false, error: "Write a line first — even a short one helps." };
  }

  if (isDemoMode) return { ok: true };

  try {
    const h = await headers();
    const supabase = await createClient();
    if (!supabase) return { ok: false, error: "Backend unavailable." };

    const { error } = await supabase.from("beta_feedback").insert({
      kind: input.kind,
      // `subject` predates 0034 and stays the human-readable surface
      // label; object_id is the machine one. Both, because a report is
      // read by a person first and joined by a query second.
      subject: input.objectId?.slice(0, 200) || null,
      object_id: input.objectId?.slice(0, 200) || null,
      route: input.route?.slice(0, 200) || null,
      device_class: deviceClassFrom(h.get("user-agent") ?? ""),
      /*
        Which build. Vercel sets this on every deployment; locally it is
        absent and stays null rather than pretending to a version. "It
        broke last Tuesday" is answerable only if we know what was
        deployed last Tuesday.
      */
      app_version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
      rating: input.rating ?? null,
      body,
    });
    if (error) return { ok: false, error: "Could not send right now — try again in a moment." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not send right now — try again in a moment." };
  }
}
