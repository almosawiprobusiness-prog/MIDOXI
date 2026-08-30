import { describe, it, expect } from "vitest";
import { suggestStudyFor } from "@/lib/knowledge/study-match";

/*
  The DEVELOPMENT → STUDY arrow: a goal (and what the film keeps
  showing) names a real page in the curated library. These pin the
  weighting — film beats words — and that no match means no suggestion.
*/

describe("suggestStudyFor", () => {
  it("matches a goal to a person who embodies its concept", () => {
    // Kane and Haaland both embody near-post finishing; either is a
    // correct answer — the contract is the concept, not the tiebreak.
    const s = suggestStudyFor({ goalTitle: "Improve near-post finishing" });
    expect(["harry-kane", "erling-haaland"]).toContain(s?.slug);
    expect(s?.conceptName.toLowerCase()).toContain("near-post");
  });

  it("film evidence outweighs goal wording", () => {
    // The goal says finishing (Haaland ground), but the film keeps
    // showing scanning — Rodri embodies scanning twice over via
    // scanning + decision-speed? No: two scanning observations both
    // count, and Rodri carries the scanning slug.
    const s = suggestStudyFor({
      goalTitle: "Improve finishing",
      filmConcepts: ["scanning", "scanning", "receiving-half-turn"],
    });
    expect(s?.slug).toBe("rodri");
    expect(s?.because).toContain("film");
  });

  it("returns null when nothing in the library genuinely fits", () => {
    expect(suggestStudyFor({ goalTitle: "Sort out my boots" })).toBeNull();
  });

  it("says why, naming the concept", () => {
    const s = suggestStudyFor({ goalTitle: "Better pressing triggers" });
    expect(s).not.toBeNull();
    expect(s!.because.toLowerCase()).toContain("pressing");
  });
});
