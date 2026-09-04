import { describe, it, expect } from "vitest";
import { sanitizeBrief, briefPromptBlock } from "../../lib/intelligence/session-plan";
import { validSourceKeys } from "../../lib/intelligence/context";
import type { PlayerContext } from "../../lib/intelligence/context";

/*
  The loop's last edge: a development priority becomes the next session.

  The engine already accepted a `goal:` focus — `sanitizeBrief` allowed it and
  `validSourceKeys` emitted it — and nothing in the product ever sent one. Film
  Room linked a concept in, a study linked itself in, the Capture extension
  linked a lesson in; the priority every one of those paths converges on had no
  link at all.

  These tests hold the contract that made the fix a link rather than a new
  engine. If any of them fail, the edge has quietly come apart again.
*/

const ctx = (over: Partial<PlayerContext> = {}): PlayerContext =>
  ({
    situation: {
      daysSinceLastMatch: 2,
      lastMatchReviewed: true,
      daysUntilNextMatch: 5,
      readiness: null,
      daysSinceTraining: 1,
      daysSinceStudy: null,
    },
    goals: [{ id: "g-open-body", title: "Open body before first contact" }],
    filmConcepts: [],
    studies: [],
    memoryBlock: null,
    captureLesson: null,
    ...over,
  }) as PlayerContext;

describe("a priority can brief a session", () => {
  it("accepts a goal focus", () => {
    expect(sanitizeBrief({ focusKey: "goal:g-open-body" }).focusKey).toBe("goal:g-open-body");
  });

  /*
    The four namespaces are the whole set of things that may lead a session.
    A fifth arriving without a handler would be dropped silently, so the list
    is asserted rather than assumed.
  */
  it("accepts every source the product actually links from", () => {
    for (const key of ["goal:abc", "film:receiving-under-pressure", "study:xyz", "capture:123"]) {
      expect(sanitizeBrief({ focusKey: key }).focusKey, key).toBe(key);
    }
  });

  it("drops a focus it does not recognise", () => {
    // A chip that never reaches a prompt is better than one that reaches it
    // meaning nothing.
    expect(sanitizeBrief({ focusKey: "wishlist:123" }).focusKey).toBeUndefined();
    expect(sanitizeBrief({ focusKey: "goal:" }).focusKey).toBeUndefined();
  });

  /*
    The key must survive validation against the record, or `draftSession`
    strips it before composing — which is how a stale link stops mattering,
    and also how a live one would break if the goal stopped being listed.
  */
  it("counts an open goal as a source the record can back", () => {
    expect(validSourceKeys(ctx()).has("goal:g-open-body")).toBe(true);
  });

  it("does not back a goal the record does not hold", () => {
    expect(validSourceKeys(ctx({ goals: [] })).has("goal:g-open-body")).toBe(false);
  });

  it("tells the model to build around the focus", () => {
    const block = briefPromptBlock(sanitizeBrief({ focusKey: "goal:g-open-body" }));
    expect(block).toContain("goal:g-open-body");
    expect(block).toMatch(/around/i);
  });
});
