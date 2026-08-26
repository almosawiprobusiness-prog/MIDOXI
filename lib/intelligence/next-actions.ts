import "server-only";
import { buildPlayerSignals } from "./build-signals";
import { rankActions, hasEnoughToRecommend } from "./next-best-action";
import { surfaceRecommendations } from "@/lib/data/recommendations";
import { listMemory } from "@/lib/data/memory";
import { coversSameGround } from "./next-best-action";
import type { Memory } from "@/lib/data/memory-types";
import type { Recommendation } from "./recommendation-types";

/*
  What MIDO is telling this player, right now.

  The one call a surface makes. It joins the three pieces built
  separately — signals from the record, ranking from rules, storage of
  what was shown — so no page has to know they exist.
*/

/** How many make it onto the Locker: one prominent, two quiet. */
export const SURFACED_LIMIT = 3;

/**
 * A stored recommendation, plus the one thing not worth storing.
 *
 * Title and reason are history — what MIDO said, kept as said. Minutes
 * is not: it is "how long would this take you right now", which is a
 * property of the current situation rather than of the advice given, so
 * it is re-derived from the live ranking each time rather than frozen
 * into a column.
 */
export type SurfacedAction = Recommendation & {
  minutes?: number;
  /**
   * A memory of the player's that bears on this exact advice —
   * "already tried" or a constraint, matched by the same word overlap
   * the scorer uses everywhere else.
   *
   * Attached, never scored. The Memory page promises "MIDO reads this
   * before it answers anything", and for the deterministic loop that
   * was false: a player who recorded "six weeks of near-post reps —
   * the finish did not improve" was shown "Study: near-post finishing"
   * with no sign of having been heard. Parsing free text into score
   * adjustments would be guesswork wearing a number, so the honest
   * version is this — the advice stands, and the card shows MIDO knows
   * what you told it.
   */
  heard?: { kind: "tried" | "constraint"; body: string };
};

export interface NextActions {
  items: SurfacedAction[];
  /**
   * Whether MIDO has enough to be useful at all.
   *
   * False is not an error and not an empty state to be filled with
   * something generic — it is the honest answer, and the surface says
   * so. A product that invents advice when it knows nothing is one
   * whose advice cannot be trusted when it does.
   */
  informed: boolean;
}

export async function getNextActions(now: Date = new Date()): Promise<NextActions> {
  try {
    const signals = await buildPlayerSignals(now);
    const informed = hasEnoughToRecommend(signals);
    if (!informed) return { items: [], informed: false };

    /*
      Ranked in full, then only the top few are stored. The rest are
      arithmetic and are deliberately thrown away — persisting every
      candidate is how this table would become a graveyard.
    */
    const ranked = rankActions(signals).slice(0, SURFACED_LIMIT);
    const [stored, memory] = await Promise.all([
      surfaceRecommendations(ranked, now),
      listMemory().catch(() => []),
    ]);

    // At most one active row per kind, so kind identifies the pair.
    const minutes = new Map(ranked.map((r) => [r.kind, r.minutes]));
    const items = stored.map((r) => ({
      ...r,
      minutes: minutes.get(r.kind),
      heard: relevantMemory(r, memory),
    }));
    return { items, informed: true };
  } catch {
    // A dashboard renders without its recommendations rather than not
    // at all. Everything below this call is secondary to the page.
    return { items: [], informed: false };
  }
}

/**
 * The player's own words, where they touch this advice.
 *
 * Only the two kinds with a direct bearing on "should I do this":
 * something already tried, and a standing constraint. A weakness or a
 * strength colours HOW to do the work, which is the AI layer's job;
 * these two colour WHETHER the advice lands as informed or deaf.
 * First match wins — one quiet line, not a dossier.
 */
function relevantMemory(
  r: { title: string; reason: string },
  memory: Memory[],
): { kind: "tried" | "constraint"; body: string } | undefined {
  const ground = `${r.title} ${r.reason}`;
  for (const kind of ["tried", "constraint"] as const) {
    const hit = memory.find((m) => m.kind === kind && coversSameGround(m.body, ground));
    if (hit) return { kind, body: hit.body };
  }
  return undefined;
}
