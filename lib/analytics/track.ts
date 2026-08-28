import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

/*
  Product analytics. NOT the football event log.

  `mido_events` records what a player did in their football life and
  feeds recommendations. THIS records how the product is doing — did
  onboarding finish, was a study started — and feeds nothing a player
  ever sees. The two must not mix: a telemetry row influencing a
  recommendation would be the product optimising for its own metrics
  wearing a football voice, and football history must never inherit
  analytics retention.

  The vocabulary is closed on purpose. A tracking call you can invent at
  the call site becomes a namespace nobody owns; every name below maps
  to one question the beta must answer, and a name that answers no
  question does not get added.
*/

/*
  No signup_completed, deliberately: signups are countable from
  auth.users directly, and any app-side "was this login a first login"
  heuristic would sometimes lie. An analytics vocabulary earns trust the
  same way the product does — by never recording what it cannot know.
*/
export type ProductEvent =
  | "onboarding_completed"
  | "checkin_completed"
  | "goal_created"
  | "study_started"
  | "study_completed"
  | "film_uploaded"
  | "film_analysis_completed"
  | "match_logged"
  | "match_review_completed"
  | "training_completed"
  /*
    The Next Best Action funnel, in full.

    SHOWN is counted when a recommendation is genuinely NEW — the same
    moment the football log records one as created — not on every
    dashboard render. Counting renders would make the denominator a
    measure of how often somebody refreshed the Locker, and the
    shown:opened ratio is the whole hypothesis: does a player act on
    what MIDO puts first?

    WHY_VIEWED is the one that tells us if the explanation is doing any
    work. If players open recommendations without ever asking why, the
    "why this?" line is decoration; if they ask why and then do not act,
    the reasoning is not convincing.
  */
  | "recommendation_shown"
  | "recommendation_opened"
  | "recommendation_why_viewed"
  | "recommendation_completed"
  | "recommendation_dismissed"
  /*
    The MIDO XI Capture funnel, in three events that each answer one
    validation question. OPENED: does an installed extension get used?
    (fired on an authenticated session check — one per popup open, so
    distinct users per week is the connection metric and the count is
    the habit metric.) SAVED: does watching become capturing? — props
    carry linkedToGoal and the category enum, never the observation
    text. OPENED_IN_MIDO: do captured moments get revisited, which is
    the difference between a notebook and a development system.
  */
  | "extension_opened"
  | "capture_saved"
  | "capture_opened_in_mido";

/**
 * Record one product action. Fire-and-forget by design.
 *
 * Never throws and never blocks: analytics failing must cost us a data
 * point, not the player their action — the same asymmetry the event
 * emitter documents. No-op in demo (nothing to learn from ourselves)
 * and before migration 0033 (the insert fails, is swallowed, and the
 * product carries on).
 *
 * `props` carries identifiers and small enums only — a kind, a slug, a
 * count. Never free text from the player's football record: what they
 * wrote in a review belongs to them, not to our dashboards.
 */
export async function track(
  event: ProductEvent,
  props: Record<string, string | number | boolean> = {},
): Promise<void> {
  if (isDemoMode) return;

  try {
    const supabase = await createClient();
    if (!supabase) return;
    await supabase.from("product_analytics").insert({ event, props });
  } catch {
    // A lost data point, accepted silently.
  }
}
