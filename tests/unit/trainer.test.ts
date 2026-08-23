import { describe, it, expect } from "vitest";
import { composeProgram, weekIntent, waved, programRules } from "../../lib/data/trainer-compose";
import { buildSeries, byWeek, weeksSince } from "../../lib/data/trainer-types";
import { TESTS, QUALITIES, matchQualities, testsForQuality } from "../../lib/knowledge/physical";
import type { Assessment, ProgramSessionRow } from "../../lib/data/trainer-types";

/*
  The trainer engine's deterministic half, plus the maths behind every number a
  trainer reads. These run for every block whether or not Claude is reachable,
  so they are the ones that must not drift.
*/

const ctx = {
  objective: "Explosive separation over the first 5-10 metres",
  weeks: 6,
  sessionsPerWeek: 2,
  limitations: "Left ankle — no deep dorsiflexion loading",
  position: "RW",
};

describe("physical library", () => {
  it("has unique quality slugs and unique test ids", () => {
    expect(new Set(QUALITIES.map((q) => q.slug)).size).toBe(QUALITIES.length);
    expect(new Set(TESTS.map((t) => t.id)).size).toBe(TESTS.length);
  });

  it("gives every test a protocol, a unit and a direction", () => {
    for (const t of TESTS) {
      expect(t.protocol.length, t.id).toBeGreaterThan(20);
      expect(t.unit.length, t.id).toBeGreaterThan(0);
      expect(["lower", "higher"], t.id).toContain(t.better);
      expect(t.retestWeeks, t.id).toBeGreaterThan(0);
    }
  });

  it("gives every quality trainable content and a football reason", () => {
    for (const q of QUALITIES) {
      expect(q.exercises.length, q.slug).toBeGreaterThanOrEqual(3);
      expect(q.progression.length, q.slug).toBeGreaterThanOrEqual(2);
      expect(q.regression.length, q.slug).toBeGreaterThanOrEqual(1);
      expect(q.why.length, q.slug).toBeGreaterThan(20);
      // Every quality has at least one test that measures it.
      expect(testsForQuality(q.slug).length, q.slug).toBeGreaterThanOrEqual(1);
    }
  });

  it("selects qualities from the objective, not at random", () => {
    expect(matchQualities("hamstring rehab, return to play").map((q) => q.slug)).toContain("return-to-play");
    expect(matchQualities("hold sprint quality late in matches").map((q) => q.slug)).toContain("repeat-sprint");
    expect(matchQualities("explosive first three steps").map((q) => q.slug)).toContain("acceleration");
  });
});

