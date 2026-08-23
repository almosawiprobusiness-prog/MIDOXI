/*
  Searching the user's own football memory. Pure and client-safe.

  This module used to build its index at module scope from `lib/seed` — so the
  "Your football memory" section of the command bar returned a fictional
  player's matches, clips and goals to every real account. Same class of bug as
  the Performance and Recovery pages: seed data with no branch, presented as the
  user's own.

  The index is now built server-side per user (`lib/data/search-index.ts`) and
  handed in. This file does the ranking and nothing else, which is why it can
  still run in the client component that needs it.
*/

export type SearchType = "match" | "clip" | "goal" | "focus";

export interface SearchEntry {
  id: string;
  type: SearchType;
  title: string;
  subtitle: string;
  href: string;
  keywords: string;
}

export const MAX_RESULTS = 8;

/**
 * Rank entries against a query. Every term that appears anywhere in an entry
 * scores one, so a two-word query prefers an entry matching both — simple, and
 * fast enough to run on every keystroke without a request.
 */
export function runSearch(query: string, index: SearchEntry[]): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q || index.length === 0) return [];
  const terms = q.split(/\s+/);

  return index
    .map((entry) => {
      const hay = `${entry.title} ${entry.subtitle} ${entry.keywords}`.toLowerCase();
      const score = terms.reduce((s, t) => (hay.includes(t) ? s + 1 : s), 0);
      return { entry, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.entry)
    .slice(0, MAX_RESULTS);
}
