import type { PlayerContext } from "./context";
import { MIN_BLOCKS, type SessionProposal } from "./session-plan";

/*
  SESSION ADAPTATION — the player answers back, the objective survives.

  "Make it shorter" must not become a different session: the objective
  and every block's citation are fixed, only the work changes. That
  contract is enforced here, in pure code —

  1. adaptGuard()          the safety rules, BEFORE any model runs.
  2. deterministicAdapt()  the adaptations code can do alone.
  3. validateAdaptation()  what a model's rewrite must satisfy to be
                           accepted: same objective, citations a subset
                           of the original's, duration moved the way
                           the directive says.

  The safety rule is one-way by design: a directive may lower intensity
  below what the record suggests, but "harder" cannot override what
  readiness or the fixture forbids. Code refuses; the AI never gets to
  argue.
*/

export type AdaptDirective =
  | "shorter"
  | "longer"
  | "harder"
  | "easier"
  | "no_goal"
  | "no_partner"
  | "small_space"
  | "gym"
  | "pitch"
  | "low_intensity";

export const ADAPT_DIRECTIVES: { key: AdaptDirective; label: string; instruction: string }[] = [
  { key: "shorter", label: "Shorter", instruction: "Reduce the total time by roughly a third. Trim work, never the point of a block; drop a block only if trimming cannot get there." },
  { key: "longer", label: "Longer", instruction: "Extend the total time by roughly a third with more quality repetitions and one added progression — not new themes." },
  { key: "harder", label: "Harder", instruction: "Increase difficulty through denser constraints, less time on the ball and faster decisions — NOT through more volume or heavier loading." },
  { key: "easier", label: "Easier", instruction: "Simplify the picture: fewer decisions at once, more time, slower build-up. The behaviour being trained stays the same." },
  { key: "no_goal", label: "No goal", instruction: "No goal is available. Replace any finishing target with gates, zones or a wall; the finishing behaviour is still rehearsed." },
  { key: "no_partner", label: "Solo", instruction: "No partner or server is available. Every block must be executable alone — wall, rebounder, cone patterns, self-serve." },
  { key: "small_space", label: "Small space", instruction: "Space is tight (roughly 10x10m). Adapt every block to that footprint; shrink patterns rather than deleting them." },
  { key: "gym", label: "Gym version", instruction: "Move the session indoors to a gym: strength and movement work that serves the same objective. No ball-striking at distance." },
  { key: "pitch", label: "Pitch version", instruction: "Move the session onto a pitch with full equipment available; restore game-realistic distances." },
  { key: "low_intensity", label: "Lower intensity", instruction: "Reduce physical intensity everywhere: submaximal speeds, longer rest, no jumps or maximal accelerations. Technical content stays." },
];

export function adaptMeta(key: AdaptDirective) {
  return ADAPT_DIRECTIVES.find((d) => d.key === key) ?? null;
}

/** Directives that raise load, and are therefore safety-guarded. */
const RAISES_LOAD: AdaptDirective[] = ["harder", "longer"];

/**
 * The deterministic safety gate, run before any model. Returns the
 * refusal in the player's terms, or null when the directive may run.
 */
export function adaptGuard(directive: AdaptDirective, ctx: PlayerContext): string | null {
  if (!RAISES_LOAD.includes(directive)) return null;
  const s = ctx.situation;
  if (s.daysUntilNextMatch !== null && s.daysUntilNextMatch <= 1) {
    return "Your next match is tomorrow — MIDO will not raise the load this close to it. The session stays as planned; ask again after the match.";
  }
  if (s.readiness !== null && s.readiness < 40) {
    return `Your readiness was ${s.readiness} at the last check-in — MIDO will not make today harder on that. Recover first; the harder version will be there when you are.`;
  }
  return null;
}

/**
 * The adaptations code can do without a model: pure arithmetic on the
 * proposal. Only "shorter" qualifies — dropping the least essential
 * middle block and scaling the total is honest; rewriting a drill for
 * a wall is not something arithmetic should pretend to do. Everything
 * else returns null and the caller says the writing model is needed.
 */
export function deterministicAdapt(
  proposal: SessionProposal,
  directive: AdaptDirective,
): SessionProposal | null {
  if (directive !== "shorter") return null;
  /*
    Needs at least two middle blocks: first and last stay (preparation
    and close are structure, not content), and dropping the ONLY middle
    block would leave a warm-up attached to a cool-down — a session
    with its point removed. Three blocks or fewer go to the model.
  */
  if (proposal.blocks.length <= MIN_BLOCKS + 1) return null;

  /*
    Drop one middle block. Among the middle, the last one goes:
    composition ordered them by importance (film, then goal).
  */
  const blocks = [...proposal.blocks];
  blocks.splice(blocks.length - 2, 1);

  return {
    ...proposal,
    blocks,
    durationMin: Math.max(20, Math.round(proposal.durationMin * 0.7)),
    source: "composed",
    note: "Shortened by MIDO: one block removed, the objective unchanged.",
  };
}

/**
 * What a model's adaptation must satisfy to replace the original.
 * Returns the reason it fails, or null when it holds. The objective is
 * not checked for equality because the caller forces the original
 * objective onto the result — a preserved objective is guaranteed by
 * construction, not by trusting the model to echo it.
 */
export function validateAdaptation(
  original: SessionProposal,
  adapted: { durationMin: number; blocks: { sourceKey: string }[] },
  directive: AdaptDirective,
): string | null {
  if (adapted.blocks.length < MIN_BLOCKS) return "too few blocks survived";

  const allowed = new Set(original.blocks.map((b) => b.sourceKey));
  for (const b of adapted.blocks) {
    if (!allowed.has(b.sourceKey)) return `new citation "${b.sourceKey}" appeared during adaptation`;
  }

  if (directive === "shorter" && adapted.durationMin >= original.durationMin) {
    return "shorter session did not get shorter";
  }
  if (directive === "longer" && adapted.durationMin <= original.durationMin) {
    return "longer session did not get longer";
  }
  if (!["shorter", "longer"].includes(directive)) {
    // Every other directive changes the work, not the commitment.
    const drift = Math.abs(adapted.durationMin - original.durationMin) / Math.max(1, original.durationMin);
    if (drift > 0.25) return "duration drifted on a directive that should not move it";
  }

  return null;
}
