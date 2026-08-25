/*
  What should this player do next?

  Pure, deterministic, dependency-free — no database, no model call, no
  clock of its own. Signals in, ranked actions out. That makes it
  testable, instant, and above all EXPLAINABLE: every number below can be
  traced to a rule somebody can argue with.

  ───────────────────────────────────────────────────────────────────────
  WHY THIS IS NOT AN LLM CALL
  ───────────────────────────────────────────────────────────────────────

  The obvious implementation is to hand a model the player's history and
  ask what they should do. It would work, roughly, and it would be wrong
  in three ways that matter:

    · It cannot be trusted with the one answer that has a safety edge.
      "Readiness is low and there is a match tomorrow" must never produce
      "go and do a maximal finishing session". That is a rule, and rules
      belong in code where they can be tested and cannot drift between
      requests.

    · It cannot explain itself honestly. A model asked to justify its own
      output will produce a plausible reason rather than the actual one.
      Here the reason IS the calculation.

    · It costs money and latency on every page load, for a question whose
      inputs change a few times a day.

  So: CODE DECIDES, AI EXPLAINS. This file ranks. A model may later be
  asked to phrase the top result more warmly, and it will be phrasing a
  decision it did not make.
*/

export type ActionKind =
  | "review_match"
  | "recovery"
  | "study"
  | "training"
  | "match_prep"
  | "checkin"
  | "log_match"
  | "set_goal";

/**
 * Everything the ranking is allowed to look at.
 *
 * Deliberately a flat, small, serialisable shape. If a signal is not
 * here it cannot influence the ranking, which is what stops this
 * quietly growing into "pass the whole database".
 *
 * All "daysSince"/"inDays" values are numbers rather than dates so the
 * function stays pure and has no clock — the caller resolves time once,
 * which also means tests can state a situation directly.
 */
export interface PlayerSignals {
  /** Days since the most recent match. Null if none on record. */
  daysSinceLastMatch: number | null;
  /** Has the most recent match been reviewed? */
  lastMatchReviewed: boolean;
  /** Days until the next fixture. Null if none scheduled. */
  daysUntilNextMatch: number | null;
  /** 0–100. Null when nothing has been recorded. */
  readiness: number | null;
  /** Days since the last readiness check-in. Null if never. */
  daysSinceCheckin: number | null;
  /** Active development goals, most important first. */
  activeGoals: { id: string; title: string }[];
  /** Days since any study was completed. Null if never. */
  daysSinceStudy: number | null;
  /** Days since training was logged. Null if never. */
  daysSinceTraining: number | null;
  /**
   * Kinds the player has been shown and dismissed recently.
   *
   * Repeatedly recommending something somebody keeps waving away is how
   * a helpful product becomes a nagging one.
   */
  recentlyDismissed?: ActionKind[];
}

export interface RankedAction {
  kind: ActionKind;
  title: string;
  /** 0–100. Comparable across kinds; only the ORDER is meaningful. */
  score: number;
  /** Plain-language, and true — assembled from the rules that fired. */
  reason: string;
  /** Which signals produced this, for "why this?" and for debugging. */
  sources: string[];
  /** Rough minutes, so the player can judge whether they have time. */
  minutes?: number;
}

/** Below this, an action is not worth anyone's attention. */
const FLOOR = 25;

/*
  Readiness bands.

  Deliberately conservative and stated once. The scorer never invents a
  number from these — it only decides whether hard work should be
  encouraged, discouraged, or left alone.
*/
const LOW_READINESS = 45;
const HIGH_READINESS = 70;

interface Candidate {
  kind: ActionKind;
  title: string;
  score: number;
  reasons: string[];
  sources: string[];
  minutes?: number;
}

/**
 * Rank what to do next.
 *
 * Returns every eligible action, highest first. The caller decides how
 * many to show — the Locker shows one prominently and two quietly.
 */
