import { describe, it, expect } from "vitest";
import {
  MIN_MATCHES_FOR_PER90,
  MIN_MINUTES_FOR_PER90,
  NOT_RECORDED,
  PER90_SOURCES,
  highlightsFrom,
  per90From,
  workloadFrom,
  type MatchRow,
  type StatLine,
} from "../../lib/data/performance-types";
import {
  BAND_META,
  CHECKIN_FIELDS,
  NOT_MEASURED,
  bandOf,
  readinessOf,
  streakOf,
  type Checkin,
} from "../../lib/data/recovery-types";

/*
  Performance and Recovery are the two screens where a fabricated number does
  real damage — one shapes how a player thinks they are playing, the other
  whether they train today. Both used to render a hardcoded module with no
  demo-mode branch at all.

  These tests hold the replacement to its rule: every figure comes from
  something recorded, and where nothing was recorded, nothing is shown.
*/

const line = (minutes: number, values: Record<string, number>): StatLine => ({
  matchId: `m${minutes}${Object.keys(values).join("")}`,
  minutes,
  values,
});

describe("per 90", () => {
  it("refuses a figure built on too few matches", () => {
    const one = per90From([line(90, { shots: 4 })]);
    expect(one).toHaveLength(0);
    expect(MIN_MATCHES_FOR_PER90).toBeGreaterThan(1);
  });

  it("refuses a figure built on too few minutes", () => {
    // Two matches, but only 40 minutes between them — a per-90 from this is
    // arithmetic pretending to be evidence.
    const thin = per90From([line(20, { shots: 2 }), line(20, { shots: 2 })]);
    expect(thin).toHaveLength(0);
    expect(MIN_MINUTES_FOR_PER90).toBeGreaterThanOrEqual(90);
  });

  it("computes the rate against minutes actually played", () => {
    const [shots] = per90From([line(90, { shots: 3 }), line(90, { shots: 5 })]);
    expect(shots.value).toBe(4); // 8 shots / 180 min * 90
    expect(shots.fromMatches).toBe(2);
  });

  it("ignores matches where the stat was left blank, rather than counting them as zero", () => {
    const withBlank = per90From([
      line(90, { shots: 4 }),
      line(90, { shots: 4 }),
      { matchId: "m3", minutes: 90, values: { shots: null } },
    ]);
    expect(withBlank[0].value).toBe(4);
    expect(withBlank[0].fromMatches).toBe(2);
  });

  it("only draws from columns the database actually has", () => {
    // Every source must be a real match_stats column. "Pressures" and "box
    // touches" were in the old demo and are in neither the schema nor here.
    const columns = PER90_SOURCES.map((s) => s.column);
    expect(columns).not.toContain("pressures");
    expect(columns).not.toContain("box_touches");
    expect(columns).not.toContain("runs_in_behind");
    for (const c of columns) expect(c).toMatch(/^[a-z_]+$/);
  });

  it("names the tracking metrics it cannot produce", () => {
    expect(NOT_RECORDED.metrics).toContain("Pressures");
    expect(NOT_RECORDED.metrics).toContain("xG");
    expect(NOT_RECORDED.why.length).toBeGreaterThan(20);
  });
});

