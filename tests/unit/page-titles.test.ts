import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/*
  Every route names itself.

  This exists because a sweep of the whole app found the same fault
  eleven times, in eleven places nobody had connected: a page with no
  title of its own, inheriting the root layout's "MIDO XI — Football
  Performance OS". The home screen had it. The match detail page had it.
  Three separate report pages had a title that was set but said the same
  thing for every row — "Profile", "Post", "Session", "Development
  report" — which is the same fault wearing a hat.

  It is not a cosmetic problem. The moment a title matters is the moment
  somebody has four tabs open, which is exactly when they are comparing
  two matches, or reading three players, or exporting a report — and a
  report's tab title is what the browser suggests as the PDF filename.

  Fixing eleven pages by hand is a morning's work that lasts until the
  next page is written. This is the part that lasts.

  WHAT THIS CANNOT CHECK. The same sweep found two pages with no <h1> at
  all, and that fault is invisible from here: headings come from shared
  components several layers deep, so reading page files for "<h1" flags
  33 of 65 pages, nearly all of them wrongly. A heading rule needs
  rendering, not parsing. Better no rule than a rule that cries wolf
  thirty times.
*/

const APP = join(fileURLToPath(new URL("../../", import.meta.url)), "app");

function pageFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) pageFiles(p, found);
    else if (entry.name === "page.tsx") found.push(p);
  }
  return found;
}

/** Route files, as repo-relative POSIX paths so failures are readable. */
const pages = pageFiles(APP)
  .map((p) => relative(join(APP, ".."), p).split(sep).join("/"))
  .sort();

const source = new Map(pages.map((p) => [p, readFileSync(join(APP, "..", p), "utf8")]));

const hasGenerate = (s: string) => /export\s+async\s+function\s+generateMetadata/.test(s);
const hasStatic = (s: string) => /export\s+const\s+metadata\b/.test(s);
/** A page that only sends you somewhere else renders nothing to title. */
const isRedirect = (s: string) => /\bredirect\s*\(/.test(s);
/** Next's own convention: a path segment in brackets is a parameter. */
const isDynamic = (p: string) => /\[[^\]]+\]/.test(p);

/*
  Routes allowed a fixed title on a dynamic path. Each needs a REASON,
  not just an entry — an exemption list without them becomes the place
  bugs go to be forgotten.
*/
const FIXED_TITLE_ALLOWED: Record<string, string> = {
  "app/r/[token]/page.tsx":
    "A shared report opened by a stranger holding a link. Absent, expired and " +
    "revoked all render identically so that nobody can learn a token was ever " +
    "real; naming the report in the tab would leak its subject to exactly the " +
    "person the page is written to tell nothing, and put it in their history.",

  "app/d/[token]/page.tsx":
    "A delivered deliverable opened by a client holding a link. Same reasoning " +
    "as the shared report above: the tab title would put the club's name and " +
    "the document's title into browser history and onto any screen the reader " +
    "shares, and a token that names its contents is no longer only a token.",
};

describe("every route names itself", () => {
  it("finds the app directory", () => {
    // If this ever reads zero, every assertion below passes vacuously.
    expect(pages.length).toBeGreaterThan(30);
  });

  it("gives every page a title of its own", () => {
    const missing = pages.filter((p) => {
      const s = source.get(p)!;
      if (isRedirect(s)) return false;
      return !hasGenerate(s) && !hasStatic(s);
    });

    expect(
      missing,
      missing.length
        ? `These pages inherit the root layout's title, so their tab reads ` +
          `"MIDO XI — Football Performance OS":\n  ${missing.join("\n  ")}\n` +
          `Add \`export const metadata\`, or \`generateMetadata\` if the title ` +
          `depends on the route's parameter.`
        : undefined,
    ).toEqual([]);
  });

  it("makes a page whose content varies name itself from that content", () => {
    /*
      The subtler half. `export const metadata = { title: "Profile" }`
      on /community/[handle] is a title that is SET and still wrong: it
      reads the same for every player in the app. Every one of these
      found in the sweep was that shape.
    */
    const fixed = pages.filter((p) => {
      const s = source.get(p)!;
      if (isRedirect(s) || FIXED_TITLE_ALLOWED[p]) return false;
      return isDynamic(p) && hasStatic(s) && !hasGenerate(s);
    });

    expect(
      fixed,
      fixed.length
        ? `These routes take a parameter but hard-code one title, so every ` +
          `row shares a tab name:\n  ${fixed.join("\n  ")}\n` +
          `Use \`generateMetadata\` and name the page after what it is ` +
          `showing — or add it to FIXED_TITLE_ALLOWED with the reason.`
        : undefined,
    ).toEqual([]);
  });

  it("keeps the exemption list honest", () => {
    // An exemption for a route that no longer exists is a stale claim,
    // and the next person to read it has to work out whether it matters.
    const stale = Object.keys(FIXED_TITLE_ALLOWED).filter((p) => !source.has(p));
    expect(stale, `Exempted routes that no longer exist: ${stale.join(", ")}`).toEqual([]);

    for (const [route, reason] of Object.entries(FIXED_TITLE_ALLOWED)) {
      expect(reason.length, `${route} is exempt without a real reason`).toBeGreaterThan(40);
    }
  });
});
