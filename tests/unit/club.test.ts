import { describe, it, expect } from "vitest";
import {
  METHODOLOGY_DOCS,
  methodologyStatus,
  teamsWithoutStaff,
  docMeta,
  staffRoleMeta,
  staffStatusMeta,
  type ClubTeamRow,
  type MethodologySection,
} from "../../lib/data/club-types";

/*
  The club layer's maths. Two things matter: the methodology count is what the
  product promises MIDO reads, and the coverage figures must be counted from
  records rather than estimated.
*/

const section = (
  doc: MethodologySection["doc"],
  name: string,
  principles: string[],
): MethodologySection => ({
  id: `${doc}-${name}`,
  doc,
  section: name,
  principles,
  detail: "",
  ageGroup: "",
  position: 0,
  updatedAt: "2026-08-01T00:00:00.000Z",
});

const team = (id: string, name: string, staff: ClubTeamRow["staff"]): ClubTeamRow => ({
  id,
  name,
  ageGroup: "U18",
  level: "Academy",
  season: "2026 / 27",
  squadSize: 20,
  staff,
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("methodology status", () => {
  it("counts sections per document and principles overall", () => {
    const sections = [
      section("play", "Build-up", ["a", "b", "c"]),
      section("play", "Pressing", ["d", "e"]),
      section("train", "Session structure", ["f"]),
    ];
    const status = methodologyStatus(sections);
    expect(status.play).toBe(2);
    expect(status.train).toBe(1);
    expect(status.develop).toBe(0);
    expect(status.principles).toBe(6);
    expect(status.documentsStarted).toBe(2);
  });

  it("reports an empty methodology as empty rather than partial", () => {
    const status = methodologyStatus([]);
    expect(status.principles).toBe(0);
    expect(status.documentsStarted).toBe(0);
  });

  it("does not count a section with no principles as reach", () => {
    // A section with no principles is a heading; MIDO reads nothing from it.
    const status = methodologyStatus([section("play", "Build-up", [])]);
    expect(status.play).toBe(1);
    expect(status.principles).toBe(0);
  });

  it("describes all three documents with prompts a club can start from", () => {
    expect(METHODOLOGY_DOCS).toHaveLength(3);
    for (const d of METHODOLOGY_DOCS) {
      expect(d.suggested.length, d.doc).toBeGreaterThanOrEqual(4);
      expect(docMeta(d.doc).title).toBe(d.title);
    }
  });
});

describe("club coverage", () => {
  it("finds the teams nobody is responsible for", () => {
    const teams = [
      team("t1", "First team", [{ id: "s1", name: "A. Whitlock", role: "head-coach" }]),
      team("t2", "U18", []),
      team("t3", "U16", []),
    ];
    expect(teamsWithoutStaff(teams).map((t) => t.name)).toEqual(["U18", "U16"]);
  });

  it("returns nothing to flag when every team is staffed", () => {
    const teams = [team("t1", "First team", [{ id: "s1", name: "A", role: "coach" }])];
    expect(teamsWithoutStaff(teams)).toHaveLength(0);
  });
});

describe("club labels", () => {
  it("falls back safely for unknown roles and statuses", () => {
    expect(staffRoleMeta("head-coach").label).toBe("Head coach");
    expect(staffRoleMeta("nonsense" as never).label).toBe("Staff");
    expect(staffStatusMeta("active").label).toBe("Active");
    expect(staffStatusMeta("nonsense" as never).label).toBe("Recorded");
  });
});
