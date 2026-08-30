import { describe, it, expect } from "vitest";
import {
  sessionPayloadSchema,
  matchFocusSchema,
  validateAi,
} from "../../lib/ai/schemas";
import { PROMPT_MANIFEST, SESSION_DRAFT, SESSION_ADAPT, HARD_RULES } from "../../lib/ai/prompts";
import { selectPlayerContext, validSourceKeys, contextPromptBlock, studyKey } from "../../lib/intelligence/context";
import {
  sanitizeBrief,
  briefPromptBlock,
  composeSessionPlan,
  sourceLabel,
  type SessionBrief,
} from "../../lib/intelligence/session-plan";
import type { PlayerSignals } from "../../lib/intelligence/next-best-action";

/*
  Phase 1 of the intelligence layer: the shape gate at the AI boundary,
  the prompt registry, citable studies, and the session brief. These are
  the foundations Adaptive Training builds on, so their contracts get
  pinned before anything depends on them.
*/

const signals: PlayerSignals = {
  daysSinceLastMatch: 2,
  lastMatchReviewed: false,
  daysUntilNextMatch: 3,
  readiness: 72,
  daysSinceCheckin: 0,
  activeGoals: [{ id: "g1", title: "Blindside movement" }],
  daysSinceStudy: 1,
  daysSinceTraining: 1,
  completedStudies: [{ subject: "Harry Kane", daysAgo: 1 }],
  filmObservations: [
    { concept: "Blindside movement", daysAgo: 4, goalId: "g1" },
    { concept: "Blindside movement", daysAgo: 6, goalId: "g1" },
  ],
};

describe("AI boundary schemas — the shape gate", () => {
  const good = {
    title: "Timing session",
    kind: "individual",
    durationMin: 45,
    objective: "Move blindside movement forward.",
    blocks: [
      { name: "Prepare", detail: "Activation.", work: "8 minutes", sourceKey: "rhythm", why: "Standard prep." },
      { name: "Timing", detail: "Delayed runs.", work: "4x4", sourceKey: "goal:g1", why: "Your goal." },
    ],
  };

  it("accepts the object we asked for", () => {
    expect(validateAi(sessionPayloadSchema, good)).not.toBeNull();
  });

  it("refuses a payload missing blocks rather than patching it", () => {
    expect(validateAi(sessionPayloadSchema, { ...good, blocks: undefined })).toBeNull();
  });

  it("refuses non-numeric duration", () => {
    expect(validateAi(sessionPayloadSchema, { ...good, durationMin: "forty" })).toBeNull();
  });

  it("recovers an unknown kind to individual instead of dying on it", () => {
    const parsed = validateAi(sessionPayloadSchema, { ...good, kind: "yoga" });
    expect(parsed?.kind).toBe("individual");
  });

  it("match focus is capped at two cues — the cap is the product", () => {
    expect(
      validateAi(matchFocusSchema, { cues: ["Scan again as the ball travels.", "Arrive late.", "Press higher."], because: "x" }),
    ).toBeNull();
    expect(
      validateAi(matchFocusSchema, { cues: ["Scan again as the ball travels."], because: "Film pattern." }),
    ).not.toBeNull();
  });
});

describe("prompt registry", () => {
  it("names are unique and versions are positive", () => {
    const names = PROMPT_MANIFEST.map((p) => p.def.name);
    expect(new Set(names).size).toBe(names.length);
    for (const p of PROMPT_MANIFEST) expect(p.def.version).toBeGreaterThanOrEqual(1);
  });

  it("owned prompts carry the shared hard rules", () => {
    expect(SESSION_DRAFT.system).toContain(HARD_RULES);
    expect(SESSION_ADAPT.system).toContain(HARD_RULES);
  });

  it("adaptation preserves citations by instruction", () => {
    expect(SESSION_ADAPT.system).toMatch(/sourceKey.*EXACTLY/);
  });
});

