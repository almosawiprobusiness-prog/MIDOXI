import { describe, it, expect } from "vitest";
import { composeWatchFocus } from "@/lib/knowledge/watch-focus";

/*
  The watch focus is deterministic and record-derived: film beats goal
  wording, no record means no focus, and the instruction never claims
  anything about the match itself.
*/

describe("composeWatchFocus", () => {
  it("prefers the concept the film keeps showing", () => {
    const f = composeWatchFocus({
      goalTitle: "Improve finishing",
      filmConcepts: ["scanning"],
      favoriteClub: "Arsenal",
    });
    expect(f?.conceptSlug).toBe("scanning");
    expect(f?.because).toContain("film");
    expect(f?.instruction).toContain("Arsenal");
  });

  it("falls back to the goal's concept when there is no film", () => {
    const f = composeWatchFocus({ goalTitle: "Better pressing triggers" });
    expect(f?.conceptSlug).toBe("pressing-triggers");
    expect(f?.because.toLowerCase()).toContain("goal");
  });

  it("returns null when the record points at nothing", () => {
    expect(composeWatchFocus({ goalTitle: "Sort out my boots" })).toBeNull();
    expect(composeWatchFocus({})).toBeNull();
  });

  it("skips film slugs that are not curated concepts", () => {
    const f = composeWatchFocus({
      goalTitle: "Improve scanning",
      filmConcepts: ["not-a-real-concept"],
    });
    expect(f?.conceptSlug).toBe("scanning");
  });

  it("names no club when none is set", () => {
    const f = composeWatchFocus({ goalTitle: "Improve scanning" });
    expect(f?.instruction).toContain("Watching a match");
  });
});
