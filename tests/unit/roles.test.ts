import { describe, it, expect } from "vitest";
import {
  ROLES,
  ROLE_IDS,
  ACCOUNT_NAV,
  navForRole,
  primaryNav,
  moreNav,
  sectionTitleFor,
  roleDef,
} from "../../lib/roles/roles";

/*
  The navigation is the product's first impression, and it drifts easily. These
  pin the shape a simplification pass was done to achieve: a short primary list
  of football work, the rest reachable, and account admin out of the way.
*/

describe("navigation shape", () => {
  it("keeps every role to six or fewer primary items", () => {
    for (const id of ROLE_IDS) {
      const primary = primaryNav(id);
      expect(primary.length, `${id} primary`).toBeGreaterThanOrEqual(4);
      expect(primary.length, `${id} primary`).toBeLessThanOrEqual(6);
    }
  });

  it("starts every role at its own home", () => {
    for (const id of ROLE_IDS) {
      const first = primaryNav(id)[0];
      expect(first.href, id).toBe("/app");
      expect(first.label, id).toBe(roleDef(id).terminology.home);
    }
  });

  it("keeps account admin out of the navigation entirely", () => {
    const accountHrefs = ACCOUNT_NAV.map((a) => a.href);
    for (const id of ROLE_IDS) {
      for (const item of navForRole(id)) {
        expect(accountHrefs, `${id} nav`).not.toContain(item.href);
      }
    }
  });

  it("puts every nav item in exactly one group", () => {
    for (const id of ROLE_IDS) {
      const nav = navForRole(id);
      expect(primaryNav(id).length + moreNav(id).length).toBe(nav.length);
      expect(new Set(nav.map((n) => n.href)).size).toBe(nav.length);
    }
  });

  it("gives every role the Study Engine as primary work", () => {
    for (const id of ROLE_IDS) {
      expect(primaryNav(id).map((n) => n.href), id).toContain("/app/study");
    }
  });
});

describe("section titles", () => {
  it("names the current section for nav and account routes alike", () => {
    expect(sectionTitleFor("player", "/app")).toBe("The Locker");
    expect(sectionTitleFor("coach", "/app")).toBe("Touchline");
    expect(sectionTitleFor("player", "/app/matches/abc")).toBe("Matches");
    expect(sectionTitleFor("player", "/app/settings")).toBe("Settings");
    expect(sectionTitleFor("player", "/app/connections")).toBe("Connections");
  });

  it("falls back to the product name for anything unknown", () => {
    expect(sectionTitleFor("player", "/app/nowhere")).toBe("MIDO XI");
  });
});

describe("role registry", () => {
  it("describes all four operating systems", () => {
    expect(Object.keys(ROLES).sort()).toEqual(["club", "coach", "player", "trainer"]);
    for (const id of ROLE_IDS) {
      const def = roleDef(id);
      expect(def.question.length, id).toBeGreaterThan(20);
      expect(def.aiOpeners.length, id).toBeGreaterThanOrEqual(3);
      expect(def.quickActions.length, id).toBe(3);
    }
  });
});
