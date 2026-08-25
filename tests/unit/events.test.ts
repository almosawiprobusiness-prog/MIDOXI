import { describe, it, expect } from "vitest";
import {
  emitIssue,
  isEventType,
  idempotencyKey,
  EVENT_SUBJECT,
  EVENT_TYPES,
  PAYLOAD_MAX_BYTES,
  type EmitInput,
} from "../../lib/events/types";

/*
  The event log is append-only and read by everything downstream, so a
  malformed row is not a local problem — it is a row every future query
  has to defend against. These pin the rules that keep it out.
*/

const goalCreated: EmitInput = {
  type: "GOAL_CREATED",
  subjectType: "goal",
  subjectId: "g1",
  payload: { title: "Weak-foot finishing" },
};

describe("the vocabulary", () => {
  it("stays small enough to be a vocabulary", () => {
    // Twenty-odd types is a language. Two hundred is a log file, and
    // nothing downstream can reason about a language it cannot hold.
    expect(EVENT_TYPES.length).toBeLessThan(40);
    expect(EVENT_TYPES.length).toBeGreaterThan(10);
  });

  it("gives every type exactly one subject", () => {
    for (const t of EVENT_TYPES) {
      expect(EVENT_SUBJECT[t], `${t} has no subject`).toBeTruthy();
    }
  });

  it("contains no interface telemetry", () => {
    // Analytics is a different system with different retention and
    // different privacy. If a row would not change a recommendation, it
    // does not belong in the football record.
    /*
      Matched on whole SEGMENTS, not substrings. A naive /VIEW/ flags
      MATCH_REVIEWED, which is the most important event in the player
      loop — a guard that fires on the thing it exists to protect is
      worse than no guard.
    */
    for (const t of EVENT_TYPES) {
      expect(t, `${t} looks like telemetry`).not.toMatch(
        /_VIEWED$|_CLICKED$|_OPENED$|_CLOSED$|_SCROLLED$|_HOVERED$|^PAGE_|^MODAL_|^BUTTON_/,
      );
    }
  });

  it("recognises its own types and nothing else", () => {
    expect(isEventType("GOAL_CREATED")).toBe(true);
    expect(isEventType("BUTTON_CLICKED")).toBe(false);
    expect(isEventType(null)).toBe(false);
    expect(isEventType(42)).toBe(false);
  });
});

describe("what is allowed through", () => {
  it("accepts a well-formed event", () => {
    expect(emitIssue(goalCreated)).toBeNull();
  });

  it("refuses an unknown type", () => {
    // @ts-expect-error deliberately outside the union — this is the
    // shape a stale caller would send after a rename.
    expect(emitIssue({ ...goalCreated, type: "GOAL_INVENTED" })).toContain("Unknown event type");
  });

  it("refuses an event about the wrong kind of thing", () => {
    /*
      A GOAL_CREATED whose subject is a match is a bug in the caller, and
      one that reaches storage silently poisons every later query about
      either goals or matches.
    */
    const issue = emitIssue({ ...goalCreated, subjectType: "match" });
    expect(issue).toContain("about a goal");
  });

  it("refuses a payload that has become a copy of the domain", () => {
    const fat = { ...goalCreated, payload: { blob: "x".repeat(PAYLOAD_MAX_BYTES + 1) } };
    const issue = emitIssue(fat);
    expect(issue).toContain("references the domain rather than copying it");
  });

  it("accepts a payload right at the limit", () => {
    const atLimit = { ...goalCreated, payload: { blob: "x".repeat(PAYLOAD_MAX_BYTES - 20) } };
    expect(emitIssue(atLimit)).toBeNull();
  });

  it("refuses a date that is not one", () => {
    expect(emitIssue({ ...goalCreated, occurredAt: "not a date" })).toContain("not a date");
  });

  it("accepts a backdated event", () => {
    /*
      A match played on Saturday and entered on Monday is a Saturday
      event. Refusing past dates would make the log a record of when
      somebody did paperwork.
    */
    expect(emitIssue({ ...goalCreated, occurredAt: "2020-01-01T00:00:00Z" })).toBeNull();
  });
});

describe("idempotency keys", () => {
  it("is stable for the same thing", () => {
    expect(idempotencyKey(["match", "reviewed", "m1"])).toBe(
      idempotencyKey(["match", "reviewed", "m1"]),
    );
  });

  it("separates different things", () => {
    expect(idempotencyKey(["match", "reviewed", "m1"])).not.toBe(
      idempotencyKey(["match", "reviewed", "m2"]),
    );
  });

  it("separates different events about the same thing", () => {
    // Creating and reviewing one match must not collide, or reviewing it
    // would silently be swallowed as a duplicate of creating it.
    expect(idempotencyKey(["match", "created", "m1"])).not.toBe(
      idempotencyKey(["match", "reviewed", "m1"]),
    );
  });

  it("ignores gaps rather than producing ragged keys", () => {
    expect(idempotencyKey(["goal", null, "g1"])).toBe("goal:g1");
    expect(idempotencyKey(["goal", undefined, "g1"])).toBe("goal:g1");
    expect(idempotencyKey(["goal", "", "g1"])).toBe("goal:g1");
  });
});