describe("program composition", () => {
  it("waves the block: build weeks, a deload, and a retest at the end", () => {
    expect(weekIntent(1, 6)).toBe("build");
    expect(weekIntent(4, 6)).toBe("deload");
    expect(weekIntent(6, 6)).toBe("test");
    // A short block still finishes with a retest.
    expect(weekIntent(2, 2)).toBe("test");
  });

  it("produces one session per day per week", () => {
    const p = composeProgram(ctx);
    expect(p.sessions).toHaveLength(ctx.weeks * ctx.sessionsPerWeek);
    expect(new Set(p.sessions.map((s) => s.week)).size).toBe(ctx.weeks);
  });

  it("adds volume through the build weeks and cuts it on the deload", () => {
    expect(waved("6 x 10m · walk-back recovery", "build", 1)).toBe("6 x 10m · walk-back recovery");
    expect(waved("6 x 10m · walk-back recovery", "build", 3)).toBe("8 x 10m · walk-back recovery");
    expect(waved("6 x 10m · walk-back recovery", "deload", 4)).toBe("4 x 10m · walk-back recovery · deload");
  });

  it("makes the retest week the tests themselves, not the training", () => {
    const p = composeProgram(ctx);
    const retest = p.sessions.filter((s) => s.intent === "test");
    expect(retest.length).toBeGreaterThan(0);
    const names = retest[0].exercises.map((e) => e.name);
    const testLabels = TESTS.map((t) => t.label);
    expect(names.some((n) => testLabels.includes(n))).toBe(true);
    // The block's training work does not appear in a retest session.
    expect(names).not.toContain("Resisted sled push 15m");
  });

  it("carries a recorded limitation into every session", () => {
    const p = composeProgram(ctx);
    for (const s of p.sessions) {
      const check = s.exercises.find((e) => e.name === "Limitation check");
      expect(check, `week ${s.week} day ${s.day}`).toBeTruthy();
      expect(check!.cue).toContain("Left ankle");
    }
  });

  it("never programs a session with nothing in it", () => {
    for (const objective of ["explosive first steps", "aerobic base", "hamstring rehab", "zzz"]) {
      const p = composeProgram({ ...ctx, objective });
      for (const s of p.sessions) {
        const work = s.exercises.filter((e) => e.slot !== "prep");
        expect(work.length, `${objective} · week ${s.week}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("returns the progression rules behind the block it built", () => {
    const p = composeProgram(ctx);
    const rules = programRules(p.qualities);
    expect(rules.length).toBe(p.qualities.length);
    for (const r of rules) expect(r.progression.length).toBeGreaterThan(0);
  });
});

const assessment = (test: string, value: number, testedOn: string): Assessment => ({
  id: `${test}-${testedOn}`,
  athleteId: "a1",
  test,
  value,
  unit: "s",
  side: null,
  testedOn,
  notes: "",
  createdAt: testedOn,
});

describe("assessment maths", () => {
  it("treats a falling sprint time as an improvement", () => {
    const rows = [
      assessment("sprint-10m", 1.79, "2026-05-28"),
      assessment("sprint-10m", 1.72, "2026-08-14"),
    ];
    const series = buildSeries(rows, { label: "10m sprint", unit: "s", better: "lower" }, "sprint-10m")!;
    expect(series.improved).toBe(true);
    expect(series.changePct).toBeGreaterThan(0);
    expect(series.latest.value).toBe(1.72);
  });

  it("treats a falling jump height as a decline", () => {
    const rows = [
      assessment("cmj", 45, "2026-05-28"),
      assessment("cmj", 42, "2026-08-14"),
    ];
    const series = buildSeries(rows, { label: "CMJ", unit: "cm", better: "higher" }, "cmj")!;
    expect(series.improved).toBe(false);
    expect(series.changePct).toBeLessThan(0);
  });

  it("orders entries oldest-first regardless of input order", () => {
    const rows = [
      assessment("sprint-10m", 1.72, "2026-08-14"),
      assessment("sprint-10m", 1.79, "2026-05-28"),
    ];
    const series = buildSeries(rows, { label: "10m", unit: "s", better: "lower" }, "sprint-10m")!;
    expect(series.first.testedOn).toBe("2026-05-28");
    expect(series.latest.testedOn).toBe("2026-08-14");
  });

  it("returns null for a test with no results", () => {
    expect(buildSeries([], { label: "10m", unit: "s", better: "lower" }, "sprint-10m")).toBeNull();
  });

  it("handles a missing date rather than reporting a bogus age", () => {
    expect(weeksSince(null)).toBeNull();
    expect(weeksSince("not-a-date")).toBeNull();
  });
});

describe("program display helpers", () => {
  it("groups sessions by week, in day order", () => {
    const rows: ProgramSessionRow[] = [
      { id: "b", week: 2, day: 1, title: "", focus: "", intent: "build", notes: "", completedAt: null, position: 0, exercises: [] },
      { id: "a2", week: 1, day: 2, title: "", focus: "", intent: "build", notes: "", completedAt: null, position: 1, exercises: [] },
      { id: "a1", week: 1, day: 1, title: "", focus: "", intent: "build", notes: "", completedAt: null, position: 0, exercises: [] },
    ];
    const weeks = byWeek(rows);
    expect(weeks.map((w) => w.week)).toEqual([1, 2]);
    expect(weeks[0].sessions.map((s) => s.id)).toEqual(["a1", "a2"]);
  });
});
