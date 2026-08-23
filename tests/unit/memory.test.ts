import { describe, it, expect } from "vitest";
import {
  MEMORY_KINDS,
  MEMORY_MAX,
  MEMORY_MIN,
  MEMORY_PROMPT_LIMIT,
  memoryIssue,
  memoryMeta,
  memoryPromptBlock,
  type Memory,
  type MemoryKind,
} from "../../lib/data/memory-types";

/*
  MIDO's memory is injected into every AI prompt it runs for a player, which
  makes a wrong entry here different in kind from a wrong entry anywhere else:
  it does not produce one bad answer, it shapes every answer from then on.

  So the properties worth pinning are about restraint. Every kind has to earn
  its place by changing what MIDO says, the block has to tell the model which
  facts are prohibitions rather than colour, and it has to stay small.
*/

const mem = (kind: MemoryKind, body: string): Memory => ({
  id: `${kind}-${body.slice(0, 6)}`,
  kind,
  body,
  concept: null,
  source: "self",
  because: null,
  updatedAt: "2026-08-01T00:00:00.000Z",
});

describe("the kinds", () => {
  it("each say what MIDO does differently because of them", () => {
    // A kind that changes nothing is a note, and notes belong on a goal.
    for (const k of MEMORY_KINDS) {
      expect(k.effect.length, k.kind).toBeGreaterThan(15);
      expect(k.example.length, k.kind).toBeGreaterThan(15);
    }
  });

  it("are all distinct, and all resolvable", () => {
    const kinds = MEMORY_KINDS.map((k) => k.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    for (const k of kinds) expect(memoryMeta(k).kind).toBe(k);
  });

  it("falls back rather than throwing on something unknown", () => {
    expect(memoryMeta("nonsense" as MemoryKind)).toBeTruthy();
  });
});

describe("what a memory may be", () => {
  it("refuses something too short to mean anything", () => {
    expect(memoryIssue("a")).toBeTruthy();
    expect(memoryIssue("   ")).toBeTruthy();
  });

  it("refuses an essay, and says where it belongs instead", () => {
    const issue = memoryIssue("x".repeat(MEMORY_MAX + 1));
    expect(issue).toMatch(/one sentence/i);
    expect(issue).toMatch(/goal/i);
  });

  it("accepts the boundaries", () => {
    expect(memoryIssue("x".repeat(MEMORY_MIN))).toBeNull();
    expect(memoryIssue("x".repeat(MEMORY_MAX))).toBeNull();
  });

  it("ignores surrounding whitespace when judging length", () => {
    expect(memoryIssue(`   ${"x".repeat(MEMORY_MAX)}   `)).toBeNull();
  });
});

describe("the block that reaches the model", () => {
  it("says nothing at all when there is nothing to say", () => {
    // An empty heading would spend cached tokens telling the model that it
    // knows nothing, which it can work out from the absence.
    expect(memoryPromptBlock([])).toBe("");
  });

  it("states outright that tried things must not be recommended again", () => {
    /*
      The single most valuable thing memory does. Without this sentence the
      model treats "I did six weeks of this and it did not work" as background
      colour and cheerfully suggests it again.
    */
    const block = memoryPromptBlock([mem("tried", "Six weeks of near-post reps — no transfer.")]);
    expect(block).toMatch(/never recommend|not recommend/i);
    expect(block).toMatch(/ALREADY TRIED/);
  });

  it("tells the model these are confirmed facts, not guesses", () => {
    const block = memoryPromptBlock([mem("weakness", "First touch under pressure on the left.")]);
    expect(block).toMatch(/not guesses|they confirmed/i);
  });

  it("groups by kind and carries each kind's effect", () => {
    const block = memoryPromptBlock([
      mem("constraint", "No gym access."),
      mem("strength", "Timing of runs in behind."),
    ]);
    expect(block).toContain("CONSTRAINT");
    expect(block).toContain("STRENGTH");
    expect(block).toContain(memoryMeta("constraint").effect);
  });

  it("leaves out a kind nobody has used", () => {
    const block = memoryPromptBlock([mem("weakness", "First touch under pressure.")]);
    expect(block).not.toContain("ALREADY TRIED");
  });

  it("caps how much is held in mind at once", () => {
    // A prompt with eighty facts produces answers that mention all of them and
    // act on none.
    const many = Array.from({ length: MEMORY_PROMPT_LIMIT + 20 }, (_, i) =>
      mem("weakness", `Thing number ${i} that needs work.`),
    );
    const block = memoryPromptBlock(many);
    const lines = block.split("\n").filter((l) => l.startsWith("  - "));
    expect(lines).toHaveLength(MEMORY_PROMPT_LIMIT);
  });

  it("puts every fact on its own line, verbatim", () => {
    const body = "Two sessions a week, no gym, forty minutes' travel.";
    expect(memoryPromptBlock([mem("constraint", body)])).toContain(`  - ${body}`);
  });
});