describe("citable studies", () => {
  it("a completed study is a source key, not background noise", () => {
    const ctx = selectPlayerContext(signals, null);
    const keys = validSourceKeys(ctx);
    expect(keys.has("study:harry-kane")).toBe(true);
  });

  it("the prompt block tags the study line with its key", () => {
    const ctx = selectPlayerContext(signals, null);
    expect(contextPromptBlock(ctx)).toContain('[study:harry-kane] Studied "Harry Kane"');
  });

  it("studyKey slugs are stable and bracket-safe", () => {
    expect(studyKey("Harry Kane")).toBe("study:harry-kane");
    expect(studyKey("  Modrić — scanning!  ")).toMatch(/^study:[a-z0-9-]+$/);
    expect(studyKey("")).toBe("study:unknown");
  });

  it("sourceLabel resolves a study key to its subject", () => {
    const ctx = selectPlayerContext(signals, null);
    expect(sourceLabel("study:harry-kane", ctx)).toBe("Study: Harry Kane");
  });
});

describe("session brief", () => {
  it("unknown chips never reach a prompt", () => {
    const brief = sanitizeBrief({
      minutes: 44 as never,
      location: "moon" as never,
      mode: "solo",
      equipment: ["ball", "flamethrower"],
    } as SessionBrief);
    expect(brief.minutes).toBeUndefined();
    expect(brief.location).toBeUndefined();
    expect(brief.mode).toBe("solo");
    expect(brief.equipment).toEqual(["ball"]);
  });

  it("an empty brief renders nothing — absence means MIDO decides", () => {
    expect(briefPromptBlock({})).toBe("");
  });

  it("a solo brief says what solo excludes", () => {
    expect(briefPromptBlock({ mode: "solo" })).toContain("no partner");
  });

  it("equipment is stated as exhaustive", () => {
    expect(briefPromptBlock({ equipment: ["ball", "cones"] })).toContain("nothing else");
  });

  it("compose honors the brief's minutes and gym location", () => {
    const ctx = selectPlayerContext(signals, null);
    const plan = composeSessionPlan(ctx, { minutes: 30, location: "gym" });
    expect(plan.durationMin).toBe(30);
    expect(plan.kind).toBe("gym");
  });

  it("low readiness wins every tie with the brief", () => {
    const ctx = selectPlayerContext({ ...signals, readiness: 30 }, null);
    const plan = composeSessionPlan(ctx, { minutes: 30 });
    const prep = plan.blocks[0];
    expect(prep?.sourceKey).toBe("readiness");
    expect(prep?.detail).toMatch(/moderate intensity only/);
  });
});

describe("study → training (the applied-focus arrow)", () => {
  it("a well-formed focus key survives sanitising; a malformed one does not", () => {
    expect(sanitizeBrief({ focusKey: "study:harry-kane" }).focusKey).toBe("study:harry-kane");
    expect(sanitizeBrief({ focusKey: "film:Blindside movement" }).focusKey).toBe("film:Blindside movement");
    expect(sanitizeBrief({ focusKey: "memory" }).focusKey).toBeUndefined();
    expect(sanitizeBrief({ focusKey: "study:" }).focusKey).toBeUndefined();
  });

  it("the brief tells the model what leads today", () => {
    expect(briefPromptBlock({ focusKey: "study:harry-kane" })).toContain("AROUND [study:harry-kane]");
  });

  it("the composed session closes the arrow too — an apply block, cited to the study", () => {
    const ctx = selectPlayerContext(signals, null);
    const plan = composeSessionPlan(ctx, { focusKey: "study:harry-kane" });
    const apply = plan.blocks.find((b) => b.sourceKey === "study:harry-kane");
    expect(apply).toBeDefined();
    expect(apply!.name).toContain("Harry Kane");
    expect(apply!.why).toMatch(/studied Harry Kane/i);
  });

  it("a focus the record cannot back produces no apply block", () => {
    const ctx = selectPlayerContext({ ...signals, completedStudies: [] }, null);
    const plan = composeSessionPlan(ctx, { focusKey: "study:harry-kane" });
    expect(plan.blocks.some((b) => b.sourceKey === "study:harry-kane")).toBe(false);
  });
});
