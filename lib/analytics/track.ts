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
  | "recommendation_completed"
  | "recommendation_dismissed";

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
