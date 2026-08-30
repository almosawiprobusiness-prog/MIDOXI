import { CONCEPTS, concept } from "./concepts";
import { coversSameGround } from "@/lib/intelligence/next-best-action";
import type { FootballConcept } from "./types";

/*
  The watch focus — fandom turned into structured study.

  A player already watches football every week. Unstructured, that
  watching teaches almost nothing; with one focus question it becomes
  the cheapest high-volume study input they have. This module writes
  the question, deterministically, from the same record everything
  else reads: the concept their film keeps showing, or failing that
  the concept their goal is about.

  No model, no fixture API, no claims about any real match — the
  player says what they are watching; MIDO says how to watch it.
*/

export interface WatchFocus {
  /** The concept being watched for. */
  conceptSlug: string;
  conceptName: string;
  /** The study session title, ready to create. */
  title: string;
  /** One instruction that changes how ninety minutes are watched. */
  instruction: string;
  /** Specific things it looks like on screen. */
  watchFor: string[];
  /** Where the focus came from, in the player's terms. */
  because: string;
}

export function composeWatchFocus(input: {
  goalTitle?: string | null;
  /** Concept slugs the film keeps showing, most observed first. */
  filmConcepts?: string[];
  favoriteClub?: string | null;
}): WatchFocus | null {
  let chosen: FootballConcept | null = null;
  let viaFilm = false;

  for (const slug of input.filmConcepts ?? []) {
    const c = concept(slug);
    if (c) {
      chosen = c;
      viaFilm = true;
      break;
    }
  }
  if (!chosen && input.goalTitle) {
    chosen = CONCEPTS.find((c) => coversSameGround(c.name, input.goalTitle!)) ?? null;
  }
  if (!chosen) return null;

  const club = input.favoriteClub?.trim();
  const opener = club ? `Watching ${club} this week?` : "Watching a match this week?";

  return {
    conceptSlug: chosen.slug,
    conceptName: chosen.name,
    title: `Watch study — ${chosen.name.toLowerCase()}`,
    instruction: `${opener} For ten minutes, ignore the ball and the score. Watch only the player in your position, and one thing: ${chosen.name.toLowerCase()}. Note every time it happens — and what it made the nearest opponent do.`,
    watchFor: chosen.looksLike.slice(0, 4),
    because: viaFilm
      ? `Your film keeps showing ${chosen.name.toLowerCase()} — watch how it is done at the top.`
      : `Your goal is about ${chosen.name.toLowerCase()}.`,
  };
}
