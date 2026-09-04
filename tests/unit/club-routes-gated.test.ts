import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROLES, ROLE_IDS, type RoleId } from "../../lib/roles/roles";

/*
  Every page that belongs only to Club OS must gate on the club role.

  This reads the navigation itself rather than a hand-kept list, so adding a
  club page without a guard fails here instead of shipping. That is the whole
  point: the hole this closes existed because `session.ts` said "every
  role-scoped page reads availableRoles" and nothing enforced it.

  Shared destinations are excluded automatically — a route that also appears
  in another role's navigation is not club-only, so /app, Study, Calendar,
  Meetings and Community fall out without being named.
*/

const ROOT = join(__dirname, "..", "..");

/** Hrefs in this role's nav that appear in no other role's. */
function exclusiveTo(role: RoleId): string[] {
  const others = new Set(
    ROLE_IDS.filter((r) => r !== role).flatMap((r) => ROLES[r].nav.map((n) => n.href)),
  );
  return [...new Set(ROLES[role].nav.map((n) => n.href))].filter((h) => !others.has(h));
}

/** app/app/<segment>/page.tsx for an /app/... href. */
function pageFile(href: string): string {
  const rest = href.replace(/^\/app\/?/, "");
  return join(ROOT, "app", "app", ...rest.split("/").filter(Boolean), "page.tsx");
}

describe("club-only routes", () => {
  const hrefs = exclusiveTo("club");

  it("there are some, or this test is asserting nothing", () => {
    expect(hrefs.length).toBeGreaterThan(0);
  });

  it.each(hrefs)("%s exists as a page", (href) => {
    expect(existsSync(pageFile(href)), pageFile(href)).toBe(true);
  });

  /*
    The gate. Without it the page is reachable by typing its URL, which is how
    a self-serve subscriber could open Club OS without paying for it.
  */
  it.each(hrefs)("%s requires the club role", (href) => {
    const src = readFileSync(pageFile(href), "utf8");
    expect(src, `${href} is club-only but never calls requireRole("club")`).toContain(
      'requireRole("club")',
    );
  });

  /*
    Not a gate, but the other half of the fix: a page belonging to one system
    should say so when opened from another, rather than appearing in a shell
    whose menu does not contain it.
  */
  it.each(hrefs)("%s tells you which system it belongs to", (href) => {
    const src = readFileSync(pageFile(href), "utf8");
    expect(src, `${href} should render <OsNotice> when viewed from another OS`).toContain(
      "OsNotice",
    );
  });

  it("does not gate the shared root, which every role opens", () => {
    expect(hrefs).not.toContain("/app");
    const root = readFileSync(join(ROOT, "app", "app", "page.tsx"), "utf8");
    expect(root).not.toContain('requireRole("club")');
  });
});
