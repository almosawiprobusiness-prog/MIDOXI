import { describe, it, expect } from "vitest";
import {
  AVATAR_MAX_BYTES,
  MIN_CLUB_QUERY,
  avatarIssue,
  isNewName,
  normaliseTransfermarkt,
  slugifyName,
  transfermarktIssue,
} from "../../lib/data/clubs-types";

/*
  The club list is built from what players type, which makes the folding rule
  the whole design. `slugifyName` here and the `regexp_replace` in migration
  0019 must agree exactly — if they ever diverge, a player types a club that IS
  in the list, sees no match, and creates a near-duplicate row that then appears
  in everyone else's dropdown. The list degrades quietly and nothing errors.

  The SQL is:
      lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'))
      then trim(both '-')
*/
describe("folding a club name", () => {
  it("matches what the database will store", () => {
    // Each pair is a case the SQL and the TypeScript could plausibly disagree
    // on. Change one side and this file should fail.
    const pairs: [string, string][] = [
      ["Sarisbury Spartans FC", "sarisbury-spartans-fc"],
      ["  Northgate FC  ", "northgate-fc"],
      ["St. Mary's", "st-mary-s"],
      ["FC Köln", "fc-k-ln"], // non-ASCII becomes a separator, in both
      ["A.F.C. Wimbledon", "a-f-c-wimbledon"],
      ["Real Madrid C.F.", "real-madrid-c-f"],
      ["1874 Northwich", "1874-northwich"],
      ["---weird---", "weird"],
      ["Hampshire Sunday League Div 3", "hampshire-sunday-league-div-3"],
    ];
    for (const [input, expected] of pairs) {
      expect(slugifyName(input), input).toBe(expected);
    }
  });

  it("folds case and spacing together", () => {
    expect(slugifyName("Halton Town")).toBe(slugifyName("  HALTON   TOWN  "));
    expect(slugifyName("Northgate FC")).toBe(slugifyName("northgate fc"));
  });

  it("does NOT collapse punctuation variants — a known, accepted limitation", () => {
    /*
      "Northgate FC" and "Northgate F.C." fold differently, so both can end up
      in the list. That is deliberate rather than overlooked: collapsing them
      would mean encoding club-name abbreviation rules in two places (here and
      the SQL) and getting them to agree forever.

      It is tolerable because of how the field is used. A player typing
      "northgate f" is already being shown "Northgate FC" and clicks it, and
      the `uses` counter ranks the spelling most people picked to the top — so
      a variant that does slip in sinks out of sight rather than competing.

      If duplicates ever become a real problem in the data, the fix is a
      cleanup pass over `clubs`, not a cleverer fold.
    */
    expect(slugifyName("Northgate FC")).not.toBe(slugifyName("Northgate F.C."));
  });

  it("returns empty for something with nothing in it", () => {
    expect(slugifyName("   ")).toBe("");
    expect(slugifyName("!!!")).toBe("");
  });
});

describe("telling a player they are the first", () => {
  const options = [{ name: "Northgate FC" }, { name: "Halton Town" }];

  it("recognises a club already in the list, whatever the case and spacing", () => {
    expect(isNewName("NORTHGATE FC", options)).toBe(false);
    expect(isNewName("  northgate   fc  ", options)).toBe(false);
  });

  it("spots a genuinely new one", () => {
    expect(isNewName("Sarisbury Spartans", options)).toBe(true);
  });

  it("says nothing until there is enough typed to mean anything", () => {
    expect(isNewName("N", options)).toBe(false);
    expect(isNewName("", options)).toBe(false);
    expect(MIN_CLUB_QUERY).toBeGreaterThan(1);
  });
});

/*
  The Transfermarkt field is a link a coach can follow and nothing else. MIDO
  reads no football facts from it — there is no public API and scraping is
  against their terms — so the only job here is to refuse things that are not
  a Transfermarkt link rather than store a broken one and render it later.
*/
describe("the Transfermarkt link", () => {
  it("accepts a real profile URL and keeps it", () => {
    const url = normaliseTransfermarkt("https://www.transfermarkt.com/erling-haaland/profil/spieler/418560");
    expect(url).toContain("transfermarkt.com");
    expect(url).toContain("418560");
  });

  it("accepts the country domains", () => {
    for (const host of ["transfermarkt.co.uk", "www.transfermarkt.de", "transfermarkt.us"]) {
      expect(normaliseTransfermarkt(`https://${host}/x/profil/spieler/1`), host).not.toBeNull();
    }
  });

  it("adds a scheme, because nobody types one", () => {
    expect(normaliseTransfermarkt("www.transfermarkt.com/x/profil/spieler/1")).toMatch(/^https:\/\//);
  });

  it("drops the query and fragment", () => {
    const url = normaliseTransfermarkt("https://www.transfermarkt.com/x/profil/spieler/1?saison=2024#top");
    expect(url).not.toContain("?");
    expect(url).not.toContain("#");
  });

  it("refuses a look-alike domain", () => {
    // transfermarkt.com.evil.example is not Transfermarkt.
    expect(normaliseTransfermarkt("https://transfermarkt.com.evil.example/x")).toBeNull();
    expect(normaliseTransfermarkt("https://nottransfermarkt.com/x")).toBeNull();
  });

  it("refuses anything that is not a link at all", () => {
    expect(normaliseTransfermarkt("my profile")).toBeNull();
    expect(normaliseTransfermarkt("https://instagram.com/me")).toBeNull();
  });

  it("treats empty as fine, because the field is optional", () => {
    expect(normaliseTransfermarkt("")).toBeNull();
    expect(transfermarktIssue("")).toBeNull();
    expect(transfermarktIssue("   ")).toBeNull();
  });

  it("explains itself when it refuses", () => {
    const issue = transfermarktIssue("https://instagram.com/me");
    expect(issue).toBeTruthy();
    expect(issue).toMatch(/leave it empty/i);
  });
});

describe("the avatar", () => {
  it("takes the formats a phone actually produces", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(avatarIssue({ type, size: 500_000 }), type).toBeNull();
    }
  });

  it("refuses a format the bucket would reject anyway", () => {
    // Caught here so the person hears it before the upload, not after.
    expect(avatarIssue({ type: "image/heic", size: 500_000 })).toMatch(/JPEG, PNG or WebP/);
    expect(avatarIssue({ type: "application/pdf", size: 500 })).toBeTruthy();
  });

  it("refuses something too big, and says how big it was", () => {
    const issue = avatarIssue({ type: "image/jpeg", size: AVATAR_MAX_BYTES + 1 });
    expect(issue).toMatch(/MB/);
  });

  it("allows exactly the limit", () => {
    expect(avatarIssue({ type: "image/jpeg", size: AVATAR_MAX_BYTES })).toBeNull();
  });
});
