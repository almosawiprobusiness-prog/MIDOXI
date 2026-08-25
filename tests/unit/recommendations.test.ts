import { describe, it, expect } from "vitest";
import {
  parseSource,
  toSurfaced,
  isStale,
  RECOMMENDATION_TTL_DAYS,
  DISMISS_COOLDOWN_DAYS,
} from "../../lib/intelligence/recommendation-types";
import { rankActions, type PlayerSignals } from "../../lib/intelligence/next-best-action";

/*
  The store's pure half: turning the scorer's compact tokens into
  something a person can be shown, and deciding when advice has stopped
  being true.
*/

describe("source attribution", () => {
  /*
    This is what "why this?" is built from. A recommendation that cannot
    name its own sources is an assertion.
  */
  it("splits a token into a type and an id", () => {
    expect(parseSource("goal:g1")).toEqual({ type: "goal", id: "g1" });
  });

  it("treats a tail with spaces as a label, not an id", () => {
    // Storing a sentence in an `id` field would make it look joinable
    // when nothing can join on it.
    expect(parseSource("observation:Late scan before receiving")).toEqual({
      type: "observation",
      label: "Late scan before receiving",
    });
  });

  it("keeps a multi-part token whole rather than losing its middle", () => {
    expect(parseSource("study:completed:Rodri — scanning before receiving")).toEqual({
      type: "study",
      label: "completed:Rodri — scanning before receiving",
    });
  });

  it("handles a bare token with no tail", () => {
    expect(parseSource("readiness")).toEqual({ type: "readiness" });
    expect(parseSource("readiness:")).toEqual({ type: "readiness" });
  });
});

describe("what gets stored", () => {
  const signals: PlayerSignals = {
    daysSinceLastMatch: 1,
    lastMatchReviewed: false,
    daysUntilNextMatch: 5,
    readiness: 35,
    daysSinceCheckin: 0,
    activeGoals: [{ id: "g1", title: "Weak-foot finishing" }],
    daysSinceStudy: 9,
    daysSinceTraining: 2,
  };

  it("carries the words that were actually shown", () => {
    /*
      Title and reason are stored as shown, not regenerated on read.
      Re-deriving them later from changed data would quietly rewrite
      what MIDO said to somebody.
    */
    const top = rankActions(signals)[0];
    const stored = toSurfaced(top);
    expect(stored.title).toBe(top.title);
    expect(stored.reason).toBe(top.reason);
    expect(stored.priority).toBe(top.score);
  });

  it("turns every source token into an inspectable source", () => {
    const stored = toSurfaced(rankActions(signals)[0]);
    expect(stored.sources.length).toBeGreaterThan(0);
    for (const s of stored.sources) {
      expect(s.type).toBeTruthy();
      expect(s.type).not.toContain(":");
    }
  });
});

describe("going stale", () => {
  const now = new Date("2026-08-24T09:00:00Z");

  it("is not stale before its expiry", () => {
    expect(isStale({ expiresAt: "2026-08-26T09:00:00Z" }, now)).toBe(false);
  });

  it("is stale after it", () => {
    /*
      Advice built on "you played yesterday" is wrong by the weekend. An
      expired row is far better than a stale one that still looks
      current.
    */
    expect(isStale({ expiresAt: "2026-08-22T09:00:00Z" }, now)).toBe(true);
  });

  it("never expires when no expiry was set", () => {
    expect(isStale({ expiresAt: null }, now)).toBe(false);
  });
});

describe("the windows", () => {
  it("keeps advice short-lived and dismissals longer", () => {
    /*
      A dismissal must outlast the advice it dismissed, or waving
      something away would be undone by the next re-rank — which is the
      behaviour that makes a product feel like it is not listening.
    */
    expect(DISMISS_COOLDOWN_DAYS).toBeGreaterThan(RECOMMENDATION_TTL_DAYS);
  });
});
