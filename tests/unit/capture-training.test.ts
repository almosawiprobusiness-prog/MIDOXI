import { describe, expect, it } from "vitest";
import {
  captureKey,
  contextPromptBlock,
  validSourceKeys,
  CAPTURE_LESSON_MAX_CHARS,
  type PlayerContext,
} from "@/lib/intelligence/context";
import {
  composeSessionPlan,
  sanitizeBrief,
  sourceLabel,
} from "@/lib/intelligence/session-plan";
import { sanitizeExtensionTelemetry } from "@/lib/extension/telemetry";
import { sanitizeCheckoutAttribution, isUuid } from "@/lib/billing/attribution";

/*
  The Capture → Training conversion path, pinned where it is pure:
  a saved lesson must be citable by the session engine, honest in the
  prompt (the player's note, never "AI analysis"), and every payload
  that crosses a boundary — telemetry, checkout metadata — must be a
  closed vocabulary that free text cannot ride through.
*/

const LESSON_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function ctx(over: Partial<PlayerContext> = {}): PlayerContext {
  return {
    situation: {
      daysSinceLastMatch: null,
      lastMatchReviewed: false,
      daysUntilNextMatch: null,
      readiness: null,
      daysSinceTraining: null,
      daysSinceStudy: null,
    },
    goals: [],
    filmConcepts: [],
    studies: [],
    memoryBlock: null,
    ...over,
  };
}

function lesson(over: Partial<NonNullable<PlayerContext["captureLesson"]>> = {}) {
  return {
    id: LESSON_ID,
    videoTitle: "How Top Strikers Always Find Space",
    category: "movement",
    observation: "Checks away first, waits for the CB to look at the ball, then attacks the blindside.",
    goalId: null,
    ...over,
  };
}

describe("capture focus in the brief", () => {
  it("accepts a capture: focus key alongside the existing prefixes", () => {
    expect(sanitizeBrief({ focusKey: `capture:${LESSON_ID}` }).focusKey).toBe(`capture:${LESSON_ID}`);
    expect(sanitizeBrief({ focusKey: "study:harry-kane" }).focusKey).toBe("study:harry-kane");
  });

  it("still refuses junk focus keys", () => {
    expect(sanitizeBrief({ focusKey: "capture:" }).focusKey).toBeUndefined();
    expect(sanitizeBrief({ focusKey: `capture:${"x".repeat(90)}` }).focusKey).toBeUndefined();
    expect(sanitizeBrief({ focusKey: "moment:abc" }).focusKey).toBeUndefined();
  });
});

describe("capture in the citation universe", () => {
  it("is citable exactly when a lesson is loaded", () => {
    expect(validSourceKeys(ctx()).has(captureKey(LESSON_ID))).toBe(false);
    expect(validSourceKeys(ctx({ captureLesson: lesson() })).has(captureKey(LESSON_ID))).toBe(true);
  });

  it("renders the lesson first, as the player's own note, never as analysis", () => {
    const block = contextPromptBlock(ctx({ captureLesson: lesson(), memoryBlock: "MEMORY: plays RW." }));
    const lines = block.split("\n");
    expect(lines[1]).toContain(`[capture:${LESSON_ID}]`);
    expect(lines[1]).toContain("OWN observation");
    expect(lines[1]).toContain("not an AI analysis");
    expect(lines[1]).toContain("attacks the blindside");
  });

  it("bounds the lesson text so a maxed observation cannot flood the prompt", () => {
    const long = "a".repeat(1000);
    const block = contextPromptBlock(ctx({ captureLesson: lesson({ observation: long }) }));
    const line = block.split("\n")[1];
    expect(line).toContain("a".repeat(CAPTURE_LESSON_MAX_CHARS));
    expect(line).not.toContain("a".repeat(CAPTURE_LESSON_MAX_CHARS + 1));
  });

  it("labels a capture source in the player's terms", () => {
    const c = ctx({ captureLesson: lesson() });
    expect(sourceLabel(captureKey(LESSON_ID), c)).toBe("Your lesson: How Top Strikers Always Find Space");
    expect(sourceLabel("capture:someone-elses", c)).toBe("Your lesson");
  });
});