export function rankActions(s: PlayerSignals): RankedAction[] {
  const out: Candidate[] = [];
  const dismissed = new Set(s.recentlyDismissed ?? []);

  const matchTomorrow = s.daysUntilNextMatch !== null && s.daysUntilNextMatch <= 1;
  const matchSoon = s.daysUntilNextMatch !== null && s.daysUntilNextMatch <= 3;
  const lowReadiness = s.readiness !== null && s.readiness < LOW_READINESS;
  const goodReadiness = s.readiness !== null && s.readiness >= HIGH_READINESS;

  // ── review the last match ───────────────────────────────────────────
  /*
    The strongest signal in the product. A played, unreviewed match is a
    piece of the player's own evidence sitting unused, and its value
    decays fast — the details are gone within a week.
  */
  if (s.daysSinceLastMatch !== null && !s.lastMatchReviewed) {
    const d = s.daysSinceLastMatch;
    // Freshest is most valuable; past a week the memory has gone.
    const decay = d <= 1 ? 30 : d <= 3 ? 22 : d <= 7 ? 12 : 2;
    out.push({
      kind: "review_match",
      title: "Review your last match",
      score: 58 + decay,
      reasons: [
        d <= 1
          ? "you played yesterday and have not reviewed it yet"
          : `you played ${d} days ago and have not reviewed it yet`,
      ],
      sources: ["match:last", "match:unreviewed"],
      minutes: 10,
    });
  }

  // ── recovery ────────────────────────────────────────────────────────
  /*
    Rises with a low readiness score and with a match approaching. This
    is the rule that must never lose to a training recommendation, which
    is why it is scored rather than left to judgement.
  */
  if (lowReadiness) {
    const urgency = matchTomorrow ? 30 : matchSoon ? 18 : 8;
    /*
      Recovery is driven by DEPLETION, not only by the next fixture.

      This first scored urgency from the fixture alone, which put study
      above recovery for a player who was depleted the day after a match
      with the next one five days out — and that is backwards. A distant
      fixture makes hard TRAINING less urgent; it does nothing to make
      recovery less needed. Post-match is the classic recovery case, so
      recent exertion counts in its own right.
    */
    const justPlayed = s.daysSinceLastMatch !== null && s.daysSinceLastMatch <= 2;
    out.push({
      kind: "recovery",
      title: "Recover today",
      score: 61 + urgency + (justPlayed ? 16 : 0),
      reasons: [
        `your readiness is ${s.readiness}`,
        justPlayed ? "and you have just played" : "",
        matchTomorrow ? "and you play tomorrow" : matchSoon ? "and you play soon" : "",
      ].filter(Boolean),
      sources: [
        "readiness:low",
        justPlayed ? "match:recent" : "",
        matchTomorrow ? "fixture:tomorrow" : "fixture:none",
      ].filter(Boolean),
      minutes: 20,
    });
  }

  // ── match preparation ───────────────────────────────────────────────
  if (matchSoon) {
    out.push({
      kind: "match_prep",
      title: matchTomorrow ? "Prepare for tomorrow" : "Prepare for the match",
      score: matchTomorrow ? 74 : 52,
      reasons: [
        matchTomorrow
          ? "you play tomorrow"
          : `you play in ${s.daysUntilNextMatch} days`,
      ],
      sources: ["fixture:next"],
      minutes: 15,
    });
  }

  // ── study ───────────────────────────────────────────────────────────
  /*
    Study is the action most tied to a goal, and the one that survives
    low readiness — you can watch football with tired legs. That is why
    it scores well on exactly the days training should not.
  */
  if (s.activeGoals.length > 0) {
    const goal = s.activeGoals[0];
    const stale = s.daysSinceStudy === null ? 26 : s.daysSinceStudy >= 7 ? 20 : s.daysSinceStudy >= 3 ? 10 : 0;
    // Rewarded when hard work is off the table anyway.
    const restBonus = lowReadiness ? 12 : 0;
    out.push({
      kind: "study",
      title: `Study: ${goal.title}`,
      score: 46 + stale + restBonus,
      reasons: [
        `your current focus is ${goal.title.toLowerCase()}`,
        s.daysSinceStudy === null
          ? "and you have not studied yet"
          : s.daysSinceStudy >= 7
            ? `and you have not studied for ${s.daysSinceStudy} days`
            : "",
        restBonus ? "— and it asks nothing of your legs" : "",
      ].filter(Boolean),
      sources: [`goal:${goal.id}`, "study:recency"],
      minutes: 12,
    });
  }

  // ── training ────────────────────────────────────────────────────────
  /*
    THE SAFETY RULE, and the reason this file is not a prompt.

    Hard training is suppressed when readiness is low or a match is
    tomorrow. Not down-weighted into "unlikely" — pushed below the floor,
    so it cannot be surfaced at all. A ranking that merely made it less
    probable would still recommend it on the day it should not.
  */
  {
    const suppressed = lowReadiness || matchTomorrow;
    const base = goodReadiness ? 58 : 44;
    const stale = s.daysSinceTraining === null ? 10 : s.daysSinceTraining >= 3 ? 8 : 0;
    out.push({
      kind: "training",
      title: "Train",
      score: suppressed ? 12 : base + stale,
      reasons: suppressed
        ? [lowReadiness ? "held back while your readiness is low" : "held back the day before a match"]
        : [goodReadiness ? "your readiness is good" : "you are clear to train"],
      sources: ["readiness", "training:recency"],
      minutes: 60,
    });
  }

  // ── check in ────────────────────────────────────────────────────────
  /*
    Scored on absence, not presence: this only matters when MIDO has
    nothing recent to reason from, and it is the cheapest way to make
    everything else above it more accurate.
  */
  {
    const since = s.daysSinceCheckin;
    if (since === null || since >= 1) {
      out.push({
        kind: "checkin",
        title: "Check in",
        score: since === null ? 66 : since >= 3 ? 54 : 38,
        reasons: [
          since === null
            ? "MIDO has no readiness for you yet, so it is guessing at the rest"
            : `your last check-in was ${since} days ago`,
        ],
        sources: ["checkin:recency"],
        minutes: 1,
      });
    }
  }

  // ── the empty cases ─────────────────────────────────────────────────
  /*
    Said plainly rather than filled with something generic. A product
    that invents a recommendation when it knows nothing is a product
    whose recommendations cannot be trusted when it does.
  */
  if (s.activeGoals.length === 0) {
    out.push({
      kind: "set_goal",
      title: "Set a development focus",
      score: 70,
      reasons: ["MIDO cannot recommend anything specific until it knows what you are working on"],
      sources: ["goal:none"],
      minutes: 3,
    });
  }

  if (s.daysSinceLastMatch === null) {
    out.push({
      kind: "log_match",
      title: "Log your last match",
      score: 50,
      reasons: ["there are no matches on record yet, so MIDO cannot see your form"],
      sources: ["match:none"],
      minutes: 5,
    });
  }

  return out
    .filter((c) => c.score >= FLOOR)
    // Something waved away recently drops but is not deleted: the
    // situation may genuinely have changed.
    .map((c) => (dismissed.has(c.kind) ? { ...c, score: Math.round(c.score * 0.5) } : c))
    .filter((c) => c.score >= FLOOR)
    .sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind))
    .map((c) => ({
      kind: c.kind,
      title: c.title,
      score: Math.round(c.score),
      reason: sentence(c.reasons),
      sources: c.sources,
      minutes: c.minutes,
    }));
}

/** Joins the rules that fired into one readable line. */
function sentence(parts: string[]): string {
  const joined = parts
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s+—\s+/g, " — ")
    .trim();
  return joined.charAt(0).toUpperCase() + joined.slice(1) + (/[.!?]$/.test(joined) ? "" : ".");
}

/**
 * Does MIDO know enough to be useful?
 *
 * Used by surfaces to decide between showing a recommendation and saying
 * so honestly. The spec's rule, encoded: never show AI INSIGHT unless it
 * rests on real data.
 */
export function hasEnoughToRecommend(s: PlayerSignals): boolean {
  return (
    s.activeGoals.length > 0 ||
    s.daysSinceLastMatch !== null ||
    s.readiness !== null
  );
}
