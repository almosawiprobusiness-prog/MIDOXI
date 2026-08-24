import { describe, it, expect } from "vitest";
import {
  JOIN_OPENS_MIN,
  MAX_MINUTES,
  canJoin,
  joinBlockedReason,
  minutesBetween,
  positionBetween,
  rangeIssue,
  relativeWhen,
  renumber,
  titleIssue,
  type Meeting,
} from "../../lib/data/meeting-types";

/*
  Meetings two people share.

  What is pinned here is the handful of rules that decide what somebody
  sees, because every one of them fails silently: a join window that is
  off by ten minutes just looks like a broken button, and an ordering
  scheme that collapses just looks like the list shuffling itself.
*/

const base = (over: Partial<Meeting> = {}): Pick<Meeting, "status" | "startsAt" | "endsAt"> => ({
  status: "confirmed",
  startsAt: "2026-05-01T12:00:00.000Z",
  endsAt: "2026-05-01T13:00:00.000Z",
  ...over,
});

const at = (iso: string) => new Date(iso);

describe("when the door opens", () => {
  it("lets people in early, because they arrive early", () => {
    // A locked door two minutes before the start reads as a broken feature.
    expect(canJoin(base(), at("2026-05-01T11:52:00.000Z"))).toBe(true);
  });

  it("is shut before that", () => {
    expect(canJoin(base(), at("2026-05-01T11:30:00.000Z"))).toBe(false);
  });

  it("opens exactly on the boundary", () => {
    const opens = new Date(Date.parse("2026-05-01T12:00:00.000Z") - JOIN_OPENS_MIN * 60_000);
    expect(canJoin(base(), opens)).toBe(true);
  });

  it("stays open past the end so an overrun is not cut off mid-sentence", () => {
    expect(canJoin(base(), at("2026-05-01T13:10:00.000Z"))).toBe(true);
  });

  it("shuts eventually", () => {
    expect(canJoin(base(), at("2026-05-01T13:30:00.000Z"))).toBe(false);
  });

  it("never opens for a meeting nobody agreed to", () => {
    // The important one: a proposed meeting is not a meeting yet.
    expect(canJoin(base({ status: "proposed" }), at("2026-05-01T12:30:00.000Z"))).toBe(false);
    expect(canJoin(base({ status: "cancelled" }), at("2026-05-01T12:30:00.000Z"))).toBe(false);
    expect(canJoin(base({ status: "declined" }), at("2026-05-01T12:30:00.000Z"))).toBe(false);
  });
});

describe("saying why the door is shut", () => {
  it("says nothing when it is open", () => {
    expect(joinBlockedReason(base(), at("2026-05-01T12:30:00.000Z"))).toBeNull();
  });

  it("distinguishes cancelled from declined", () => {
    // One was called off, the other never happened. A player looking at a
    // coach who cancels repeatedly deserves to see which.
    expect(joinBlockedReason(base({ status: "cancelled" }))).toMatch(/cancelled/i);
    expect(joinBlockedReason(base({ status: "declined" }))).toMatch(/declined/i);
  });

  it("tells somebody who is early when to come back", () => {
    const why = joinBlockedReason(base(), at("2026-05-01T10:00:00.000Z"));
    expect(why).toMatch(new RegExp(String(JOIN_OPENS_MIN)));
  });

  it("always gives a reason rather than a bare disabled button", () => {
    for (const status of ["proposed", "declined", "cancelled", "done"] as const) {
      expect(joinBlockedReason(base({ status })), status).toBeTruthy();
    }
  });
});

describe("what may be booked", () => {
  it("refuses a meeting that ends before it starts", () => {
    expect(rangeIssue("2026-05-01T13:00:00Z", "2026-05-01T12:00:00Z")).toBeTruthy();
  });

  it("refuses one of no length, which renders as an invisible block", () => {
    expect(rangeIssue("2026-05-01T12:00:00Z", "2026-05-01T12:00:00Z")).toBeTruthy();
  });

  it("refuses one that would swallow a calendar", () => {
    const start = "2026-05-01T00:00:00.000Z";
    const tooLong = new Date(Date.parse(start) + (MAX_MINUTES + 1) * 60_000).toISOString();
    expect(rangeIssue(start, tooLong)).toBeTruthy();
  });

  it("allows a session in the past, because logging one that happened is real", () => {
    expect(rangeIssue("2020-01-01T10:00:00Z", "2020-01-01T11:00:00Z")).toBeNull();
  });

  it("wants a title", () => {
    expect(titleIssue("")).toBeTruthy();
    expect(titleIssue("   ")).toBeTruthy();
    expect(titleIssue("Northgate away — first half")).toBeNull();
  });
});

describe("ordering the agenda", () => {
  it("puts the first item somewhere", () => {
    expect(positionBetween(null, null)).toBe(1);
  });

  it("drops between two neighbours without touching them", () => {
    // One row written, not a renumber — which is what stops two people
    // reordering at once from fighting.
    expect(positionBetween(1, 2)).toBe(1.5);
    expect(positionBetween(1.5, 2)).toBe(1.75);
  });

  it("moves to either end", () => {
    expect(positionBetween(null, 1)).toBe(0);
    expect(positionBetween(4, null)).toBe(5);
  });

  it("admits when a gap has collapsed instead of writing a duplicate", () => {
    /*
      Doubles run out after ~50 splits in the same gap. Returning null
      makes the caller renumber deliberately; the alternative is two
      items quietly sharing a position and the list appearing to shuffle
      itself.
    */
    expect(positionBetween(1, 1 + 1e-12)).toBeNull();
    expect(positionBetween(1, 1)).toBeNull();
  });

  it("renumbers to whole numbers, in order", () => {
    const out = renumber(["a", "b", "c"]);
    expect(out.map((o) => o.position)).toEqual([1, 2, 3]);
    expect(out.map((o) => o.item)).toEqual(["a", "b", "c"]);
  });
});

describe("saying when", () => {
  it("counts minutes", () => {
    expect(minutesBetween("2026-05-01T12:00:00Z", "2026-05-01T12:45:00Z")).toBe(45);
  });

  it("reads as a person would say it", () => {
    const now = at("2026-05-01T12:00:00.000Z");
    expect(relativeWhen("2026-05-01T14:00:00.000Z", now)).toBe("in 2 hours");
    expect(relativeWhen("2026-05-01T11:30:00.000Z", now)).toBe("30 minutes ago");
    expect(relativeWhen("2026-05-04T12:00:00.000Z", now)).toBe("in 3 days");
  });

  it("does not say '1 hours'", () => {
    const now = at("2026-05-01T12:00:00.000Z");
    expect(relativeWhen("2026-05-01T13:00:00.000Z", now)).toBe("in 1 hour");
    expect(relativeWhen("2026-05-02T12:00:00.000Z", now)).toBe("in 1 day");
  });
});
