import { describe, it, expect } from "vitest";
import { groupConceptThreads } from "@/lib/data/development-types";

/*
  Threads are the arithmetic behind "the fourth time this appears" —
  a pattern surface built by counting confirmed rows, so the counting
  itself has to be beyond argument.
*/

const row = (concept: string | null, goalId: string, createdAt: string) => ({ concept, goalId, createdAt });

describe("groupConceptThreads", () => {
  it("groups by concept and counts, most filed first", () => {
    const threads = groupConceptThreads([
      row("scanning", "g1", "2026-08-01T10:00:00"),
      row("scanning", "g1", "2026-08-05T10:00:00"),
      row("scanning", "g2", "2026-08-03T10:00:00"),
      row("near-post-finishing", "g3", "2026-08-04T10:00:00"),
      row("near-post-finishing", "g3", "2026-08-06T10:00:00"),
    ]);
    expect(threads.map((t) => t.concept)).toEqual(["scanning", "near-post-finishing"]);
    expect(threads[0].count).toBe(3);
    expect(threads[0].lastAt).toBe("2026-08-05T10:00:00");
  });

  it("a single sighting is not a thread", () => {
    expect(groupConceptThreads([row("scanning", "g1", "2026-08-01T10:00:00")])).toEqual([]);
  });

  it("ignores rows with no concept — unlabelled evidence is not a pattern", () => {
    const threads = groupConceptThreads([
      row(null, "g1", "2026-08-01T10:00:00"),
      row(null, "g1", "2026-08-02T10:00:00"),
    ]);
    expect(threads).toEqual([]);
  });

  it("orders a thread's goals by most recent filing, deduplicated", () => {
    const [t] = groupConceptThreads([
      row("scanning", "g1", "2026-08-01T10:00:00"),
      row("scanning", "g2", "2026-08-09T10:00:00"),
      row("scanning", "g1", "2026-08-05T10:00:00"),
    ]);
    expect(t.goalIds).toEqual(["g2", "g1"]);
  });

  it("breaks count ties by recency", () => {
    const threads = groupConceptThreads([
      row("scanning", "g1", "2026-08-01T10:00:00"),
      row("scanning", "g1", "2026-08-02T10:00:00"),
      row("acceleration", "g2", "2026-08-03T10:00:00"),
      row("acceleration", "g2", "2026-08-04T10:00:00"),
    ]);
    expect(threads[0].concept).toBe("acceleration");
  });
});
