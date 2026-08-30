import { describe, it, expect } from "vitest";
import {
  adaptGuard,
  deterministicAdapt,
  validateAdaptation,
  ADAPT_DIRECTIVES,
  type AdaptDirective,
} from "../../lib/intelligence/session-adapt";
import { selectPlayerContext } from "../../lib/intelligence/context";
import { composeSessionPlan, MIN_BLOCKS, type SessionProposal } from "../../lib/intelligence/session-plan";
import type { PlayerSignals } from "../../lib/intelligence/next-best-action";

/*
  The golden training scenarios from the intelligence-layer directive,
  pinned at the deterministic layer — the layer that decides what any
  model output is ALLOWED to be. (What a model actually writes is not
  unit-testable; what survives it is.)
*/

function signals(overrides: Partial<PlayerSignals> = {}): PlayerSignals {
  return {
    daysSinceLastMatch: 2,
    lastMatchReviewed: true,
    daysUntilNextMatch: 3,
    readiness: 72,
    daysSinceCheckin: 0,
    activeGoals: [{ id: "g1", title: "Blindside movement" }],
    daysSinceStudy: 2,
    daysSinceTraining: 1,
    completedStudies: [{ subject: "Harry Kane", daysAgo: 2 }],
    filmObservations: [
      { concept: "Blindside movement", daysAgo: 3, goalId: "g1" },
      { concept: "Blindside movement", daysAgo: 5, goalId: "g1" },
      { concept: "Blindside movement", daysAgo: 8, goalId: "g1" },
    ],
    ...overrides,
  };
}

describe("Golden A — the striker with evidence", () => {
  it("the composed session targets what the record shows, not generic conditioning", () => {
    const ctx = selectPlayerContext(signals(), null);
    const plan = composeSessionPlan(ctx, { minutes: 45 });
    const keys = plan.blocks.map((b) => b.sourceKey);
    expect(keys).toContain("film:Blindside movement");
    expect(keys).toContain("goal:g1");
    expect(plan.objective.toLowerCase()).toContain("blindside movement");
    expect(plan.durationMin).toBe(45);
  });
});

describe("Golden B — the safety rule cannot be asked away", () => {
  it("refuses 'harder' the day before a match, with the reason", () => {
    const ctx = selectPlayerContext(signals({ daysUntilNextMatch: 1 }), null);
    const refusal = adaptGuard("harder", ctx);
    expect(refusal).toMatch(/match is tomorrow/i);
  });

  it("refuses 'longer' on low readiness, naming the number", () => {
    const ctx = selectPlayerContext(signals({ readiness: 31 }), null);
    const refusal = adaptGuard("longer", ctx);
    expect(refusal).toContain("31");
  });

  it("never blocks the directives that lower load", () => {
    const ctx = selectPlayerContext(signals({ readiness: 20, daysUntilNextMatch: 1 }), null);
    for (const d of ["shorter", "easier", "low_intensity", "no_goal", "small_space"] as AdaptDirective[]) {
      expect(adaptGuard(d, ctx)).toBeNull();
    }
  });
});

describe("Golden C — the new player with no evidence", () => {
  it("still composes a usable session and claims no film it does not have", () => {
    const ctx = selectPlayerContext(
      signals({ activeGoals: [{ id: "g1", title: "First touch" }], filmObservations: [], completedStudies: [], readiness: null, daysSinceLastMatch: null, daysUntilNextMatch: null }),
      null,
    );
    const plan = composeSessionPlan(ctx);
    expect(plan.blocks.length).toBeGreaterThanOrEqual(MIN_BLOCKS);
    for (const b of plan.blocks) {
      expect(b.sourceKey.startsWith("film:")).toBe(false);
      expect(b.why.toLowerCase()).not.toContain("film");
    }
  });
});

describe("Golden D — the study is citable evidence for training", () => {
  it("a completed study is inside the citation universe the validator enforces", () => {
    const ctx = selectPlayerContext(signals(), null);
    const proposal = composeSessionPlan(ctx);
    const adapted = {
      durationMin: proposal.durationMin,
      blocks: proposal.blocks.map((b) => ({ sourceKey: b.sourceKey })),
    };
    // A model may keep citations; it may not mint one the record lacks.
    expect(validateAdaptation(proposal, adapted, "no_goal")).toBeNull();
    expect(
      validateAdaptation(proposal, { ...adapted, blocks: [...adapted.blocks, { sourceKey: "study:invented-guru" }] }, "no_goal"),
    ).toMatch(/new citation/);
  });
});

describe("adaptation contracts", () => {
  const base: SessionProposal = {
    title: "Timing session",
    kind: "individual",
    durationMin: 50,
    objective: "Move blindside movement forward.",
    blocks: [
      { name: "Prepare", detail: "Prep.", work: "8 minutes", sourceKey: "rhythm", why: "" },
      { name: "Film focus", detail: "Runs.", work: "4x4", sourceKey: "film:Blindside movement", why: "" },
      { name: "Goal work", detail: "Game.", work: "12 minutes", sourceKey: "goal:g1", why: "" },
      { name: "Close", detail: "Transfer.", work: "10 minutes", sourceKey: "rhythm", why: "" },
    ],
    source: "mido",
    note: null,
  };

  it("deterministic shorter drops one middle block and shrinks the time", () => {
    const shorter = deterministicAdapt(base, "shorter");
    expect(shorter).not.toBeNull();
    expect(shorter!.blocks.length).toBe(base.blocks.length - 1);
    expect(shorter!.durationMin).toBeLessThan(base.durationMin);
    expect(shorter!.blocks[0]?.name).toBe("Prepare");
    expect(shorter!.blocks.at(-1)?.name).toBe("Close");
    // The objective is untouched — shorter, not different.
    expect(shorter!.objective).toBe(base.objective);
  });

  it("deterministic shorter refuses when there is nothing safe to drop", () => {
    const tiny: SessionProposal = { ...base, blocks: base.blocks.slice(0, 2) };
    expect(deterministicAdapt(tiny, "shorter")).toBeNull();
    // Three blocks = one middle block, and dropping the only middle
    // block would leave a warm-up attached to a cool-down.
    const three: SessionProposal = { ...base, blocks: [base.blocks[0]!, base.blocks[2]!, base.blocks[3]!] };
    expect(deterministicAdapt(three, "shorter")).toBeNull();
  });

  it("only 'shorter' has a code-alone path — rewriting drills is not arithmetic", () => {
    for (const d of ADAPT_DIRECTIVES.map((x) => x.key).filter((k) => k !== "shorter")) {
      expect(deterministicAdapt(base, d)).toBeNull();
    }
  });

  it("a 'shorter' result that is not shorter fails the contract", () => {
    expect(
      validateAdaptation(base, { durationMin: 50, blocks: base.blocks }, "shorter"),
    ).toMatch(/did not get shorter/);
  });

  it("a place directive may not quietly change the commitment", () => {
    expect(
      validateAdaptation(base, { durationMin: 90, blocks: base.blocks }, "gym"),
    ).toMatch(/drifted/);
  });

  it("'harder' is defined as constraints, not volume, in the directive itself", () => {
    const harder = ADAPT_DIRECTIVES.find((d) => d.key === "harder")!;
    expect(harder.instruction).toMatch(/NOT through more volume/);
  });
});
