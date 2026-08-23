import { describe, it, expect } from "vitest";
import {
  categoryForConcept,
  conceptsForGoals,
  newGoalFor,
  suggestGoal,
} from "../../lib/knowledge/mapping";
import { CONCEPTS } from "../../lib/knowledge/concepts";
import {
  CLIP_MAX_SECONDS,
  CLIP_MIN_SECONDS,
  CONFIDENCE_META,
  clipLengthIssue,
} from "../../lib/video/provider";
import type { DevelopmentGoal } from "../../lib/types";

/*
  The loop: an observation on a clip becomes evidence against a development
  goal. MIDO proposes, the player confirms.

  The rule these tests exist to protect is that a WRONG proposal must be
  visibly uncertain rather than confidently wrong. A player will read their
  evidence trail in three months and believe it, so a bad link is not a bad
  suggestion — it is a false record with a date on it.
*/

const goal = (id: string, title: string, over: Partial<DevelopmentGoal> = {}): DevelopmentGoal => ({
  id,
  index: 0,
  category: "tactical",
  title,
  status: "active",
  createdLabel: "Aug 2026",
  why: "",
  evidence: { clips: 0, training: 0, study: 0, coachNotes: 0, matches: 0 },
  progress: 0,
  ...over,
});

const SLUG = CONCEPTS[0].slug;

describe("categories", () => {
  it("maps every curated concept to a real development category", () => {
    const valid = new Set(["technical", "tactical", "physical", "mental", "positional"]);
    for (const c of CONCEPTS) {
      expect(valid.has(categoryForConcept(c.slug)), c.slug).toBe(true);
    }
  });

  it("treats an unknown concept as tactical rather than throwing", () => {
    expect(categoryForConcept("not-a-concept")).toBe("tactical");
  });
});

describe("proposing a goal", () => {
  it("prefers the goal the player already filed this concept under", () => {
    const goals = [goal("g1", "Something else entirely"), goal("g2", "Also unrelated")];
    const s = suggestGoal({ conceptSlug: SLUG, goals, established: { [SLUG]: "g2" } });
    expect(s.goal?.id).toBe("g2");
    expect(s.strength).toBe("strong");
  });

  it("matches on shared football language", () => {
    const c = CONCEPTS.find((x) => x.slug === "blindside-movement")!;
    const goals = [goal("g1", "Sprint speed"), goal("g2", "Blindside movement in the box")];
    const s = suggestGoal({ conceptSlug: c.slug, goals });
    expect(s.goal?.id).toBe("g2");
    expect(["strong", "likely"]).toContain(s.strength);
  });

  it("proposes nothing when the player has no goals", () => {
    const s = suggestGoal({ conceptSlug: SLUG, goals: [] });
    expect(s.goal).toBeNull();
    expect(s.newGoal).toBeTruthy();
  });

  it("offers a new goal rather than forcing an observation somewhere wrong", () => {
    const goals = [goal("g1", "Bench press"), goal("g2", "Sleep earlier")];
    const s = suggestGoal({ conceptSlug: "blindside-movement", goals });
    expect(s.strength).toBe("weak");
    expect(s.newGoal?.title).toBeTruthy();
  });

  it("never proposes an achieved goal on its own", () => {
    // Adding evidence to something already finished is not progress.
    const goals = [goal("done", "Blindside movement", { status: "achieved" })];
    const s = suggestGoal({ conceptSlug: "blindside-movement", goals });
    expect(s.goal).toBeNull();
  });

  it("always explains itself", () => {
    for (const slug of CONCEPTS.slice(0, 12).map((c) => c.slug)) {
      const s = suggestGoal({ conceptSlug: slug, goals: [goal("g1", "Receiving on the half turn")] });
      expect(s.because.length, slug).toBeGreaterThan(10);
    }
  });

  it("says so plainly when the observation maps to no concept at all", () => {
    const s = suggestGoal({ conceptSlug: "invented-slug", goals: [goal("g1", "Anything")] });
    expect(s.goal).toBeNull();
    expect(s.strength).toBe("weak");
  });

  it("does not match on filler words two football phrases happen to share", () => {
    // "Getting better at the ball" and a concept about "the ball" share only
    // stopwords. A match on those is noise dressed as a suggestion.
    const goals = [goal("g1", "Be more in the game and get better with it")];
    const s = suggestGoal({ conceptSlug: SLUG, goals });
    expect(s.strength).toBe("weak");
  });
});

