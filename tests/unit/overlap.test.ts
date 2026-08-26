import { describe, it, expect } from "vitest";
import { SUPERSEDES, briefingLinesToSuppress } from "../../lib/intelligence/overlap";
import { buildBriefing } from "../../lib/data/briefing";
import type { ActionKind } from "../../lib/intelligence/next-best-action";
import type { LockerData } from "../../lib/data/locker";

/*
  The two rule engines are not allowed to repeat each other.

  These tests exist because the failure they guard against is invisible
  in code review and obvious to a user: two panels, one above the other,
  telling them to review the same match in slightly different words.
*/

describe("briefingLinesToSuppress", () => {
  it("suppresses nothing when nothing was surfaced", () => {
    expect(briefingLinesToSuppress([])).toEqual([]);
  });

  it("maps each overlapping kind to its briefing line", () => {
    expect(briefingLinesToSuppress(["review_match"])).toEqual(["review"]);
    expect(briefingLinesToSuppress(["recovery"])).toEqual(["readiness"]);
    expect(briefingLinesToSuppress(["match_prep"])).toEqual(["match"]);
    expect(briefingLinesToSuppress(["set_goal"])).toEqual(["focus"]);
  });

  it("leaves kinds with no briefing counterpart alone", () => {
    // Neither is something the briefing ever says.
    expect(briefingLinesToSuppress(["training", "log_match"])).toEqual([]);
  });

  it("does not repeat an id when two kinds map to it", () => {
    const out = briefingLinesToSuppress(["review_match", "review_match", "study"]);
    expect(out.sort()).toEqual(["review", "study"]);
  });

  it("only names briefing ids that actually exist", () => {
    /*
      The map is written by hand against ids defined in another file. If
      somebody renames a briefing line, this catches the map going stale
      rather than the suppression silently doing nothing.
    */
    const real = new Set([
      "match", "checkin", "readiness", "review", "schedule", "focus", "study", "quiet",
    ]);
    for (const ids of Object.values(SUPERSEDES)) {
      for (const id of ids) expect(real).toContain(id);
    }
  });
});

/* A locker with something to say on every line the map can suppress. */
function noisyLocker(): LockerData {
  return {
    displayName: "Test",
    player: null,
    nextMatch: {
      id: "m1", opponent: "Riverside", home: true, daysRemaining: 2, md: "MD-2",
    },
    recentMatch: { id: "m0", opponent: "Northgate", reviewed: false },
    focus: [{ id: "g1", title: "Scanning", detail: "", progress: 0 }],
    readiness: {
      latest: { date: "2026-08-24", energy: 3, soreness: 8, sleep: 3, mental: 3 },
      rpe: [],
    },
    week: [],
    study: { title: "Rodri", detail: "Positioning", duration: "12 min", clips: 4 },
    checkedInToday: true,
    todayIndex: 0,
  } as unknown as LockerData;
}

describe("briefing suppression, end to end", () => {
  it("says everything when no recommendation was surfaced", () => {
    const ids = buildBriefing(noisyLocker()).map((l) => l.id);
    expect(ids).toContain("review");
    expect(ids).toContain("match");
    expect(ids).toContain("study");
  });

  it("drops exactly the lines the panel above already covered", () => {
    const suppress = briefingLinesToSuppress(["review_match", "study"]);
    const ids = buildBriefing(noisyLocker(), suppress).map((l) => l.id);
    expect(ids).not.toContain("review");
    expect(ids).not.toContain("study");
    // and leaves the rest untouched
    expect(ids).toContain("match");
    expect(ids).toContain("focus");
  });

  it("can suppress the briefing down to nothing", () => {
    const every: ActionKind[] = ["review_match", "recovery", "study", "match_prep", "set_goal", "checkin"];
    const lines = buildBriefing(noisyLocker(), briefingLinesToSuppress(every));
    expect(lines).toHaveLength(0);
  });

  it("never suppresses the quiet line", () => {
    /*
      "Nothing needs you this morning" cannot collide with a
      recommendation — but if the filter ever swallowed it, an empty
      locker would render an empty panel instead of an answer.
    */
    const empty = {
      ...noisyLocker(),
      nextMatch: null, recentMatch: null, focus: [], study: null,
      // checked in, and reporting fine — so the body says nothing either
      readiness: { latest: { date: "2026-08-24", energy: 8, soreness: 2, sleep: 8, mental: 8 }, rpe: [] },
    } as unknown as LockerData;
    const lines = buildBriefing(empty, ["quiet", "match", "review", "study", "focus"]);
    expect(lines.map((l) => l.id)).toEqual(["quiet"]);
  });
});
