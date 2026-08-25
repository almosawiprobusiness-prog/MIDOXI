import type { PlayerSignals, ActionKind } from "./next-best-action";

/*
  Turning what a player has done into what the scorer can read.

  The scorer is pure and knows nothing about databases; this is the only
  place that decides where each signal comes from. Two rules govern that
  choice, and they follow the audit's central distinction:

    DOMAIN TABLES are authoritative for WHAT EXISTS.
      Matches, goals, training and check-ins are read from their own
      adapters. They are the truth, they are complete, and — crucially —
      they include everything recorded BEFORE the event log existed. A
      signal built only from events would tell a two-year user that they
      have never played a match.

    THE EVENT LOG is authoritative for WHAT HAPPENED.
      Two signals exist nowhere else: which study SUBJECT was completed,
      and which film CONCEPT was observed and when. No domain table
      carries them in a form the scorer can match against a goal. These
      are the signals the log was built for.

  So this is deliberately hybrid rather than "read everything from
  events". Purity would cost correctness.

  ───────────────────────────────────────────────────────────────────────
  COST
  ───────────────────────────────────────────────────────────────────────

  Five reads, issued in parallel, all bounded. One event query with a
  window rather than a history scan. This runs on a dashboard load, so
  it is written to be answerable in one round trip's worth of latency
  and not to grow with the length of somebody's career.
*/

/** How far back the event window reaches. */
export const EVENT_WINDOW_DAYS = 60;

/**
 * Whole days between two moments, by CALENDAR DAY.
 *
 * Not `(b - a) / 86400000`, which is subtly wrong for exactly the case
 * the scorer talks about most: a match at 20:00 last night is nine
 * hours ago, which floors to 0 — "today" — when every player and every
 * sentence MIDO writes would call it yesterday. Comparing dates rather
 * than durations makes "1" mean what a person means by it.
 *
 * UTC ON BOTH SIDES. The first version read LOCAL date parts
 * (`getFullYear`) and wrapped them in `Date.UTC`, which mixes two
 * clocks: on a machine five hours behind, two moments on the same UTC
 * day fell on different local days and the answer changed with the
 * server's timezone. Tests caught it.
 *
 * KNOWN LIMIT, worth stating rather than hiding: this is the UTC day,
 * not the PLAYER'S day. For a player several hours from UTC, a late
 * evening match can be counted as the following day. Fixing that
 * properly needs the player's timezone stored on their profile and
 * passed in — a real change, not a tweak, and one that should be made
 * deliberately rather than smuggled in here.
 */
export function daysBetween(from: string | Date, to: string | Date): number {
  const a = new Date(from);
  const b = new Date(to);
  const dayA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const dayB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((dayB - dayA) / 86_400_000);
}

/** Everything the mapping needs, in the shape the adapters return it. */
export interface RawSignalInputs {
  matches: { id: string; date: string; reviewed: boolean }[];
  goals: { id: string; title: string; status: string }[];
  training: { scheduledAt: string }[];
  checkins: { date: string; readiness: number | null }[];
  events: {
    type: string;
    occurredAt: string;
    payload: Record<string, unknown>;
  }[];
  /** Kinds waved away inside the cooldown window. */
  dismissedKinds?: ActionKind[];
}

/**
 * The mapping, pure and testable.
 *
 * Separated from the fetching so the date arithmetic — which is where
 * this kind of code actually goes wrong — can be tested by stating a
 * situation rather than mocking four adapters.
 */
export function toPlayerSignals(raw: RawSignalInputs, now: Date): PlayerSignals {
  const nowIso = now.toISOString();

  /*
    Past and future are split by calendar day, not by timestamp. A match
    kicking off at 20:00 today is not "the last match" at 09:00 — it is
    the next one, and the whole match-preparation branch depends on
    getting that the right way round.
  */
  const past = raw.matches
    .filter((m) => daysBetween(m.date, nowIso) > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  const future = raw.matches
    .filter((m) => daysBetween(m.date, nowIso) <= 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const lastMatch = past[0] ?? null;
  const nextMatch = future[0] ?? null;

  const activeGoals = raw.goals
    .filter((g) => g.status !== "achieved")
    .map((g) => ({ id: g.id, title: g.title }));

  // Training already scheduled for later today or tomorrow has not
  // happened yet, so it cannot count as "recently trained".
  const pastTraining = raw.training
    .filter((t) => t.scheduledAt && daysBetween(t.scheduledAt, nowIso) >= 0)
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));

  /*
    Readiness comes from the most recent check-in that actually SCORED.
    A check-in where too little was reported has `readiness: null`, and
    treating that as zero would invent a low score the player never
    gave — which the scorer would then act on by suppressing training.
  */
  const scored = raw.checkins
    .filter((c) => c.readiness !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
  const latestScored = scored[0] ?? null;

  // "Days since a check-in" counts any check-in, scored or not: the
  // question is whether the player has been asked recently, not whether
  // the answer was complete.
  const anyCheckin = [...raw.checkins].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

  const studyEvents = raw.events
    .filter((e) => e.type === "STUDY_COMPLETED")
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const completedStudies = studyEvents
    .map((e) => ({
      subject: typeof e.payload.subject === "string" ? e.payload.subject : "",
      daysAgo: daysBetween(e.occurredAt, nowIso),
    }))
    .filter((s) => s.subject.length > 0);

  const filmObservations = raw.events
    .filter((e) => e.type === "FILM_OBSERVATION_CREATED")
    .map((e) => ({
      concept: typeof e.payload.concept === "string" ? e.payload.concept : "",
      daysAgo: daysBetween(e.occurredAt, nowIso),
      goalId: typeof e.payload.goalId === "string" ? e.payload.goalId : null,
    }))
    .filter((o) => o.concept.length > 0);

  return {
    daysSinceLastMatch: lastMatch ? daysBetween(lastMatch.date, nowIso) : null,
    lastMatchReviewed: lastMatch ? lastMatch.reviewed : true,
    daysUntilNextMatch: nextMatch ? Math.abs(daysBetween(nextMatch.date, nowIso)) : null,
    readiness: latestScored?.readiness ?? null,
    daysSinceCheckin: anyCheckin ? daysBetween(anyCheckin.date, nowIso) : null,
    activeGoals,
    daysSinceStudy: studyEvents[0] ? daysBetween(studyEvents[0].occurredAt, nowIso) : null,
    daysSinceTraining: pastTraining[0] ? daysBetween(pastTraining[0].scheduledAt, nowIso) : null,
    completedStudies,
    filmObservations,
    /*
      Passed in rather than derived here: dismissals live in the
      recommendation store, which is a server concern, and this function
      is pure so its date arithmetic stays testable. The caller reads
      them and hands them over.
    */
    recentlyDismissed: raw.dismissedKinds ?? [],
  };
}
