import { describe, it, expect } from "vitest";
import {
  DEFAULT_EXPIRY_DAYS,
  EXPIRY_CHOICES,
  MAX_EXPIRY_DAYS,
  SHARE_KINDS,
  clampExpiryDays,
  expiryLabel,
  isServable,
  shareDisclosure,
  shareKindLabel,
  shareState,
  shareUrl,
} from "../../lib/reports/share-types";
import { REPORT_FIELDS } from "../../lib/reports/fields";

/*
  A share link is the only object in MIDO XI a stranger can open, and the token
  is the only credential. Everything asserted here is about restraint rather
  than capability:

    · nothing lives forever
    · absent, expired and revoked are indistinguishable to a reader
    · the player is told in words what a stranger will see, before it exists

  The last one matters most. "Field-level privacy control" means nothing to
  somebody about to send their kid's development report to a trial coach.
*/

const share = (over: Partial<{ expiresAt: string; revokedAt: string | null }> = {}) => ({
  expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  revokedAt: null,
  ...over,
});

describe("nothing lives forever", () => {
  it("has no permanent option", () => {
    // A recruitment CV that stays open is a permanent public record of a
    // fifteen-year-old, and "I'll revoke it later" is not a thing anyone does.
    expect(EXPIRY_CHOICES.length).toBeGreaterThan(0);
    for (const c of EXPIRY_CHOICES) {
      expect(c.days, c.label).toBeGreaterThan(0);
      expect(c.days, c.label).toBeLessThanOrEqual(MAX_EXPIRY_DAYS);
    }
  });

  it("caps anything longer than the ceiling", () => {
    expect(clampExpiryDays(365)).toBe(MAX_EXPIRY_DAYS);
    expect(clampExpiryDays(91)).toBe(MAX_EXPIRY_DAYS);
    expect(clampExpiryDays(MAX_EXPIRY_DAYS)).toBe(MAX_EXPIRY_DAYS);
  });

  it("refuses zero, negative and nonsense rather than making them permanent", () => {
    // The dangerous failure: 0 or NaN meaning "no expiry".
    for (const bad of [0, -1, -9999, NaN, Infinity]) {
      expect(clampExpiryDays(bad), String(bad)).toBe(DEFAULT_EXPIRY_DAYS);
    }
  });

  it("defaults to the shortest sensible window", () => {
    expect(DEFAULT_EXPIRY_DAYS).toBeLessThanOrEqual(7);
    expect(EXPIRY_CHOICES.some((c) => c.days === DEFAULT_EXPIRY_DAYS)).toBe(true);
  });
});

describe("when a link stops working", () => {
  it("serves a live one", () => {
    expect(isServable(share())).toBe(true);
    expect(shareState(share())).toBe("live");
  });

  it("stops the moment it expires", () => {
    const past = share({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(isServable(past)).toBe(false);
    expect(shareState(past)).toBe("expired");
  });

  it("treats the exact expiry instant as over", () => {
    const now = new Date();
    expect(isServable(share({ expiresAt: now.toISOString() }), now)).toBe(false);
  });

  it("stops immediately when withdrawn, whatever the expiry says", () => {
    const revoked = share({ revokedAt: new Date().toISOString() });
    expect(isServable(revoked)).toBe(false);
    expect(shareState(revoked)).toBe("revoked");
  });

  it("puts withdrawal ahead of expiry in what it reports", () => {
    // Both true at once: the player withdrew it, which is the fact they care
    // about seeing in the list.
    const both = share({
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      revokedAt: new Date().toISOString(),
    });
    expect(shareState(both)).toBe("revoked");
  });
});

describe("what the player is told", () => {
  it("counts down in days", () => {
    expect(expiryLabel(share({ expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString() })))
      .toMatch(/3 days/);
  });

  it("says today rather than 'in 1 days'", () => {
    expect(expiryLabel(share({ expiresAt: new Date(Date.now() + 3600_000).toISOString() })))
      .toBe("Expires today");
  });

  it("names the two dead states plainly", () => {
    expect(expiryLabel(share({ revokedAt: new Date().toISOString() }))).toBe("Revoked");
    expect(expiryLabel(share({ expiresAt: new Date(Date.now() - 1).toISOString() }))).toBe("Expired");
  });
});

describe("the disclosure, before the link exists", () => {
  it("promises nothing personal when nothing personal is ticked", () => {
    const sentence = shareDisclosure(["matchLog", "filmObservations"], []);
    expect(sentence).toMatch(/nothing personal/i);
    expect(sentence).toMatch(/date of birth/i);
  });

  it("names what is personal, in words rather than field ids", () => {
    const sentence = shareDisclosure(["dateOfBirth", "contact"], ["Date of birth", "Contact email"]);
    expect(sentence).toMatch(/date of birth/i);
    expect(sentence).toMatch(/contact email/i);
    // And says the quiet part: a link is not a person.
    expect(sentence).toMatch(/anyone with the link/i);
  });

  it("has a label for every sensitive field it might have to name", () => {
    for (const f of REPORT_FIELDS.filter((f) => f.sensitive)) {
      expect(shareDisclosure([f.id], [f.label]), f.id).toContain(f.label.toLowerCase());
    }
  });
});

describe("the link itself", () => {
  it("is built without a double slash however the origin is written", () => {
    expect(shareUrl("https://mido-xi.vercel.app", "abc")).toBe("https://mido-xi.vercel.app/r/abc");
    expect(shareUrl("https://mido-xi.vercel.app/", "abc")).toBe("https://mido-xi.vercel.app/r/abc");
  });

  it("names every kind it can carry", () => {
    for (const k of SHARE_KINDS) {
      expect(shareKindLabel(k.kind), k.kind).toBe(k.label);
    }
    expect(shareKindLabel("nonsense" as never)).toBe("Report");
  });
});
