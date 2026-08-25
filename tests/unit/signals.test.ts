import { describe, it, expect } from "vitest";
import { toPlayerSignals, daysBetween, type RawSignalInputs } from "../../lib/intelligence/signals";

/*
  The mapping between what a player has done and what the scorer reads.

  Almost every way this can be wrong is a date being wrong by one, so
  that is what most of these are about. A signal that is off by a day
  turns "you played yesterday" into "you played today" and moves the
  whole ranking.
*/

const NOW = new Date("2026-08-24T09:00:00Z");

const empty: RawSignalInputs = {
  matches: [],
  goals: [],
  training: [],
  checkins: [],
  events: [],
};

const build = (over: Partial<RawSignalInputs>) => toPlayerSignals({ ...empty, ...over }, NOW);

describe("counting days", () => {
  it("counts by calendar day, not by elapsed hours", () => {
    /*
      The case this function exists for. A match kicking off at 20:00
      last night is nine hours ago — which a duration would floor to
      zero, "today", when every player and every sentence MIDO writes
      calls it yesterday.
    */
    expect(daysBetween("2026-08-23T20:00:00Z", "2026-08-24T09:00:00Z")).toBe(1);
  });

  it("calls the same day zero however far apart the clocks are", () => {
    expect(daysBetween("2026-08-24T00:05:00Z", "2026-08-24T23:55:00Z")).toBe(0);
  });

  it("goes negative for the future", () => {
    expect(daysBetween("2026-08-26T10:00:00Z", "2026-08-24T09:00:00Z")).toBe(-2);
  });
});

describe("matches", () => {
  const played = (date: string, reviewed = false) => ({ id: date, date, reviewed });

  it("finds the most recent match that has actually been played", () => {
    const s = build({
      matches: [played("2026-08-10T15:00:00Z"), played("2026-08-22T15:00:00Z")],
    });
    expect(s.daysSinceLastMatch).toBe(2);
  });

  it("does not treat a match later today as one already played", () => {
    // The whole match-preparation branch depends on this being the right
    // way round: a 20:00 kick-off is the NEXT match at 09:00.
    const s = build({ matches: [played("2026-08-24T20:00:00Z")] });
    expect(s.daysSinceLastMatch).toBeNull();
    expect(s.daysUntilNextMatch).toBe(0);
  });

  it("finds the nearest fixture ahead, not the furthest", () => {
    const s = build({
      matches: [played("2026-09-20T15:00:00Z"), played("2026-08-27T15:00:00Z")],
    });
    expect(s.daysUntilNextMatch).toBe(3);
  });

  it("carries whether the last one was reviewed", () => {
    expect(build({ matches: [played("2026-08-22T15:00:00Z", false)] }).lastMatchReviewed).toBe(false);
    expect(build({ matches: [played("2026-08-22T15:00:00Z", true)] }).lastMatchReviewed).toBe(true);
  });

  it("reports no unreviewed match when there are no matches at all", () => {
    // `false` here would make the scorer recommend reviewing a match
    // that does not exist.
    expect(build({}).lastMatchReviewed).toBe(true);
    expect(build({}).daysSinceLastMatch).toBeNull();
  });
});

describe("readiness", () => {
  it("takes the most recent check-in that actually scored", () => {
    const s = build({
      checkins: [
        { date: "2026-08-24", readiness: null },
        { date: "2026-08-23", readiness: 62 },
      ],
    });
    expect(s.readiness).toBe(62);
  });

  it("never turns an unscored check-in into a low score", () => {
    /*
      A check-in where too little was reported scores null. Reading that
      as zero would invent a low readiness the player never gave — and
      the scorer would act on it by suppressing training.
    */
    const s = build({ checkins: [{ date: "2026-08-24", readiness: null }] });
    expect(s.readiness).toBeNull();
  });

  it("still counts an unscored check-in as having checked in", () => {
    // Two different questions: has MIDO been told anything today, and
    // does it have a number.
    const s = build({ checkins: [{ date: "2026-08-24", readiness: null }] });
    expect(s.daysSinceCheckin).toBe(0);
  });

  it("reports never checked in as null, not as a large number", () => {
    expect(build({}).daysSinceCheckin).toBeNull();
  });
});

