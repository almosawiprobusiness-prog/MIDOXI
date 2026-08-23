import { describe, it, expect } from "vitest";
import {
  CATEGORY_META,
  buildDevelopmentMap,
  mapHeadline,
} from "../../lib/data/development-map";
import { CATEGORIES } from "../../lib/data/development-types";
import type { DevelopmentCategory, DevelopmentGoal } from "../../lib/types";

/*
  The Development Map is where it would have been easiest to invent numbers.
  "Technical: current 6/10, target 8/10" reads well and means nothing — MIDO
  does not assess players and holds no rating.

  These tests hold the map to the redefinition that makes it honest: current is
  evidence, target is the goal the player set, and gap is a concrete next thing
  to do. Anything that looks like an ability score is a regression.
*/

const goal = (
  category: DevelopmentCategory,
  over: Partial<DevelopmentGoal> = {},
): DevelopmentGoal => ({
  id: `${category}-${over.title ?? "g"}`,
  index: 1,
  category,
  title: over.title ?? "A goal",
  status: "active",
  createdLabel: "1 Aug",
  why: "",
  evidence: { clips: 0, training: 0, study: 0, coachNotes: 0 },
  progress: 0,
  ...over,
});

describe("the map covers the whole game", () => {
  it("always returns a row per category, including the empty ones", () => {
    const map = buildDevelopmentMap([]);
    expect(map.rows).toHaveLength(CATEGORIES.length);
    expect(map.rows.map((r) => r.category)).toEqual(CATEGORIES);
  });

  it("names the areas with nothing set — the map's actual finding", () => {
    const map = buildDevelopmentMap([goal("technical")]);
    expect(map.covered).toBe(1);
    expect(map.untouched).toEqual(["tactical", "physical", "mental", "positional"]);
  });

  it("has a label and a description for every category", () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_META[c]?.label, c).toBeTruthy();
      expect(CATEGORY_META[c]?.blurb.length, c).toBeGreaterThan(10);
    }
  });
});

describe("current, target and gap", () => {
  it("has no progress at all for a category with nothing set, rather than zero", () => {
    // Zero would read as "you are bad at this". Null reads as "you have not said".
    const row = buildDevelopmentMap([]).rows[0];
    expect(row.progress).toBeNull();
  });

  it("averages progress only across goals that exist", () => {
    const map = buildDevelopmentMap([
      goal("technical", { title: "a", progress: 40 }),
      goal("technical", { title: "b", progress: 60 }),
    ]);
    expect(map.rows.find((r) => r.category === "technical")?.progress).toBe(50);
  });

  it("treats the player's own goals as the targets", () => {
    const map = buildDevelopmentMap([goal("tactical", { title: "Pressing triggers" })]);
    const row = map.rows.find((r) => r.category === "tactical")!;
    expect(row.goals.map((g) => g.title)).toEqual(["Pressing triggers"]);
  });

  it("says the gap is missing evidence when there is none", () => {
    const map = buildDevelopmentMap([goal("physical")]);
    expect(map.rows.find((r) => r.category === "physical")?.gap).toContain("no evidence");
  });

  it("names which kind of evidence is missing", () => {
    const map = buildDevelopmentMap([
      goal("mental", { evidence: { clips: 2, training: 1, study: 1, coachNotes: 0 }, progress: 50 }),
    ]);
    const row = map.rows.find((r) => r.category === "mental")!;
    expect(row.missingEvidence).toEqual(["coachNotes"]);
    expect(row.gap).toContain("coach input");
  });

  it("notices when an area has gone quiet because everything in it is done", () => {
    const map = buildDevelopmentMap([
      goal("technical", { status: "achieved", progress: 100, evidence: { clips: 1, training: 1, study: 1, coachNotes: 1 } }),
    ]);
    expect(map.rows.find((r) => r.category === "technical")?.gap).toContain("next one");
  });
});

describe("honesty", () => {
  it("never produces anything that reads as an ability rating", () => {
    const map = buildDevelopmentMap([
      goal("technical", { progress: 40, evidence: { clips: 1, training: 1, study: 1, coachNotes: 1 } }),
      goal("physical"),
    ]);
    const text = [mapHeadline(map), ...map.rows.map((r) => r.gap)].join(" ").toLowerCase();
    // No scores out of ten, no letter grades, no verdicts on the player.
    expect(text).not.toMatch(/\b\d+\s*\/\s*10\b/);
    expect(text).not.toMatch(/\b(weak|strong|poor|excellent|elite|below average|talent)\b/);
  });

  it("comments on the record, not on the person", () => {
    const map = buildDevelopmentMap([goal("technical")]);
    expect(mapHeadline(map).toLowerCase()).toMatch(/working on|set|areas/);
  });

  it("says something useful before anything has been set", () => {
    expect(mapHeadline(buildDevelopmentMap([]))).toContain("Nothing set yet");
  });

  it("flags a map that is entirely one area, without calling it wrong", () => {
    const map = buildDevelopmentMap([
      goal("technical", { title: "a" }),
      goal("technical", { title: "b" }),
    ]);
    const line = mapHeadline(map);
    expect(line).toContain("technical");
    expect(line.toLowerCase()).toContain("narrow is not wrong");
  });

  it("counts every kind of evidence, including matches", () => {
    const map = buildDevelopmentMap([
      goal("tactical", { evidence: { clips: 1, training: 1, study: 1, coachNotes: 1, matches: 3 } }),
    ]);
    expect(map.totalEvidence).toBe(7);
  });
});
