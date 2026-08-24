import { describe, it, expect } from "vitest";
import { recoveryBand, recoveryContext, formatSleep } from "../../lib/health/providers";

/*
  `recoveryContext` is the one line MIDO XI adds that a wearable app
  cannot write for itself: WHOOP knows the score, but not that there is a
  match on Saturday.

  What is pinned hardest here is what it must NOT say. A recovery page
  that invents "rest today" or "reduce your load" is the same invented
  physiology the whole module was built to remove — nothing measured
  that. It states two facts in one sentence and stops.
*/

const MATCH = { opponent: "Riverside Athletic", daysAway: 3 };

describe("banding matches WHOOP's own", () => {
  it("uses WHOOP's thresholds, so a green score is green in both apps", () => {
    expect(recoveryBand(67)).toBe("high");
    expect(recoveryBand(66)).toBe("moderate");
    expect(recoveryBand(34)).toBe("moderate");
    expect(recoveryBand(33)).toBe("low");
  });

  it("has no band for a night nothing measured", () => {
    // An unscored night must not fall through to "low" — that would read
    // as a warning nobody's body actually produced.
    expect(recoveryBand(null)).toBeNull();
  });
});

describe("the football line", () => {
  it("puts the score and the fixture in one sentence", () => {
    expect(recoveryContext(30, MATCH)).toBe("Low recovery, and you play Riverside Athletic in 3 days.");
    expect(recoveryContext(80, MATCH)).toBe("Recovered, and you play Riverside Athletic in 3 days.");
    expect(recoveryContext(50, MATCH)).toBe("Moderate recovery, and you play Riverside Athletic in 3 days.");
  });

  it("says today and tomorrow like a person would", () => {
    expect(recoveryContext(30, { ...MATCH, daysAway: 0 })).toMatch(/today\.$/);
    expect(recoveryContext(30, { ...MATCH, daysAway: 1 })).toMatch(/tomorrow\.$/);
    // Never "in 1 days".
    expect(recoveryContext(30, { ...MATCH, daysAway: 1 })).not.toMatch(/1 days/);
  });

  it("never prescribes — no rest, no load advice, no verdict", () => {
    /*
      The important one. Every band, with a match imminent, is exactly the
      situation where a product is tempted to tell somebody what to do
      about their own body.
    */
    for (const score of [10, 30, 50, 70, 95]) {
      const line = recoveryContext(score, { ...MATCH, daysAway: 1 }) ?? "";
      expect(line, `score ${score}`).not.toMatch(/rest|sleep more|reduce|ease off|should|avoid|skip|train/i);
    }
  });

  it("says nothing when there is no fixture to relate the score to", () => {
    // The band label alone already says everything true.
    expect(recoveryContext(30, null)).toBeNull();
  });

  it("says nothing when nothing was measured", () => {
    expect(recoveryContext(null, MATCH)).toBeNull();
  });
});

describe("sleep, in words", () => {
  it("reads as hours and minutes", () => {
    expect(formatSleep(462)).toBe("7h 42m");
    expect(formatSleep(45)).toBe("45m");
  });

  it("is absent, not zero, when unmeasured", () => {
    expect(formatSleep(null)).toBeNull();
  });
});
