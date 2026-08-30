import { describe, it, expect } from "vitest";
import {
  detectPatterns,
  patternEvidenceLine,
  composeMatchFocus,
  PATTERN_MIN_COUNT,
  type PatternInput,
} from "../../lib/intelligence/patterns";
import { CONCEPTS } from "../../lib/knowledge/concepts";

/*
  Pattern arithmetic — the counting that turns observations into
  development evidence, and the one-cue match focus that falls out of
  it. Real curated slugs are used so the graph lookup is exercised.
*/

const SLUG = CONCEPTS[0]!.slug;
const OTHER = CONCEPTS[1]!.slug;

const NOW = new Date("2026-08-30T12:00:00Z");
const row = (concept: string | undefined, videoId: string, on: string): PatternInput => ({
  concept,
  videoId,
  on,
});

describe("detectPatterns", () => {
  it("counts repetition, spread and recency — arithmetic, not vibes", () => {
    const patterns = detectPatterns(
      [
        row(SLUG, "v1", "2026-08-28"),
        row(SLUG, "v2", "2026-08-25"),
        row(SLUG, "v2", "2026-08-25"),
        row(OTHER, "v1", "2026-08-29"),
      ],
      NOW,
    );
    const p = patterns.find((x) => x.concept === SLUG)!;
    expect(p.count).toBe(3);
    expect(p.videos).toBe(2);
    expect(p.lastDaysAgo).toBe(2);
    // OTHER appeared once — once is a moment, not a pattern.
    expect(patterns.some((x) => x.concept === OTHER)).toBe(false);
  });

  it(`a pattern needs ${PATTERN_MIN_COUNT} sightings`, () => {
    expect(detectPatterns([row(SLUG, "v1", "2026-08-29")], NOW)).toEqual([]);
  });

  it("observations without a concept never form a pattern", () => {
    expect(
      detectPatterns([row(undefined, "v1", "2026-08-29"), row(undefined, "v1", "2026-08-29")], NOW),
    ).toEqual([]);
  });

  it("the evidence line states counts, never significance", () => {
    const [p] = detectPatterns([row(SLUG, "v1", "2026-08-28"), row(SLUG, "v2", "2026-08-28")], NOW);
    const line = patternEvidenceLine(p!);
    expect(line).toContain("Observed 2 times");
    expect(line).not.toMatch(/significant|proves|always/i);
  });
});

describe("composeMatchFocus", () => {
  it("one or two cues from the curated concept, with the film count as the reason", () => {
    const focus = composeMatchFocus(
      detectPatterns([row(SLUG, "v1", "2026-08-28"), row(SLUG, "v2", "2026-08-27")], NOW),
    );
    expect(focus).not.toBeNull();
    expect(focus!.cues.length).toBeGreaterThanOrEqual(1);
    expect(focus!.cues.length).toBeLessThanOrEqual(2);
    // The cue is the curated concept's own — written by a person.
    expect(CONCEPTS.find((c) => c.slug === SLUG)!.cues).toContain(focus!.cues[0]);
    expect(focus!.because).toMatch(/2 times/);
  });

  it("no repeated pattern means no focus — silence is the honest output", () => {
    expect(composeMatchFocus([])).toBeNull();
  });

  it("a pattern on an uncurated slug is skipped, not improvised", () => {
    const focus = composeMatchFocus(
      detectPatterns(
        [row("not-a-real-concept", "v1", "2026-08-28"), row("not-a-real-concept", "v2", "2026-08-27")],
        NOW,
      ),
    );
    expect(focus).toBeNull();
  });
});
