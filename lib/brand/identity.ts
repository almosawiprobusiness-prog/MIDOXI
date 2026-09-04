/*
  Club identity — whose work this looks like.

  A Managed deliverable goes out in the client's colours, not ours. That is
  most of what the tier is selling: a coach hands their chairman a document
  that looks like it came from the club, because it did.

  Pure and client-safe. No database, no server — the settings form validates
  with it and the renderer composes with it, from one definition, which is the
  same split `pitch-identity.ts` uses.

  THE PROBLEM THIS FILE EXISTS TO SOLVE. A club's real colour is whatever it
  is, and plenty of real ones — navy, maroon, forest — are close to unreadable
  on MIDO's ink ground. The naive answers are both wrong: rejecting the colour
  tells a club its identity is invalid, and using it raw ships a document
  nobody can read. So the colour is kept exactly as given for fills, and a
  *legible variant* is derived for anything that has to be read. The club still
  gets navy. The text is still readable. `lib/publish/palette.ts` learned the
  same lesson about published cards.
*/

/** The ground everything here is read against — `--ink-950`. */
export const INK = "#08090b";

/** MIDO's own accent, used when a client has set no colour of their own. */
export const MIDO_SIGNAL = "#7b61ff";

export interface ClubBrand {
  /** Full legal-ish name, for the document header. */
  name: string;
  /** Short form for tight spaces. Falls back to `name`. */
  shortName: string;
  crestUrl: string | null;
  /** The club's colour, exactly as they gave it. Fills, rules, crest backing. */
  primary: string;
  /** The same colour, guaranteed readable on ink. Text, links, labels. */
  primaryReadable: string;
  /** True when this is MIDO's own identity rather than a client's. */
  isDefault: boolean;
}

// ── hex ──────────────────────────────────────────────────────

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `#abc` and `abcdef` both normalise to `#aabbcc` / `#abcdef`. Null if unusable. */
export function normalizeHex(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = HEX.exec(v.trim());
  if (!m) return null;
  const h = m[1].toLowerCase();
  return `#${h.length === 3 ? h.split("").map((c) => c + c).join("") : h}`;
}

/** A message for the settings form, or null when the value is fine. */
export function hexIssue(v: string): string | null {
  if (!v.trim()) return null;
  if (!normalizeHex(v)) return "Use a hex colour, like #1B3A6B.";
  return null;
}

// ── contrast ─────────────────────────────────────────────────

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance. Input must already be normalised. */
export function luminance(hex: string): number {
  const h = hex.slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Below this, body-sized text is not reliably readable (WCAG AA). */
export const MIN_CONTRAST = 4.5;

function mixToward(hex: string, target: string, amount: number): string {
  const h = hex.slice(1);
  const t = target.slice(1);
  const out = [0, 2, 4].map((i) => {
    const from = parseInt(h.slice(i, i + 2), 16);
    const to = parseInt(t.slice(i, i + 2), 16);
    return Math.round(from + (to - from) * amount)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${out.join("")}`;
}

/**
 * The same colour, lightened only as far as it has to be to be read on `on`.
 *
 * Steps toward white in small increments and stops the moment it clears the
 * threshold, so a colour that is already readable is returned untouched and a
 * dark one keeps as much of its character as legibility allows. Navy stays
 * recognisably navy; it does not become lilac.
 */
export function readableOn(hex: string, on: string = INK): string {
  if (contrast(hex, on) >= MIN_CONTRAST) return hex;
  for (let step = 1; step <= 20; step++) {
    const candidate = mixToward(hex, "#ffffff", step * 0.05);
    if (contrast(candidate, on) >= MIN_CONTRAST) return candidate;
  }
  return "#ffffff";
}

// ── composing ────────────────────────────────────────────────

export interface BrandSource {
  name?: string | null;
  shortName?: string | null;
  crestUrl?: string | null;
  primary?: string | null;
}

/** MIDO's own identity — what an unbranded deliverable wears. */
export const MIDO_BRAND: ClubBrand = {
  name: "MIDO XI",
  shortName: "MIDO XI",
  crestUrl: null,
  primary: MIDO_SIGNAL,
  primaryReadable: readableOn(MIDO_SIGNAL),
  isDefault: true,
};

/**
 * A club's identity, or MIDO's when they have not set one.
 *
 * Never throws and never returns a half-brand: a document has to render even
 * when the client has filled in nothing, and a header that says "MIDO XI" is
 * honest, where one that says nothing is broken.
 */
export function toBrand(src: BrandSource | null | undefined): ClubBrand {
  const name = src?.name?.trim();
  if (!name) return MIDO_BRAND;

  const primary = normalizeHex(src?.primary) ?? MIDO_SIGNAL;
  return {
    name,
    shortName: src?.shortName?.trim() || name,
    crestUrl: src?.crestUrl?.trim() || null,
    primary,
    primaryReadable: readableOn(primary),
    isDefault: false,
  };
}

/**
 * Who a document says it came from.
 *
 * A Managed deliverable is the club's document, so the club's name leads. What
 * it must never do is hide that MIDO made it — `byline` is the small print
 * that keeps the arrangement truthful, and the caller is expected to render
 * it. Passing off generated work as a club's own authorship is the one thing
 * this file will not help with.
 */
export function attribution(brand: ClubBrand): { title: string; byline: string } {
  if (brand.isDefault) return { title: brand.name, byline: "Prepared in MIDO XI" };
  return { title: brand.name, byline: `Prepared for ${brand.name} in MIDO XI` };
}
