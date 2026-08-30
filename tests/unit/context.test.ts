import { describe, it, expect } from "vitest";
import {
  selectPlayerContext,
  contextPromptBlock,
  validSourceKeys,
  CONTEXT_MAX_GOALS,
  CONTEXT_MAX_CONCEPTS,
  CONTEXT_BLOCK_MAX_CHARS,
} from "@/lib/intelligence/context";
import {
  composeSessionPlan,
  validateBlocks,
  type SessionBlock,
} from "@/lib/intelligence/session-plan";
import type { PlayerSignals } from "@/lib/intelligence/next-best-action";

/*
  The context selector is the boundary between the record and the
  model: what it selects is everything a model may know, and what it
  refuses to cite is dropped from generations in code. These tests pin
  both directions.
*/

function signals(partial: Partial<PlayerSignals> = {}): PlayerSignals {
  return {
    daysSinceLastMatch: 2,
    lastMatchReviewed: true,
    daysUntilNextMatch: 5,
    readiness: 72,
    daysSinceCheckin: 1,
    activeGoals: [{ id: "g1", title: "Scan before receiving" }],
    daysSinceStudy: 3,
    daysSinceTraining: 1,
    completedStudies: [{ subject: "Rodri", daysAgo: 3 }],
    filmObservations: [
      { concept: "late scanning", daysAgo: 4, goalId: "g1" },
      { concept: "late scanning", daysAgo: 9, goalId: null },
      { concept: "first touch", daysAgo: 6, goalId: null },
    ],
    recentlyDismissed: [],
    ...partial,
  };
}

describe("selectPlayerContext", () => {
  it("aggregates film observations by concept, most observed first", () => {
    const ctx = selectPlayerContext(signals(), null);
    expect(ctx.filmConcepts[0]).toEqual({
      concept: "late scanning",
      count: 2,
      lastDaysAgo: 4,
      goalIds: ["g1"],
    });
    expect(ctx.filmConcepts[1].concept).toBe("first touch");
  });

  it("caps goals and concepts so a long record costs what a short one does", () => {
    const manyGoals = Array.from({ length: 12 }, (_, i) => ({ id: `g${i}`, title: `Goal ${i}` }));
    const manyObs = Array.from({ length: 30 }, (_, i) => ({
      concept: `concept ${i}`,
      daysAgo: i,
      goalId: null,
    }));
    const ctx = selectPlayerContext(signals({ activeGoals: manyGoals, filmObservations: manyObs }), null);
    expect(ctx.goals.length).toBe(CONTEXT_MAX_GOALS);
    expect(ctx.filmConcepts.length).toBe(CONTEXT_MAX_CONCEPTS);
  });

  it("treats an empty memory block as no memory", () => {
    expect(selectPlayerContext(signals(), "  ").memoryBlock).toBeNull();
    expect(selectPlayerContext(signals(), "PLAYER MEMORY:\n- x").memoryBlock).toContain("MEMORY");
  });
});

describe("validSourceKeys", () => {
  it("is the whole citation universe: goals, concepts, studies, readiness, rhythm, memory", () => {
    const keys = validSourceKeys(selectPlayerContext(signals(), "MEMORY"));
    expect(keys).toEqual(
      new Set([
        "rhythm",
        "readiness",
        "memory",
        "goal:g1",
        "film:late scanning",
        "film:first touch",
        // Studies joined the universe in the intelligence-layer phase —
        // "apply what you studied" needs a key a block can cite.
        "study:rodri",
      ]),
    );
  });

  it("omits readiness when nothing was ever scored", () => {
    const keys = validSourceKeys(selectPlayerContext(signals({ readiness: null }), null));
    expect(keys.has("readiness")).toBe(false);
    expect(keys.has("memory")).toBe(false);
  });
});

describe("contextPromptBlock", () => {
  it("renders facts with their citation keys and appends memory", () => {
    const block = contextPromptBlock(selectPlayerContext(signals(), "PLAYER MEMORY:\n- avoid plyometrics"));
    expect(block).toContain("[goal:g1] Active goal: Scan before receiving");
    expect(block).toContain('[film:late scanning] Film showed "late scanning" 2 time(s)');
    expect(block).toContain("[readiness] Readiness 72/100");
    expect(block).toContain("avoid plyometrics");
  });

  it("never exceeds the hard ceiling", () => {
    const huge = selectPlayerContext(signals(), `PLAYER MEMORY:\n${"- line\n".repeat(600)}`);
    expect(contextPromptBlock(huge).length).toBeLessThanOrEqual(CONTEXT_BLOCK_MAX_CHARS);
  });

  it("omits what is unknown rather than inventing it", () => {
    const block = contextPromptBlock(
      selectPlayerContext(
        signals({ daysSinceLastMatch: null, daysUntilNextMatch: null, readiness: null }),
        null,
      ),
    );
    expect(block).not.toContain("Last match");
    expect(block).not.toContain("Next match");
    expect(block).not.toContain("Readiness");
  });
});

describe("validateBlocks", () => {
  const ctx = selectPlayerContext(signals(), null);
  const good: SessionBlock = {
    name: "Scanning reps",
    detail: "Recreate the film situation.",
    work: "4 x 4 · 45s rest",
    sourceKey: "film:late scanning",
    why: "Your film showed this twice.",
  };

  it("drops blocks whose citation is not in the record", () => {
    const invented: SessionBlock = { ...good, name: "Sprints", sourceKey: "film:pressing triggers" };
    expect(validateBlocks([good, invented], ctx)).toHaveLength(1);
  });

  it("drops blocks with empty prescriptions", () => {
    expect(validateBlocks([{ ...good, work: "  " }], ctx)).toHaveLength(0);
  });

  it("keeps a cited memory block only when memory exists", () => {
    const memBlock: SessionBlock = { ...good, sourceKey: "memory" };
    expect(validateBlocks([memBlock], ctx)).toHaveLength(0);
    const withMem = selectPlayerContext(signals(), "PLAYER MEMORY:\n- x");
    expect(validateBlocks([memBlock], withMem)).toHaveLength(1);
  });
});

describe("composeSessionPlan", () => {
  it("builds from the leading film concept and goal, and cites them", () => {
    const plan = composeSessionPlan(selectPlayerContext(signals(), null));
    const keys = plan.blocks.map((b) => b.sourceKey);
    expect(keys).toContain("film:late scanning");
    expect(keys).toContain("goal:g1");
    // Everything the composer writes must survive its own validator.
    expect(validateBlocks(plan.blocks, selectPlayerContext(signals(), null))).toHaveLength(plan.blocks.length);
  });

  it("goes submaximal on low readiness and says so from the readiness signal", () => {
    const low = composeSessionPlan(selectPlayerContext(signals({ readiness: 30 }), null));
    expect(low.blocks.some((b) => b.sourceKey === "readiness")).toBe(true);
    expect(low.durationMin).toBeLessThan(
      composeSessionPlan(selectPlayerContext(signals(), null)).durationMin,
    );
  });

  it("still produces a valid session for an empty record", () => {
    const empty = composeSessionPlan(
      selectPlayerContext(
        signals({
          activeGoals: [],
          filmObservations: [],
          completedStudies: [],
          readiness: null,
          daysSinceLastMatch: null,
          daysUntilNextMatch: null,
        }),
        null,
      ),
    );
    expect(empty.blocks.length).toBeGreaterThanOrEqual(2);
    expect(empty.blocks.every((b) => b.sourceKey === "rhythm")).toBe(true);
  });
});
