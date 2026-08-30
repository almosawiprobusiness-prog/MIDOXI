import { concept as conceptBySlug } from "@/lib/knowledge/concepts";

/*
  PATTERN ARITHMETIC — repetition across film, counted, never vibed.

  A single observation is a moment; the same concept surfacing across
  videos is development evidence. This module is the counting: how many
  times, across how many videos, how recently. It is pure arithmetic
  over stored observation rows — no model call, no invented
  statistics, and the UI copy around it says "development evidence",
  never significance.

  The match focus falls out of the same arithmetic: the most-repeated
  pattern, phrased through the CURATED concept's own coaching cue — one
  cue, maybe two, never fourteen. When nothing repeats, there is no
  focus, and silence is the honest output.
*/

export interface PatternInput {
  concept?: string;
  videoId: string;
  /** ISO date (YYYY-MM-DD) the observation's analysis was saved. */
  on: string;
}

export interface ConceptPattern {
  concept: string;
  /** Curated display name, when the slug is in the graph. */
  name: string;
  count: number;
  videos: number;
  lastDaysAgo: number;
}

function daysAgo(isoDate: string, now: Date): number {
  const then = new Date(`${isoDate}T00:00:00Z`);
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}

/** A pattern needs at least this many sightings to be called one. */
export const PATTERN_MIN_COUNT = 2;

export function detectPatterns(rows: PatternInput[], now: Date = new Date()): ConceptPattern[] {
  const byConcept = new Map<string, { count: number; videos: Set<string>; last: number }>();
  for (const r of rows) {
    if (!r.concept) continue;
    const entry = byConcept.get(r.concept) ?? { count: 0, videos: new Set<string>(), last: Infinity };
    entry.count += 1;
    entry.videos.add(r.videoId);
    entry.last = Math.min(entry.last, daysAgo(r.on, now));
    byConcept.set(r.concept, entry);
  }

  return [...byConcept.entries()]
    .filter(([, e]) => e.count >= PATTERN_MIN_COUNT)
    .map(([slug, e]) => ({
      concept: slug,
      name: conceptBySlug(slug)?.name ?? slug.replace(/-/g, " "),
      count: e.count,
      videos: e.videos.size,
      lastDaysAgo: e.last === Infinity ? 0 : e.last,
    }))
    .sort((a, b) => b.count - a.count || a.lastDaysAgo - b.lastDaysAgo);
}

/** The honest evidence line under a pattern. Counts, not claims. */
export function patternEvidenceLine(p: ConceptPattern): string {
  const where = p.videos === 1 ? "in one video" : `across ${p.videos} videos`;
  const when = p.lastDaysAgo === 0 ? "today" : `${p.lastDaysAgo} day(s) ago`;
  return `Observed ${p.count} times ${where}, most recently ${when}.`;
}

export interface MatchFocus {
  /** One cue, maybe two. The cap is the product. */
  cues: string[];
  because: string;
  concept: string;
}

/**
 * The next match's focus, derived from the leading pattern. The cue is
 * the CURATED concept's own first coaching cue — written by a person,
 * about football, not generated. No repeated pattern, no curated cue →
 * null, and the surface shows nothing rather than something invented.
 */
export function composeMatchFocus(patterns: ConceptPattern[]): MatchFocus | null {
  for (const p of patterns) {
    const c = conceptBySlug(p.concept);
    if (!c?.cues?.length) continue;
    return {
      cues: c.cues.slice(0, 2).map((cue) => cue.trim()),
      because: `Your film showed ${c.name.toLowerCase()} ${p.count} times${p.videos > 1 ? ` across ${p.videos} videos` : ""}.`,
      concept: p.concept,
    };
  }
  return null;
}
