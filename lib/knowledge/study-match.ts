import { PEOPLE } from "./people";
import { concept } from "./concepts";
import { coversSameGround } from "@/lib/intelligence/next-best-action";
import type { FootballPerson } from "./types";

/*
  Which curated study serves this goal?

  The DEVELOPMENT → STUDY arrow, made specific: "Study: near-post
  finishing" becomes "Study Haaland — near-post finishing", a real page
  in the library rather than a direction to a shelf.

  Two signals, weighted by how much they can be trusted:

    FILM (×2)  — a concept the player's own footage keeps showing, and
                 the person embodies it. The strongest claim the product
                 can make: study the player who does the thing your film
                 says you don't.
    GOAL (×1)  — a concept whose curated name shares meaningful language
                 with the goal the player wrote. The same word-overlap
                 standard the scorer uses everywhere (coversSameGround),
                 so what counts as "about the same thing" cannot drift
                 between systems.

  Pure and client-safe: curated data in, one suggestion out, no model.
*/

export interface StudySuggestion {
  slug: string;
  name: string;
  kind: FootballPerson["kind"];
  /** The concept that made the match — shown, because a silent match is a guess. */
  conceptName: string;
  because: string;
}

export function suggestStudyFor(input: {
  goalTitle: string;
  /** Concept slugs the player's film keeps showing, strongest first. */
  filmConcepts?: string[];
}): StudySuggestion | null {
  const film = new Set(input.filmConcepts ?? []);

  let best: { person: FootballPerson; score: number; conceptSlug: string; viaFilm: boolean } | null = null;

  for (const person of PEOPLE) {
    let score = 0;
    let matchSlug = "";
    let viaFilm = false;

    for (const slug of person.embodies) {
      const c = concept(slug);
      if (!c) continue;
      if (film.has(slug)) {
        score += 2;
        if (!viaFilm) {
          matchSlug = slug;
          viaFilm = true;
        }
      }
      if (coversSameGround(c.name, input.goalTitle)) {
        score += 1;
        if (!matchSlug) matchSlug = slug;
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { person, score, conceptSlug: matchSlug, viaFilm };
    }
  }

  if (!best || !best.conceptSlug) return null;

  const c = concept(best.conceptSlug);
  if (!c) return null;

  return {
    slug: best.person.slug,
    name: best.person.name,
    kind: best.person.kind,
    conceptName: c.name,
    because: best.viaFilm
      ? `${best.person.name} embodies ${c.name.toLowerCase()} — the thing your film keeps showing.`
      : `${best.person.name} embodies ${c.name.toLowerCase()}, which your goal is about.`,
  };
}