describe("training", () => {
  it("ignores a session scheduled for tomorrow", () => {
    // Work that has not happened cannot count as recently trained.
    const s = build({ training: [{ scheduledAt: "2026-08-25T18:00:00Z" }] });
    expect(s.daysSinceTraining).toBeNull();
  });

  it("counts a session earlier today", () => {
    const s = build({ training: [{ scheduledAt: "2026-08-24T07:00:00Z" }] });
    expect(s.daysSinceTraining).toBe(0);
  });

  it("takes the most recent of several", () => {
    const s = build({
      training: [{ scheduledAt: "2026-08-14T18:00:00Z" }, { scheduledAt: "2026-08-21T18:00:00Z" }],
    });
    expect(s.daysSinceTraining).toBe(3);
  });
});

describe("goals", () => {
  it("keeps active and monitoring, drops achieved", () => {
    const s = build({
      goals: [
        { id: "g1", title: "Scanning", status: "active" },
        { id: "g2", title: "Weak foot", status: "monitoring" },
        { id: "g3", title: "Done", status: "achieved" },
      ],
    });
    expect(s.activeGoals.map((g) => g.id)).toEqual(["g1", "g2"]);
  });
});

describe("what only the event log knows", () => {
  /*
    These two signals exist in no domain table in a form the scorer can
    match against a goal. They are the reason the log was built.
  */
  it("reads completed study subjects with their age", () => {
    const s = build({
      events: [
        {
          type: "STUDY_COMPLETED",
          occurredAt: "2026-08-22T10:00:00Z",
          payload: { subject: "Rodri — scanning before receiving" },
        },
      ],
    });
    expect(s.completedStudies).toEqual([
      { subject: "Rodri — scanning before receiving", daysAgo: 2 },
    ]);
    expect(s.daysSinceStudy).toBe(2);
  });

  it("reads film observations with their concept and goal", () => {
    const s = build({
      events: [
        {
          type: "FILM_OBSERVATION_CREATED",
          occurredAt: "2026-08-23T10:00:00Z",
          payload: { concept: "Late scan before receiving", goalId: "g1" },
        },
      ],
    });
    expect(s.filmObservations).toEqual([
      { concept: "Late scan before receiving", daysAgo: 1, goalId: "g1" },
    ]);
  });

  it("drops events whose payload lost the field that matters", () => {
    // A study with no subject cannot be matched to a goal, so it is not
    // a signal — it is a row the scorer would read and discard.
    const s = build({
      events: [
        { type: "STUDY_COMPLETED", occurredAt: "2026-08-22T10:00:00Z", payload: {} },
        { type: "FILM_OBSERVATION_CREATED", occurredAt: "2026-08-22T10:00:00Z", payload: {} },
      ],
    });
    expect(s.completedStudies).toEqual([]);
    expect(s.filmObservations).toEqual([]);
  });

  it("survives a payload of the wrong type without throwing", () => {
    const s = build({
      events: [
        { type: "STUDY_COMPLETED", occurredAt: "2026-08-22T10:00:00Z", payload: { subject: 42 } },
      ],
    });
    expect(s.completedStudies).toEqual([]);
  });
});

describe("a player with no history", () => {
  it("reports absence rather than zeroes", () => {
    /*
      Every one of these being null is what lets the scorer say "MIDO
      needs more information" instead of ranking against invented data.
    */
    const s = build({});
    expect(s.daysSinceLastMatch).toBeNull();
    expect(s.daysUntilNextMatch).toBeNull();
    expect(s.readiness).toBeNull();
    expect(s.daysSinceCheckin).toBeNull();
    expect(s.daysSinceStudy).toBeNull();
    expect(s.daysSinceTraining).toBeNull();
    expect(s.activeGoals).toEqual([]);
  });
});
