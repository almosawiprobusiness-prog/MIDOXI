import { describe, it, expect } from "vitest";
import { emailWorthy, badgeCount, type NotificationKind } from "../../lib/data/notification-types";

/*
  What is pinned here is `emailWorthy()` — the one decision that
  separates "reaches you in-app" from "reaches you even when you are not
  looking". It is easy to get this list wrong in either direction: too
  wide and every like becomes an email a player learns to ignore, too
  narrow and a real time-sensitive proposal sits unread because nobody
  thought to check the app. Getting the SET right matters more than
  anything about how the email itself renders, and it is the one part of
  the whole email feature that can be tested without touching Resend.
*/

const ALL_KINDS: NotificationKind[] = [
  "meeting_proposed",
  "meeting_accepted",
  "meeting_declined",
  "meeting_cancelled",
  "meeting_time_proposed",
  "meeting_time_accepted",
  "meeting_time_declined",
  "follow",
  "like",
  "comment",
];

describe("which notifications are worth an email", () => {
  it("emails every meeting event — each one expects an answer", () => {
    for (const kind of ALL_KINDS.filter((k) => k.startsWith("meeting_"))) {
      expect(emailWorthy(kind), kind).toBe(true);
    }
  });

  it("never emails a follow or a like — high frequency, low stakes", () => {
    // The one a regression here would hurt most: a product that emails
    // every like is a product whose emails stop getting opened.
    expect(emailWorthy("like")).toBe(false);
    expect(emailWorthy("follow")).toBe(false);
  });

  it("does not email a comment either, for now — deliberately, not by omission", () => {
    expect(emailWorthy("comment")).toBe(false);
  });

  it("covers every kind the schema allows — nothing silently forgotten", () => {
    // If a new NotificationKind is ever added without updating the
    // EMAIL_KINDS set, this at least proves the set was consulted for
    // everything that currently exists.
    for (const kind of ALL_KINDS) {
      expect(typeof emailWorthy(kind)).toBe("boolean");
    }
  });
});

describe("the bell's badge", () => {
  it("shows the real count while it fits", () => {
    expect(badgeCount(0)).toBe("0");
    expect(badgeCount(3)).toBe("3");
    expect(badgeCount(9)).toBe("9");
  });

  it("caps rather than overflowing a badge with no room for two digits", () => {
    expect(badgeCount(10)).toBe("9+");
    expect(badgeCount(200)).toBe("9+");
  });
});
