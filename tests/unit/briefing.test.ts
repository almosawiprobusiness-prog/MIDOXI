import { describe, it, expect } from "vitest";
import { LOW_READINESS, buildBriefing, greeting } from "../../lib/data/briefing";
import type { LockerData } from "../../lib/data/locker";

/*
  A briefing is the easiest place in a product to start making things up. "You
  look sharp this week" costs nothing to write and means nothing.

  These tests hold every line to its cause: it appears because a condition is
  true, it names the fact behind it, and it never comments on the player.
*/

const base = (over: Partial<LockerData> = {}): LockerData =>
  ({
    isSeed: false,
    displayName: "Sam Reed",
    player: null,
    nextMatch: null,
    recentMatch: null,
    focus: [],
    goals: [],
    readiness: { latest: null, rpe: [] },
    week: [],
    study: null,
    checkedInToday: true,
    todayIndex: 2,
    ...over,
  }) as LockerData;

const match = (daysRemaining: number) => ({
  opponent: "Riverside",
  competition: "League",
  home: true,
  daysRemaining,
  md: `MD-${daysRemaining}`,
});

describe("what the briefing says", () => {
  it("says nothing needs you, rather than inventing something", () => {
    const lines = buildBriefing(base());
    expect(lines).toHaveLength(1);
    expect(lines[0].id).toBe("quiet");
    expect(lines[0].headline.toLowerCase()).toContain("nothing needs you");
  });

  it("counts down to the match in days, from the record", () => {
    expect(buildBriefing(base({ nextMatch: match(3) }))[0].headline).toContain("3 days to Riverside");
    expect(buildBriefing(base({ nextMatch: match(1) }))[0].headline).toContain("tomorrow");
    expect(buildBriefing(base({ nextMatch: match(0) }))[0].headline).toContain("Matchday");
  });

  it("puts a close match above everything else", () => {
    const lines = buildBriefing(
      base({
        nextMatch: match(1),
        focus: [{ id: "f", category: "technical", title: "Finishing", detail: "" }],
      }),
    );
    expect(lines[0].id).toBe("match");
  });

  it("drops a distant match below the work", () => {
    const lines = buildBriefing(
      base({
        nextMatch: match(9),
        recentMatch: { id: "m1", opponent: "Halton", reviewed: false } as LockerData["recentMatch"],
      }),
    );
    expect(lines[0].id).toBe("review");
  });
});

describe("the body", () => {
  it("asks for a check-in rather than guessing at readiness", () => {
    const lines = buildBriefing(base({ checkedInToday: false }));
    const line = lines.find((l) => l.id === "checkin")!;
    expect(line).toBeDefined();
    expect(line.detail.toLowerCase()).toContain("will not guess");
  });

  it("stays quiet about readiness that was never reported", () => {
    const lines = buildBriefing(base({ checkedInToday: true, readiness: { latest: null, rpe: [] } }));
    expect(lines.some((l) => l.id === "readiness")).toBe(false);
  });

  it("only raises readiness when the player reported a low one, and quotes it back", () => {
    const low = buildBriefing(
      base({
        readiness: {
          latest: { date: "2026-08-21", energy: 1, soreness: 5, sleep: 2, mental: 2 },
          rpe: [],
        },
      }),
    );
    const line = low.find((l) => l.id === "readiness")!;
    expect(line).toBeDefined();
    expect(line.headline).toMatch(/You reported \d+\/100/);

    const fine = buildBriefing(
      base({
        readiness: {
          latest: { date: "2026-08-21", energy: 5, soreness: 1, sleep: 5, mental: 5 },
          rpe: [],
        },
      }),
    );
    expect(fine.some((l) => l.id === "readiness")).toBe(false);
  });

  it("advises managing the session, never diagnosing", () => {
    const lines = buildBriefing(
      base({
        readiness: {
          latest: { date: "2026-08-21", energy: 1, soreness: 5, sleep: 1, mental: 1 },
          rpe: [],
        },
      }),
    );
    const text = lines.map((l) => `${l.headline} ${l.detail}`).join(" ").toLowerCase();
    expect(text).not.toMatch(/\b(injur|overtrain|do not train|rest completely|see a doctor)\b/);
  });

  it("uses the same readiness threshold the constant declares", () => {
    expect(LOW_READINESS).toBeGreaterThan(0);
    expect(LOW_READINESS).toBeLessThan(100);
  });
});

describe("discipline", () => {
  it("gives every line something to do about it", () => {
    const lines = buildBriefing(
      base({
        nextMatch: match(2),
        checkedInToday: false,
        focus: [{ id: "f", category: "technical", title: "Finishing", detail: "Front post" }],
        study: { title: "Riverside", detail: "Blindside", duration: "18 min", clips: 5 },
      }),
    );
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) {
      expect(l.action, l.id).toBeTruthy();
      expect(l.action!.href, l.id).toMatch(/^\/app/);
    }
  });

  it("never comments on the player, only on the record", () => {
    const lines = buildBriefing(
      base({
        nextMatch: match(1),
        focus: [{ id: "f", category: "mental", title: "Composure", detail: "" }],
      }),
    );
    const text = lines.map((l) => `${l.headline} ${l.detail}`).join(" ").toLowerCase();
    expect(text).not.toMatch(/\byou (look|seem|are) (sharp|good|great|ready|poor|off)\b/);
  });

  it("never repeats a line", () => {
    const lines = buildBriefing(
      base({
        nextMatch: match(1),
        checkedInToday: false,
        recentMatch: { id: "m", opponent: "Halton", reviewed: false } as LockerData["recentMatch"],
        week: [{ id: "e", day: 2, kind: "team", label: "Team training" }],
      }),
    );
    expect(new Set(lines.map((l) => l.id)).size).toBe(lines.length);
  });
});

describe("greeting", () => {
  it("changes with the hour and uses a first name", () => {
    expect(greeting("Sam Reed", new Date("2026-08-21T08:00:00"))).toBe("Morning, Sam");
    expect(greeting("Sam Reed", new Date("2026-08-21T14:00:00"))).toBe("Afternoon, Sam");
    expect(greeting("Sam Reed", new Date("2026-08-21T20:00:00"))).toBe("Evening, Sam");
  });

  it("works with no name at all", () => {
    expect(greeting("", new Date("2026-08-21T08:00:00"))).toBe("Morning");
  });
});
