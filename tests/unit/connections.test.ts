import { describe, it, expect } from "vitest";
import {
  SHARE_SCOPES,
  LINK_KINDS,
  scopeMeta,
  generateCode,
  normaliseCode,
  daysLeft,
  inviteIsUsable,
} from "../../lib/data/connection-types";

/*
  Connections are the one place where a mistake leaks somebody's data, so the
  rules are pinned here: what each scope opens, and when a code stops working.
*/

describe("sharing scopes", () => {
  it("widens strictly — every level names the one before it and adds to it", () => {
    const [identity, development, full] = SHARE_SCOPES;
    expect(SHARE_SCOPES.map((s) => s.value)).toEqual(["identity", "development", "full"]);
    // Each level starts by inheriting the previous, then lists what it adds.
    expect(development.opens[0]).toContain("identity");
    expect(full.opens[0]).toContain("development");
    expect(identity.opens.length).toBeGreaterThan(0);
    expect(development.opens.length).toBeGreaterThan(1);
    expect(full.opens.length).toBeGreaterThan(1);
  });

  it("only mentions check-ins at the full level", () => {
    const mentions = SHARE_SCOPES.filter((s) =>
      s.opens.some((o) => /check-in/i.test(o)) || /check-in/i.test(s.summary),
    );
    expect(mentions.map((s) => s.value)).toEqual(["full"]);
  });

  it("never promises study history at any level", () => {
    for (const s of SHARE_SCOPES) {
      const text = [s.summary, ...s.opens].join(" ").toLowerCase();
      expect(text, s.value).not.toContain("study");
      expect(text, s.value).not.toContain("studies");
    }
  });

  it("falls back to the narrowest scope for anything unknown", () => {
    expect(scopeMeta("identity").value).toBe("identity");
    expect(scopeMeta("nonsense" as never).value).toBe("identity");
  });

  it("describes all three link kinds", () => {
    expect(Object.keys(LINK_KINDS).sort()).toEqual([
      "club-staff",
      "coach-player",
      "trainer-athlete",
    ]);
  });
});

describe("invite codes", () => {
  it("is readable aloud: no characters that are confused when spoken or typed", () => {
    // 200 codes is enough to hit every alphabet position many times over.
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(code).not.toMatch(/[O0I1]/);
    }
  });

  it("produces different codes", () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateCode()));
    expect(codes.size).toBeGreaterThan(95);
  });

  it("normalises what a user types", () => {
    expect(normaliseCode("  abcd-2345 ")).toBe("ABCD-2345");
  });
});

describe("invite expiry", () => {
  const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString();

  it("counts the days left, floored at zero", () => {
    expect(daysLeft(inDays(5))).toBeGreaterThanOrEqual(5);
    expect(daysLeft(inDays(-3))).toBe(0);
  });

  it("treats an expired or closed invite as unusable", () => {
    expect(inviteIsUsable({ status: "open", expiresAt: inDays(3) })).toBe(true);
    expect(inviteIsUsable({ status: "open", expiresAt: inDays(-1) })).toBe(false);
    expect(inviteIsUsable({ status: "accepted", expiresAt: inDays(3) })).toBe(false);
    expect(inviteIsUsable({ status: "revoked", expiresAt: inDays(3) })).toBe(false);
  });
});
