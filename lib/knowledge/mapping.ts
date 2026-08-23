import { CONCEPTS, concept } from "./concepts";
import type { DevelopmentCategory, DevelopmentGoal } from "@/lib/types";

/*
  Turning an observation into something that moves.

  An observation on a clip is a sentence. A development goal is a thing a player
  is working on. The gap between them is where every football app loses people:
  the note gets written, and nothing happens to it.

  This module proposes the link. It does not make it — that is deliberate and it
  is the most important design decision in the feature. Attaching a piece of
  film to the wrong goal is worse than attaching nothing: the evidence trail is
  the one part of MIDO that has to be trustworthy, because a player will read it
  in three months and believe it. So MIDO suggests, the player confirms, and
  every link is reversible.

  Client-safe: pure functions over the curated graph.
*/

export interface GoalSuggestion {
  /** The goal to attach to, when there is one worth proposing. */
  goal: DevelopmentGoal | null;
  /** Why this goal — shown to the player, because a silent match is a guess. */
  because: string;
  /** How sure the match is. Anything below `strong` is proposed more quietly. */
  strength: "strong" | "likely" | "weak";
  /** When no goal fits, the goal MIDO would create instead. */
  newGoal?: { title: string; category: DevelopmentCategory; why: string };
}

/** Words too common to mean anything when two football phrases share them. */
const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "to", "for", "with", "my",
  "be", "get", "getting", "more", "better", "improve", "improving", "when",
  "before", "after", "into", "at", "is", "it", "that", "this", "from",
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Shared meaningful words as a fraction of the shorter phrase. */
function overlap(a: string, b: string): number {
  const wa = new Set(words(a));
  const wb = new Set(words(b));
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size);
}

/** The curated area a concept belongs to, as a development category. */
export function categoryForConcept(slug: string): DevelopmentCategory {
  const c = concept(slug);
  const area = c?.area;
  if (area === "technical") return "technical";
  if (area === "physical") return "physical";
  if (area === "mental") return "mental";
  return "tactical";
}

/**
 * Which goal an observation about `conceptSlug` belongs to.
 *
 * Three ways a match is found, in descending order of how much they can be
 * trusted:
 *
 *   1. This concept has been attached to a goal before. That is the player's
 *      own past decision, and nothing MIDO computes beats it.
 *   2. The goal's title and the concept share meaningful language.
 *   3. Nothing does — in which case MIDO proposes a new goal rather than
 *      forcing the observation somewhere it does not belong.
 */
export function suggestGoal(input: {
  conceptSlug: string;
  goals: DevelopmentGoal[];
  /** concept → goalId, from evidence the player has already confirmed. */
  established?: Record<string, string>;
}): GoalSuggestion {
  const c = concept(input.conceptSlug);
  if (!c) {
    return { goal: null, because: "That observation does not map to a curated concept.", strength: "weak" };
  }

  const open = input.goals.filter((g) => g.status !== "achieved");

  // 1 · the player has already decided this
  const establishedId = input.established?.[input.conceptSlug];
  if (establishedId) {
    const goal = open.find((g) => g.id === establishedId) ?? input.goals.find((g) => g.id === establishedId);
    if (goal) {
      return {
        goal,
        because: `You have filed ${c.name.toLowerCase()} under this goal before.`,
        strength: "strong",
      };
    }
  }

  // 2 · shared language
  const scored = open
    .map((g) => ({
      goal: g,
      score:
        Math.max(overlap(g.title, c.name), overlap(g.title, c.definition) * 0.8) +
        (categoryForConcept(input.conceptSlug) === g.category ? 0.15 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best && best.score >= 0.5) {
    return {
      goal: best.goal,
      because: `“${best.goal.title}” and ${c.name.toLowerCase()} are about the same thing.`,
      strength: best.score >= 0.75 ? "strong" : "likely",
    };
  }
  if (best && best.score >= 0.3) {
    return {
      goal: best.goal,
      because: `This might belong under “${best.goal.title}”, but MIDO is not confident.`,
      strength: "weak",
      newGoal: newGoalFor(input.conceptSlug),
    };
  }

  // 3 · nothing fits
  return {
    goal: null,
    because: open.length
      ? "None of your current goals is about this."
      : "You have no development goals yet.",
    strength: "weak",
    newGoal: newGoalFor(input.conceptSlug),
  };
}

/** The goal MIDO would create for a concept, written the way a player would. */
export function newGoalFor(slug: string): { title: string; category: DevelopmentCategory; why: string } | undefined {
  const c = concept(slug);
  if (!c) return undefined;
  return {
    title: c.name,
    category: categoryForConcept(slug),
    why: c.why,
  };
}

/**
 * Concepts a set of goals is plausibly about — used to tell the next video read
 * what this player is working on, so the reading is pointed rather than a tour.
 */
export function conceptsForGoals(goals: DevelopmentGoal[], limit = 6): string[] {
  const open = goals.filter((g) => g.status !== "achieved");
  const scored = CONCEPTS.map((c) => ({
    slug: c.slug,
    score: Math.max(0, ...open.map((g) => overlap(g.title, c.name))),
  }))
    .filter((s) => s.score >= 0.5)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.slug);
}
