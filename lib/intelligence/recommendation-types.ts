import type { ActionKind, RankedAction } from "./next-best-action";

/*
  A recommendation, once it has been shown to somebody.

  The scorer produces candidates on every call; this is the small subset
  that was actually put in front of a person and therefore has a life of
  its own — it can be completed, waved away, or go stale.

  ───────────────────────────────────────────────────────────────────────
  WHY THIS IS NOT "SAVE EVERYTHING THE SCORER RETURNS"
  ───────────────────────────────────────────────────────────────────────

  The scorer returns six to eight candidates every time it runs, and it
  runs on a dashboard load. Persisting all of them would write tens of
  thousands of rows a week per user, almost none of which anybody ever
  saw, and the table would stop being a record of advice given and become
  a log of arithmetic.

  So only what is SURFACED is stored, and at most one active row per kind
  per person — a re-rank updates the row rather than adding to it. What
  the table then holds is answerable and small: what has MIDO actually
  told this player, and what did they do about it.
*/

export type RecommendationStatus = "active" | "completed" | "dismissed" | "expired";

/**
 * Where a recommendation came from, in a form somebody can inspect.
 *
 * The scorer emits compact strings (`goal:g1`, `observation:Late scan`)
 * because it is pure and has no database. They are parsed into this on
 * the way into storage, so "why this?" can name the goal rather than
 * print an internal token.
 */
export interface RecommendationSource {
  type: string;
  id?: string;
  /** The human-readable thing, when the id is not one. */
  label?: string;
}

export interface Recommendation {
  id: string;
  kind: ActionKind;
  title: string;
  reason: string;
  priority: number;
  sources: RecommendationSource[];
  status: RecommendationStatus;
  createdAt: string;
  expiresAt: string | null;
}

/*
  How long a surfaced recommendation stays relevant.

  Deliberately short. Advice built on "you played yesterday" is wrong by
  the weekend, and an expired row is far better than a stale one that
  still looks current — the second is the product confidently telling
  somebody something that stopped being true.
*/
export const RECOMMENDATION_TTL_DAYS = 3;

/*
  How long a dismissal is respected.

  Long enough that waving something away means something, short enough
  that a genuinely changed situation can bring it back. The scorer
  already halves rather than removes a dismissed kind, so this is the
  window in which that halving applies.
*/
export const DISMISS_COOLDOWN_DAYS = 7;

/**
 * Turn the scorer's compact source tokens into inspectable sources.
 *
 * `goal:g1` → `{ type: "goal", id: "g1" }`
 * `observation:Late scan before receiving` → `{ type: "observation", label: "…" }`
 *
 * The distinction between `id` and `label` is decided by shape, not by
 * the caller: a token whose tail contains a space is a description, not
 * a key, and storing a sentence in an `id` field would make it look
 * joinable when it is not.
 */
export function parseSource(token: string): RecommendationSource {
  const at = token.indexOf(":");
  if (at < 0) return { type: token };

  const type = token.slice(0, at);
  const rest = token.slice(at + 1);
  if (!rest) return { type };

  // `study:completed:Rodri — scanning` keeps its middle segment as part
  // of the label rather than being mistaken for an id.
  return /\s/.test(rest) ? { type, label: rest } : { type, id: rest };
}

/** What gets written when a ranked action is actually shown. */
export interface SurfacedInput {
  kind: ActionKind;
  title: string;
  reason: string;
  priority: number;
  sources: RecommendationSource[];
}

export function toSurfaced(action: RankedAction): SurfacedInput {
  return {
    kind: action.kind,
    title: action.title,
    reason: action.reason,
    priority: action.score,
    sources: action.sources.map(parseSource),
  };
}

/**
 * Has this passed its useful life?
 *
 * Computed rather than relied on being swept: a row can sit past its
 * expiry for as long as nothing runs, and a reader that trusted `status`
 * alone would show week-old advice as current.
 */
export function isStale(r: Pick<Recommendation, "expiresAt">, now: Date = new Date()): boolean {
  if (!r.expiresAt) return false;
  return new Date(r.expiresAt).getTime() < now.getTime();
}
