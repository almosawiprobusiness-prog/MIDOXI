import { describe, it, expect } from "vitest";
import {
  KIND_META,
  TIMELINE_KINDS,
  FILTER_GROUPS,
  countByKind,
  dayKey,
  groupByDay,
  hrefFor,
  minutesPlayed,
  plural,
  type TimelineEntry,
} from "../../lib/data/timeline-types";
import {
  currentPeriod,
  isFuture,
  isPeriod,
  nextPeriod,
  periodLabel,
  periodRange,
  prevPeriod,
  recentPeriods,
} from "../../lib/reports/period";
import { DEFAULT_FIELDS, REPORT_FIELDS, parseFields } from "../../lib/reports/fields";

/*
  The timeline is a record of a player's football, and the two things that make
  it worth having are that it is in the right order and that nothing appears in
  it that did not happen. Both are pure functions, so both are testable here.
*/

const entry = (over: Partial<TimelineEntry> & { occurredAt: string }): TimelineEntry => ({
  id: `${over.kind ?? "match"}:${over.refId ?? "x"}`,
  kind: "match",
  refId: "x",
  title: "t",
  summary: null,
  meta: {},
  ...over,
});

describe("kinds", () => {
  it("describes every kind it can render", () => {
    for (const k of TIMELINE_KINDS) {
      expect(KIND_META[k], k).toBeTruthy();
      expect(KIND_META[k].label.length, k).toBeGreaterThan(0);
    }
  });

  it("puts every kind in exactly one filter group", () => {
    const seen = FILTER_GROUPS.flatMap((g) => g.kinds);
    expect([...seen].sort()).toEqual([...TIMELINE_KINDS].sort());
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe("grouping", () => {
  it("puts the newest day first", () => {
    const days = groupByDay([
      entry({ occurredAt: "2026-08-01T12:00:00.000Z", refId: "a" }),
      entry({ occurredAt: "2026-08-20T12:00:00.000Z", refId: "b" }),
      entry({ occurredAt: "2026-08-10T12:00:00.000Z", refId: "c" }),
    ]);
    expect(days.map((d) => d.date)).toEqual(["2026-08-20", "2026-08-10", "2026-08-01"]);
  });

  it("puts the newest entry first within a day", () => {
    const [day] = groupByDay([
      entry({ occurredAt: "2026-08-20T09:00:00.000Z", refId: "early", kind: "checkin" }),
      entry({ occurredAt: "2026-08-20T17:00:00.000Z", refId: "late", kind: "training" }),
    ]);
    expect(day.entries.map((e) => e.refId)).toEqual(["late", "early"]);
  });

  it("puts the match above anything logged at the same instant", () => {
    // A Saturday is remembered as the match first, not the morning check-in.
    const at = "2026-08-22T14:00:00.000Z";
    const [day] = groupByDay([
      entry({ occurredAt: at, refId: "c", kind: "checkin" }),
      entry({ occurredAt: at, refId: "m", kind: "match" }),
    ]);
    expect(day.entries[0].kind).toBe("match");
  });

  it("loses nothing", () => {
    const entries = Array.from({ length: 17 }, (_, i) =>
      entry({ occurredAt: `2026-08-${String((i % 9) + 1).padStart(2, "0")}T10:00:00.000Z`, refId: `r${i}` }),
    );
    const total = groupByDay(entries).reduce((n, d) => n + d.entries.length, 0);
    expect(total).toBe(entries.length);
  });

  it("groups by the local day, not the UTC one", () => {
    // A late kickoff must not land on tomorrow for a reader west of UTC, nor
    // yesterday for one east of it.
    const iso = "2026-08-22T21:30:00.000Z";
    const local = new Date(iso);
    const expected = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(
      local.getDate(),
    ).padStart(2, "0")}`;
    expect(dayKey(iso)).toBe(expected);
  });
});

describe("counting", () => {
  it("counts every kind, including the ones with none", () => {
    const counts = countByKind([entry({ occurredAt: "2026-08-01T10:00:00Z", kind: "match" })]);
    expect(counts.match).toBe(1);
    expect(counts.training).toBe(0);
    expect(Object.keys(counts).sort()).toEqual([...TIMELINE_KINDS].sort());
  });

  it("adds up minutes from matches only", () => {
    const entries = [
      entry({ occurredAt: "2026-08-01T10:00:00Z", kind: "match", meta: { minutes: 90 } }),
      entry({ occurredAt: "2026-08-08T10:00:00Z", kind: "match", meta: { minutes: 68 } }),
      // A training session has a duration too. It is not a minute played.
      entry({ occurredAt: "2026-08-09T10:00:00Z", kind: "training", meta: { minutes: 45 } }),
    ];
    expect(minutesPlayed(entries)).toBe(158);
  });

  it("treats a match with no minutes recorded as zero, not as a guess", () => {
    expect(minutesPlayed([entry({ occurredAt: "2026-08-01T10:00:00Z", kind: "match" })])).toBe(0);
  });
});

describe("counting words", () => {
  /*
    Found by signing in as a real player: a brand-new account's timeline read
    "1 film reads · 1 pieces of evidence". One of everything is the commonest
    state a new user is ever in, so it was the first thing they would see.
  */
  it("says one film read, not one film reads", () => {
    expect(plural(1, "film read")).toBe("film read");
    expect(plural(2, "film read")).toBe("film reads");
    expect(plural(0, "film read")).toBe("film reads");
  });

  it("handles the irregulars it is actually given", () => {
    expect(plural(1, "entry", "entries")).toBe("entry");
    expect(plural(3, "entry", "entries")).toBe("entries");
    expect(plural(1, "match", "matches")).toBe("match");
    expect(plural(3, "match", "matches")).toBe("matches");
    expect(plural(1, "study", "studies")).toBe("study");
  });
});

describe("links", () => {
  it("sends every clickable kind somewhere inside the app", () => {
    for (const kind of TIMELINE_KINDS) {
      const href = hrefFor(entry({ occurredAt: "2026-08-01T10:00:00Z", kind, refId: "abc" }));
      if (href !== null) expect(href.startsWith("/app"), kind).toBe(true);
    }
  });

  it("sends film entries to the video, not to the analysis", () => {
    const href = hrefFor(
      entry({ occurredAt: "2026-08-01T10:00:00Z", kind: "analysis", refId: "an1", meta: { videoId: "v9" } }),
    );
    expect(href).toBe("/app/film-room/v9");
  });

  it("falls back to the film room when an entry has lost its video", () => {
    expect(hrefFor(entry({ occurredAt: "2026-08-01T10:00:00Z", kind: "clip", refId: "c1" }))).toBe(
      "/app/film-room",
    );
  });
});

/*
  Report periods end up in URLs and decide which month a report covers, so an
  off-by-one here is a report about the wrong month.
*/
describe("periods", () => {
  it("accepts only YYYY-MM with a real month", () => {
    expect(isPeriod("2026-08")).toBe(true);
    expect(isPeriod("2026-13")).toBe(false);
    expect(isPeriod("2026-00")).toBe(false);
    expect(isPeriod("2026-8")).toBe(false);
    expect(isPeriod("august")).toBe(false);
  });

  it("covers the whole month and not a moment of the next", () => {
    const { from, to } = periodRange("2026-08");
    expect(new Date(from).getDate()).toBe(1);
    expect(new Date(from).getMonth()).toBe(7);
    // The last instant of August, not the first of September — an event at
    // midnight on the 1st must belong to one report, and the earlier one.
    expect(new Date(to).getMonth()).toBe(7);
    expect(new Date(to).getDate()).toBe(31);
    expect(new Date(to).getTime() - new Date(from).getTime()).toBe(31 * 864e5 - 1);
  });

  it("handles February in a leap year", () => {
    const { from, to } = periodRange("2028-02");
    expect(new Date(to).getDate()).toBe(29);
    expect(Math.round((new Date(to).getTime() - new Date(from).getTime() + 1) / 864e5)).toBe(29);
  });

  it("steps across a year boundary in both directions", () => {
    expect(prevPeriod("2026-01")).toBe("2025-12");
    expect(nextPeriod("2026-12")).toBe("2027-01");
  });

  it("never offers a month that has not happened", () => {
    const now = new Date(2026, 7, 22);
    expect(isFuture(nextPeriod(currentPeriod(now)), now)).toBe(true);
    expect(isFuture(currentPeriod(now), now)).toBe(false);
    for (const p of recentPeriods(12, now)) expect(isFuture(p, now), p).toBe(false);
  });

  it("lists recent months newest first, with no repeats", () => {
    const list = recentPeriods(14, new Date(2026, 0, 5));
    expect(list[0]).toBe("2026-01");
    expect(list).toHaveLength(14);
    expect(new Set(list).size).toBe(14);
    expect([...list].sort().reverse()).toEqual(list);
  });

  it("names the month a person would call it", () => {
    expect(periodLabel("2026-08")).toContain("2026");
    expect(periodLabel("2026-08").length).toBeGreaterThan(4);
  });
});

/*
  Report fields are a privacy control. The default matters more than any other
  behaviour in this file: a player who never opens the panel must not be
  publishing their date of birth.
*/
describe("report fields", () => {
  it("shows nothing personal by default", () => {
    const sensitive = new Set(REPORT_FIELDS.filter((f) => f.sensitive).map((f) => f.id));
    for (const f of DEFAULT_FIELDS) expect(sensitive.has(f), f).toBe(false);
  });

  it("marks every field that is about the person rather than the football", () => {
    for (const id of ["dateOfBirth", "physical", "nationality", "contact"] as const) {
      expect(REPORT_FIELDS.find((f) => f.id === id)?.sensitive, id).toBe(true);
    }
  });

  it("falls back to the defaults only when nothing was asked for", () => {
    expect(parseFields(undefined)).toEqual(DEFAULT_FIELDS);
  });

  it("honours an explicitly empty selection instead of restoring the defaults", () => {
    // "show=none" is how the UI says "everything off". If that fell back to the
    // defaults, switching the last field off would switch two back on.
    expect(parseFields("none")).toEqual([]);
    expect(parseFields("")).toEqual([]);
  });

  it("drops names it does not recognise rather than guessing", () => {
    expect(parseFields("matchLog,medicalHistory,contact")).toEqual(["matchLog", "contact"]);
  });

  it("never invents a field from a partial match", () => {
    expect(parseFields("date")).toEqual([]);
    expect(parseFields("dateOfBirthX")).toEqual([]);
  });
});
