/*
  Client-safe helpers for the club and league typeahead.

  `slugifyName` has to agree exactly with the SQL in migration 0019, because
  the browser uses it to decide what to search for and Postgres uses it to
  decide what to store. If the two ever disagree, a player types their club's
  name, sees no match, creates a duplicate row — and the shared list quietly
  fills with near-identical entries. `tests/unit/clubs.test.ts` pins the pairs
  that would drift first.

  The SQL is:
      lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'))
      then trim(both '-')
*/

/** Fold a club or league name to its matching key. Mirrors migration 0019. */
export function slugifyName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Shortest string worth searching on. Below this every list is the whole list. */
export const MIN_CLUB_QUERY = 2;

/**
 * Is what the player typed already in the list, or are they naming something
 * new? Used to say "we'll add it" rather than silently creating a row.
 */
export function isNewName(typed: string, options: { name: string }[]): boolean {
  const slug = slugifyName(typed);
  if (slug.length < MIN_CLUB_QUERY) return false;
  return !options.some((o) => slugifyName(o.name) === slug);
}

/**
 * A Transfermarkt profile URL, or null.
 *
 * Deliberately narrow. The field exists so a coach reading a report can follow
 * a link, and a text box that accepts anything is a text box people paste
 * their whole clipboard into. Nothing in MIDO reads football facts from this —
 * Transfermarkt has no public API and scraping it is against their terms.
 */
export function normaliseTransfermarkt(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (!/(^|\.)transfermarkt\.[a-z.]{2,10}$/i.test(url.hostname)) return null;
  url.hash = "";
  url.search = "";
  return url.toString();
}

export function transfermarktIssue(value: string): string | null {
  if (!value.trim()) return null;
  return normaliseTransfermarkt(value)
    ? null
    : "That does not look like a Transfermarkt profile link. Paste the address from your profile page, or leave it empty.";
}

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Stored square. Big enough for a report header at print resolution. */
export const AVATAR_PX = 512;

export function avatarIssue(file: { type: string; size: number }): string | null {
  if (!AVATAR_TYPES.includes(file.type)) {
    return "Use a JPEG, PNG or WebP.";
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB. Keep it under ${AVATAR_MAX_BYTES / 1024 / 1024}MB.`;
  }
  return null;
}
