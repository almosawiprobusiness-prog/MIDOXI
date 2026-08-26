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

/*
  How long an answered recommendation stays answered.

  Both buttons are claims the DATA does not yet reflect. "Done" is a
  claim about the past — the session may not be logged for hours.
  "Not now" is a claim about today. In neither case does anything in the
  underlying record change, so without this window the scorer re-ranks
  identical inputs and puts the same card straight back. Dismissing
  something and watching it return, promoted, teaches people that the
  controls are decorative.

  ONE DAY, and no longer. This is not the mechanism that makes a
  dismissal stick — DISMISS_COOLDOWN_DAYS above is, by halving the score
  for a week, so a waved-away action can still come back when the
  situation genuinely changes. This window is narrower and blunter: not
  today, because you already answered today.
*/
export const SETTLED_QUIET_DAYS = 1;

/*
  What "why this?" is allowed to say.

  The scorer's tokens are keys — `goal:g1`, `study:recency` — because it
  is pure and has no way to look a title up. Printed as-is they read as
  "GOAL g1", which is worse than saying nothing: it looks like the system
  is quoting evidence while actually showing the player its plumbing.

  So each token is translated into the INPUT it names. Not a restatement
  of the advice — the reason line above already carries that — but the
  thing MIDO consulted, in words a footballer would use. Where a token
  already carries a human label (an observation is a real football
  phrase), the label is the answer and no translation is needed.
*/
const SOURCE_PHRASE: Record<string, string> = {
  "goal": "Your current development focus",
  "goal:none": "You have no development focus set",
  "match:last": "Your last match",
  "match:unreviewed": "It has no review yet",
  "match:recent": "You played in the last two days",
  "match:none": "You have no matches logged",
  "readiness": "Your readiness check-in",
  "readiness:low": "Your readiness is below your normal",
  "fixture:next": "Your next fixture",
  "fixture:tomorrow": "You play tomorrow",
  "fixture:none": "No fixture close",
  "study:recency": "When you last studied",
  "study:completed": "A study you have already completed",
  "training:recency": "When you last trained",
  "checkin:recency": "When you last checked in",
};

/**
 * A source, in words rather than keys.
 *
 * Returns null when a source has nothing meaningful to say to a player —
 * the panel drops those rather than padding the list, because a "why
 * this?" that lists six items to prove diligence is doing the same job
 * as no explanation at all.
 */
export function describeSource(source: RecommendationSource): string | null {
  const tail = source.label ?? source.id ?? null;

  /*
    `study:completed:Rodri — scanning` puts its qualifier inside the
    label, because parseSource splits on the FIRST colon and everything
    after it contains a space. Peel that qualifier back off, so the table
    can match on it and so what is shown is the football words rather
    than the key that happened to precede them.
  */
  let qualifier: string | null = null;
  let human: string | null = tail;
  if (tail) {
    const at = tail.indexOf(":");
    if (at > 0 && !/\s/.test(tail.slice(0, at))) {
      qualifier = tail.slice(0, at);
      human = tail.slice(at + 1) || null;
    }
  }

  const keys = [
    qualifier ? `${source.type}:${qualifier}` : null,
    tail ? `${source.type}:${tail}` : null,
    source.type,
  ].filter((k): k is string => Boolean(k));

  for (const key of keys) {
    const phrase = SOURCE_PHRASE[key];
    if (!phrase) continue;
    // Name the specific thing when the token carried one.
    return qualifier && human ? `${phrase}: ${human}` : phrase;
  }

  // A label with no entry is already football words — quote it. A bare
  // id with no entry is plumbing, and is dropped.
  return human && /\s/.test(human) ? human : null;
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