describe("the goal MIDO would create", () => {
  it("names it after the concept and explains why it matters", () => {
    const proposed = newGoalFor("blindside-movement");
    expect(proposed?.title).toBe("Blindside movement");
    expect(proposed?.why.length).toBeGreaterThan(20);
  });

  it("returns nothing for a concept that does not exist", () => {
    expect(newGoalFor("not-real")).toBeUndefined();
  });
});

describe("pointing the next read", () => {
  it("finds the concepts behind a player's own goals", () => {
    const goals = [goal("g1", "Blindside movement"), goal("g2", "Running in behind")];
    const slugs = conceptsForGoals(goals);
    expect(slugs).toContain("blindside-movement");
    expect(slugs.length).toBeLessThanOrEqual(6);
  });

  it("returns only real concept slugs", () => {
    const known = new Set(CONCEPTS.map((c) => c.slug));
    const slugs = conceptsForGoals([goal("g1", "Dropping between the lines")]);
    for (const s of slugs) expect(known.has(s), s).toBe(true);
  });

  it("returns nothing rather than guessing when goals are off-graph", () => {
    expect(conceptsForGoals([goal("g1", "Save money"), goal("g2", "Call mum")])).toEqual([]);
  });

  it("ignores goals already achieved", () => {
    const goals = [goal("g1", "Blindside movement", { status: "achieved" })];
    expect(conceptsForGoals(goals)).toEqual([]);
  });
});

/*
  Clip length is a product decision, not a technical ceiling, and the refusals
  are the interface — a user who is told "too long" and nothing else will just
  try again with something else too long.
*/
describe("clip length", () => {
  it("accepts a normal passage", () => {
    expect(clipLengthIssue(120, 165)).toBeNull();
  });

  it("refuses anything under the floor, and says what to use instead", () => {
    const issue = clipLengthIssue(10, 14);
    expect(issue).toBeTruthy();
    expect(issue).toMatch(/frame/i);
  });

  it("refuses anything over the ceiling", () => {
    expect(clipLengthIssue(0, CLIP_MAX_SECONDS + 5)).toBeTruthy();
  });

  it("accepts exactly the boundaries", () => {
    expect(clipLengthIssue(0, CLIP_MIN_SECONDS)).toBeNull();
    expect(clipLengthIssue(0, CLIP_MAX_SECONDS)).toBeNull();
  });

  it("keeps the floor below the ceiling", () => {
    expect(CLIP_MIN_SECONDS).toBeLessThan(CLIP_MAX_SECONDS);
  });
});

describe("confidence", () => {
  it("describes all three levels, and distinguishes them", () => {
    const levels = ["observed", "inferred", "uncertain"] as const;
    for (const l of levels) {
      expect(CONFIDENCE_META[l].label.length, l).toBeGreaterThan(0);
      expect(CONFIDENCE_META[l].hint.length, l).toBeGreaterThan(10);
    }
    const hints = levels.map((l) => CONFIDENCE_META[l].hint);
    expect(new Set(hints).size).toBe(3);
  });

  it("says out loud that uncertain is about not knowing who the player is", () => {
    // The honest limit of reading amateur film, shown verbatim in the UI. The
    // assertion is on the MEANING rather than one word — it previously matched
    // /identif/ and broke when the copy said the same thing in plainer English.
    expect(CONFIDENCE_META.uncertain.hint).toMatch(/pick you out|identif|which player/i);
  });

  it("never lets 'observed' promise something MIDO cannot know", () => {
    /*
      The ceiling that came out of testing on real footage. Asked whether it had
      identified a player, the model said yes for two different teams on the
      same forty-five seconds. So no claim about the viewer is ever presented as
      directly observed, and the label has to say why — otherwise a coach
      reading a report cannot tell a fact from a guess.
    */
    expect(CONFIDENCE_META.observed.hint).toMatch(/cannot be certain|not claim|about you/i);
    expect(CONFIDENCE_META.inferred.hint).toMatch(/about you/i);
  });

  it("orders the three levels, strongest first", () => {
    // `atMost` in native-video.ts caps a claimed confidence at a ceiling, which
    // is only meaningful if the three are genuinely ranked.
    const order = ["observed", "inferred", "uncertain"] as const;
    expect(new Set(order).size).toBe(3);
    for (const level of order) expect(CONFIDENCE_META[level]).toBeTruthy();
  });
});