describe("the composed fallback closes the arrow too", () => {
  it("builds a dedicated block from the focused lesson", () => {
    const c = ctx({ captureLesson: lesson() });
    const plan = composeSessionPlan(c, { focusKey: captureKey(LESSON_ID) });
    const block = plan.blocks.find((b) => b.sourceKey === captureKey(LESSON_ID));
    expect(block).toBeDefined();
    expect(block!.name).toBe("Train your lesson");
    expect(block!.detail).toContain("How Top Strikers Always Find Space");
  });

  it("adds no capture block when the lesson is absent or mismatched", () => {
    const noLesson = composeSessionPlan(ctx(), { focusKey: captureKey(LESSON_ID) });
    expect(noLesson.blocks.some((b) => b.sourceKey.startsWith("capture:"))).toBe(false);
    const other = composeSessionPlan(ctx({ captureLesson: lesson() }), { focusKey: "capture:another-id" });
    expect(other.blocks.some((b) => b.sourceKey.startsWith("capture:"))).toBe(false);
  });
});

describe("extension telemetry vocabulary", () => {
  it("passes the three funnel events with enum props", () => {
    const t = sanitizeExtensionTelemetry({
      event: "capture_training_cta_clicked",
      props: { surface: "saved", entitled: false },
    });
    expect(t).toEqual({
      event: "capture_training_cta_clicked",
      props: { surface: "saved", entitled: false },
    });
  });

  it("accepts the intent-banner surface", () => {
    const t = sanitizeExtensionTelemetry({
      event: "capture_training_cta_clicked",
      props: { surface: "intent", entitled: true },
    });
    expect(t?.props.surface).toBe("intent");
  });

  it("refuses unknown events outright", () => {
    expect(sanitizeExtensionTelemetry({ event: "capture_saved" })).toBeNull();
    expect(sanitizeExtensionTelemetry({ event: "made_up_event" })).toBeNull();
    expect(sanitizeExtensionTelemetry(null)).toBeNull();
    expect(sanitizeExtensionTelemetry([])).toBeNull();
  });

  it("strips everything that is not the closed prop set — free text cannot ride through", () => {
    const t = sanitizeExtensionTelemetry({
      event: "capture_training_cta_shown",
      props: {
        surface: "library",
        entitled: "yes",
        observation: "he checks his shoulder before receiving",
        url: "https://youtube.com/watch?v=x",
      },
    });
    expect(t).toEqual({ event: "capture_training_cta_shown", props: { surface: "library" } });
  });
});

describe("checkout attribution", () => {
  it("passes the known source with a well-formed capture id", () => {
    expect(sanitizeCheckoutAttribution({ source: "capture_training", captureId: LESSON_ID })).toEqual({
      source: "capture_training",
      captureId: LESSON_ID,
    });
  });

  it("drops a junk id but keeps the source", () => {
    expect(sanitizeCheckoutAttribution({ source: "capture_training", captureId: "not-a-uuid" })).toEqual({
      source: "capture_training",
    });
    expect(
      sanitizeCheckoutAttribution({ source: "capture_training", captureId: "his note about scanning" }),
    ).toEqual({ source: "capture_training" });
  });

  it("refuses unknown sources — the vocabulary is closed", () => {
    expect(sanitizeCheckoutAttribution({ source: "tiktok_ad" })).toBeNull();
    expect(sanitizeCheckoutAttribution({})).toBeNull();
  });

  it("recognises UUIDs strictly", () => {
    expect(isUuid(LESSON_ID)).toBe(true);
    expect(isUuid("g1")).toBe(false);
    expect(isUuid(`${LESSON_ID} extra`)).toBe(false);
  });
});
