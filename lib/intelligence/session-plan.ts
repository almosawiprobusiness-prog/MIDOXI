import type { SessionKind } from "@/lib/types";
import type { PlayerContext } from "./context";
import { validSourceKeys } from "./context";

/*
  THE SESSION PLAN — the shape of a generated training session, its
  validation, and the deterministic fallback.

  The market sells the same week to everyone; ours is derived from the
  record, and this file is where "derived" is enforced rather than
  claimed. Every block carries a `sourceKey` citing the piece of the
  player's context it exists because of. `validateBlocks` drops any
  block whose citation is not in the context — in code, not in the
  prompt — so a session can never say "because of your film" about film
  that does not exist.

  Pure on purpose: the AI engine (lib/ai/session-engine.ts) is a
  server-only module, but the rules about what survives generation are
  date-free arithmetic that belongs under test.
*/

export interface SessionBlock {
  name: string;
  /** What to do, concretely. */
  detail: string;
  /** The work prescription: sets/reps/minutes/rest. */
  work: string;
  /** The context key this block exists because of. */
  sourceKey: string;
  /** The reason, in the player's terms, one sentence. */
  why: string;
}

export interface SessionProposal {
  title: string;
  kind: SessionKind;
  durationMin: number;
  objective: string;
  blocks: SessionBlock[];
  /** "mido" when a model wrote it; "composed" for the fallback. */
  source: "mido" | "composed";
  /** Honest note when the metered path could not run. */
  note: string | null;
}

export const MAX_BLOCKS = 6;
export const MIN_BLOCKS = 2;

/** Human label for a source key, resolved against the context. */
export function sourceLabel(key: string, ctx: PlayerContext): string {
  if (key === "readiness") return `Readiness ${ctx.situation.readiness}/100`;
  if (key === "memory") return "Your memory";
  if (key === "rhythm") return "Your week";
  if (key.startsWith("goal:")) {
    const g = ctx.goals.find((g) => `goal:${g.id}` === key);
    return g ? `Goal: ${g.title}` : "Goal";
  }
  if (key.startsWith("film:")) return `Film: ${key.slice(5)}`;
  return key;
}

/**
 * Keep only blocks whose citation exists in the context, capped.
 * Returns the survivors — deciding what a too-short result means is
 * the caller's job, because the answer differs between paths.
 */
export function validateBlocks(
  blocks: SessionBlock[],
  ctx: PlayerContext,
): SessionBlock[] {
  const valid = validSourceKeys(ctx);
  return blocks
    .filter((b) => valid.has(b.sourceKey))
    .filter((b) => b.name.trim() && b.detail.trim() && b.work.trim())
    .slice(0, MAX_BLOCKS)
    .map((b) => ({
      name: b.name.slice(0, 120),
      detail: b.detail.slice(0, 300),
      work: b.work.slice(0, 120),
      sourceKey: b.sourceKey,
      why: (b.why ?? "").slice(0, 200),
    }));
}

/**
 * The deterministic session — free, always available, and honest about
 * being the simpler article. Built from the leading goal, the most
 * observed film concept, and readiness. Structure over invention: it
 * prescribes shapes of work, never claims about the player it cannot
 * cite.
 */
export function composeSessionPlan(ctx: PlayerContext): SessionProposal {
  const blocks: SessionBlock[] = [];
  const lowReadiness = ctx.situation.readiness !== null && ctx.situation.readiness < 40;

  const film = ctx.filmConcepts[0] ?? null;
  const goal = ctx.goals[0] ?? null;

  blocks.push({
    name: "Prepare",
    detail: lowReadiness
      ? "Extended activation: easy movement, mobility, build to moderate intensity only."
      : "Activation: progressive movement prep into short accelerations.",
    work: lowReadiness ? "12 minutes" : "8 minutes",
    sourceKey: lowReadiness ? "readiness" : "rhythm",
    why: lowReadiness
      ? "Your last check-in scored low, so today builds up gently and stays submaximal."
      : "Standard preparation for the work that follows.",
  });

  if (film) {
    blocks.push({
      name: `Film focus: ${film.concept}`,
      detail: `Isolated repetitions of ${film.concept.toLowerCase()} — recreate the situation your footage showed, slow first, then at speed.`,
      work: "4 x 4 reps · 45s rest",
      sourceKey: `film:${film.concept}`,
      why: `Your film showed this ${film.count} time(s) — training what the film showed, not a generic drill.`,
    });
  }

  if (goal) {
    blocks.push({
      name: `Goal work: ${goal.title}`,
      detail: `Constraint game or pattern where the action only counts when it starts with the goal behaviour.`,
      work: lowReadiness ? "8 minutes, low intensity" : "12 minutes",
      sourceKey: `goal:${goal.id}`,
      why: `Directly serves your active goal.`,
    });
  }

  blocks.push({
    name: "Close",
    detail: lowReadiness
      ? "Down-regulation: easy movement and breathing. Note how the body responded."
      : "Transfer: free play finishing through today's focus, then note one thing that improved.",
    work: lowReadiness ? "5 minutes" : "10 minutes",
    sourceKey: lowReadiness ? "readiness" : "rhythm",
    why: "Ends the session with evidence you can log.",
  });

  const lead = film?.concept ?? goal?.title ?? "fundamentals";
  return {
    title: `Individual session — ${lead.toLowerCase()}`,
    kind: "individual",
    durationMin: lowReadiness ? 35 : 50,
    objective: goal
      ? `Move "${goal.title}" forward${film ? ` through what the film showed (${film.concept.toLowerCase()})` : ""}.`
      : `A focused individual session built from your recent record.`,
    blocks,
    source: "composed",
    note: null,
  };
}
