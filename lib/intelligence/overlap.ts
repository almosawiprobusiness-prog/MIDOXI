import type { ActionKind } from "./next-best-action";

/*
  Where Next Best Action and the daily Briefing say the same thing.

  These two were built at different times and are, on inspection, two
  implementations of one idea. Both are rule-based rather than
  generative, both refuse to invent, both attach an action to every line,
  and both sort by priority. Six of the Briefing's eight lines have a
  direct counterpart among the scorer's eight kinds.

  Shipping both untouched would put two panels at the top of the Locker
  telling somebody to review the same match in different words — which is
  precisely the dashboard clutter the product is meant to avoid.

  WHAT THIS IS NOT: a deletion. The Briefing works, it is well built, and
  removing a working engine is a decision for a person rather than a
  side effect of adding a feature. So this map lets the two COEXIST: the
  scorer takes the top slot, and the Briefing quietly drops any line the
  scorer has already covered. Nothing is lost, nothing repeats, and
  retiring either one later is a one-line change.

  Recorded here rather than inline in the Locker so the overlap is a
  visible, testable fact rather than a judgement buried in JSX.
*/

/**
 * Briefing line ids that a surfaced recommendation makes redundant.
 *
 * Keyed by the scorer's kind. A kind absent from this map supersedes
 * nothing — `training` and `log_match` have no Briefing counterpart, so
 * both surfaces can speak.
 */
export const SUPERSEDES: Partial<Record<ActionKind, string[]>> = {
  review_match: ["review"],
  checkin: ["checkin"],
  // The Briefing's "readiness" line and a recovery recommendation are
  // the same observation with different endings.
  recovery: ["readiness"],
  study: ["study"],
  match_prep: ["match"],
  set_goal: ["focus"],
};

/**
 * Which Briefing lines to drop, given what the scorer surfaced.
 *
 * The Briefing's "quiet" line is deliberately never suppressed: it is
 * what appears when there is genuinely nothing to say, and it cannot
 * collide with a recommendation because the two cannot both be true.
 */
export function briefingLinesToSuppress(surfaced: ActionKind[]): string[] {
  const out = new Set<string>();
  for (const kind of surfaced) {
    for (const id of SUPERSEDES[kind] ?? []) out.add(id);
  }
  return [...out];
}