describe("workload", () => {
  const now = new Date("2026-08-21T12:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 864e5).toISOString();

  it("returns a bar per week even when nothing was logged", () => {
    const weeks = workloadFrom([], [], 8, now);
    expect(weeks).toHaveLength(8);
    expect(weeks.every((w) => w.training === 0 && w.match === 0)).toBe(true);
  });

  it("puts work in the week it happened", () => {
    const weeks = workloadFrom(
      [{ date: daysAgo(2), minutes: 90 }],
      [{ date: daysAgo(2), minutes: 60 }],
      8,
      now,
    );
    expect(weeks[7]).toEqual({ week: "W8", training: 60, match: 90 });
    expect(weeks[0]).toEqual({ week: "W1", training: 0, match: 0 });
  });

  it("drops work older than the window rather than piling it into week one", () => {
    const weeks = workloadFrom([{ date: daysAgo(90), minutes: 90 }], [], 8, now);
    expect(weeks.reduce((n, w) => n + w.match, 0)).toBe(0);
  });
});

describe("highlights", () => {
  const m = (over: Partial<MatchRow>): MatchRow => ({
    id: "m",
    date: "2026-08-09T00:00:00Z",
    opponent: "Halton",
    opponentShort: "HAL",
    competition: "Cup",
    home: true,
    gf: 2,
    ga: 1,
    position: "CF",
    started: true,
    minutes: 90,
    goals: 0,
    assists: 0,
    rating: null,
    ...over,
  });

  it("says nothing when there is nothing to say", () => {
    expect(highlightsFrom([])).toEqual([]);
    expect(highlightsFrom([m({})])).toEqual([]);
  });

  it("does not call a single goal a highlight", () => {
    const out = highlightsFrom([m({ goals: 1 })]);
    expect(out.some((h) => h.label.includes("goals vs"))).toBe(false);
  });

  it("names the match a highlight came from", () => {
    const out = highlightsFrom([m({ goals: 2, opponent: "Ashford" })]);
    expect(out[0].label).toContain("Ashford");
  });

  it("does not stamp a running total with a single date", () => {
    const out = highlightsFrom([m({ goals: 1, assists: 1 })]);
    const total = out.find((h) => h.label.includes("contribution"));
    expect(total?.date).toBe("To date");
  });
});

// ---------------------------------------------------------------------------

const checkin = (over: Partial<Checkin>): Checkin => ({
  date: "2026-08-21",
  energy: null,
  soreness: null,
  sleep: null,
  mental: null,
  note: null,
  ...over,
});

describe("readiness", () => {
  it("is null when too little was reported to say anything", () => {
    expect(readinessOf(checkin({}))).toBeNull();
    expect(readinessOf(checkin({ energy: 4 }))).toBeNull();
  });

  it("reads a flat three as the middle of the range", () => {
    expect(readinessOf(checkin({ energy: 3, sleep: 3, mental: 3, soreness: 3 }))).toBe(50);
  });

  it("treats soreness as the one that runs backwards", () => {
    const fresh = readinessOf(checkin({ energy: 4, sleep: 4, mental: 4, soreness: 1 }));
    const sore = readinessOf(checkin({ energy: 4, sleep: 4, mental: 4, soreness: 5 }));
    expect(fresh).toBeGreaterThan(sore!);
  });

  it("reaches the ends of the scale", () => {
    expect(readinessOf(checkin({ energy: 5, sleep: 5, mental: 5, soreness: 1 }))).toBe(100);
    expect(readinessOf(checkin({ energy: 1, sleep: 1, mental: 1, soreness: 5 }))).toBe(0);
  });

  it("averages only what was answered, rather than assuming a blank is a zero", () => {
    // Two fives answered should not be dragged down by two unanswered fields.
    expect(readinessOf(checkin({ energy: 5, sleep: 5 }))).toBe(100);
  });
});

describe("readiness bands", () => {
  it("has an honest band for having no data", () => {
    expect(bandOf(null)).toBe("unknown");
    expect(BAND_META.unknown.label).toBe("Not reported");
  });

  it("advises managing load rather than resting, which is a medical call", () => {
    expect(bandOf(20)).toBe("manage");
    expect(BAND_META.manage.advice.toLowerCase()).not.toMatch(/\b(injur|rest completely|do not train)\b/);
  });

  it("attributes every reading back to the player", () => {
    for (const band of ["primed", "ready", "manage"] as const) {
      expect(BAND_META[band].advice.toLowerCase(), band).toMatch(/you reported|fine to train|consider/);
    }
  });
});

describe("what recovery does not measure", () => {
  it("only asks for the four things the schema holds", () => {
    expect(CHECKIN_FIELDS.map((f) => f.key).sort()).toEqual([
      "energy",
      "mental",
      "sleep",
      "soreness",
    ]);
  });

  it("names the physiology it cannot see, and what would be needed", () => {
    expect(NOT_MEASURED.metrics).toContain("HRV");
    expect(NOT_MEASURED.metrics).toContain("Hydration");
    expect(NOT_MEASURED.wouldNeed.toLowerCase()).toContain("wearable");
  });
});

describe("check-in streak", () => {
  const now = new Date("2026-08-21T12:00:00Z");
  const at = (n: number) => new Date(now.getTime() - n * 864e5).toISOString().slice(0, 10);

  it("counts only days inside the window", () => {
    const s = streakOf([checkin({ date: at(1) }), checkin({ date: at(20) })], 7, now);
    expect(s).toEqual({ reported: 1, of: 7 });
  });
});
