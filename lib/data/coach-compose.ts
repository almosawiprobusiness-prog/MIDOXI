import { CONCEPTS } from "@/lib/knowledge/concepts";
import type { FootballConcept } from "@/lib/knowledge/types";
import type { SessionBlockInput, OppositionReport, MatchPlan } from "./coach-types";

/*
  Deterministic coach composition.

  The free, always-available half of the coach engine: a session built from the
  curated concept graph, and a match plan built strictly from the coach's own
  recorded observations. No server imports and no model calls, so this is unit
  testable and runs identically whether or not Claude is reachable.
*/

export interface SessionContext {
  objective: string;
  durationMin: number;
  playersCount: number | null;
  pitch: string;
  /** Squad development focuses the coach is already reinforcing. */
  squadFocus: string[];
  /**
   * The club's written methodology, when the coach belongs to an organization
   * that has one. Empty means MIDO answers generically — and says so.
   */
  methodology?: string[];
}

export interface DraftedSession {
  title: string;
  objective: string;
  blocks: SessionBlockInput[];
  source: "mido" | "library";
  /** Why the AI path did not run, when it did not. */
  note: string | null;
  /** How many club principles this session was written inside. */
  methodologyApplied: number;
}

/**
 * Which of the club's principles this session should be written inside.
 *
 * There is a hard cap of three, because a block carrying six coaching points is
 * a block nobody reads. The cap is not the interesting part — *which* three is.
 *
 * This used to take the first three in document order, so a pressing session
 * could arrive carrying the club's build-up principles while its actual
 * pressing principle sat unused further down the page. Given that the club
 * system's whole claim is "a coach here drafts a session written inside your
 * methodology", picking them by position on a page rather than by relevance
 * quietly made that claim much weaker than it sounds.
 *
 * Now they are scored against the session's own language — the objective, and
 * the concept the session is built around — and document order is only the
 * tie-breaker. A club with fewer than three principles gets all of them.
 */
export function relevantPrinciples(
  methodology: string[],
  objective: string,
  lead?: { name: string; definition?: string } | null,
  limit = 3,
): string[] {
  if (methodology.length <= limit) return methodology;

  const terms = `${objective} ${lead?.name ?? ""} ${lead?.definition ?? ""}`
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3);
  if (!terms.length) return methodology.slice(0, limit);

  return methodology
    .map((principle, index) => {
      const hay = principle.toLowerCase();
      /*
        Clubs write principles as "Pressing — press the touch, not the pass".
        That leading label is the club's own categorisation, which makes it by
        far the strongest signal about what a principle is *for* — much stronger
        than a word appearing somewhere in its body.
      */
      const label = hay.split(/[—:-]/)[0].trim();

      let score = 0;
      for (const t of terms) {
        if (label && new RegExp(`\\b${t}`).test(label)) score += 10;
        // A whole word beats a fragment, so a build-up principle reading
        // "against two pressers" does not score like a pressing principle.
        else if (new RegExp(`\\b${t}\\b`).test(hay)) score += 3;
        else if (hay.includes(t)) score += 1;
      }
      return { principle, score, index };
    })
    // Document order breaks ties, so a club that wrote its principles in
    // priority order still gets them in that order when nothing matches.
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((s) => s.principle);
}

/** Concepts whose language overlaps the objective. Curated, not guessed. */
export function matchConcepts(objective: string, limit = 3): FootballConcept[] {
  const words = objective
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3);
  if (!words.length) return CONCEPTS.slice(0, limit);

  const scored = CONCEPTS.map((c) => {
    const hay = `${c.name} ${c.definition} ${c.why} ${c.looksLike.join(" ")}`.toLowerCase();
    let score = 0;
    for (const w of words) if (hay.includes(w)) score += hay.includes(` ${w}`) ? 2 : 1;
    if (c.name.toLowerCase().includes(objective.toLowerCase().trim())) score += 6;
    return { c, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return (scored.length ? scored.map((s) => s.c) : CONCEPTS).slice(0, limit);
}

/**
 * The deterministic session. Structure follows the standard coaching arc
 * (warm-up → technical → tactical → conditioned game → match scenario →
 * cool-down) and the content comes from curated concept material.
 */
export function composeSession(ctx: SessionContext): DraftedSession {
  const concepts = matchConcepts(ctx.objective);
  const lead = concepts[0];
  const players = ctx.playersCount ?? 16;
  const total = ctx.durationMin || 75;

  // Proportional split of the available time, rounded to sensible minutes.
  const share = (pct: number) => Math.max(5, Math.round((total * pct) / 5) * 5);

  const blocks: SessionBlockInput[] = [
    {
      phase: "warmup",
      name: `Activation + ${lead ? lead.name.toLowerCase() : "theme"} rondo`,
      durationMin: share(0.15),
      organisation: `Two 12x12m grids, 5v2. Losing pair goes in. Rules bias the session theme from the first minute.`,
      coachingPoints: lead ? lead.cues.slice(0, 2) : ["Body open before receiving"],
      progression: "Two-touch, then one-touch for the escape pass",
      regression: "Add a neutral player",
    },
    {
      phase: "technical",
      name: lead ? `${lead.name} — isolated repetition` : "Technical repetition",
      durationMin: share(0.2),
      organisation: lead?.trains[0] ?? "Unopposed pattern work building the action of the session.",
      coachingPoints: lead ? lead.cues : ["Quality of the first action"],
      progression: "Add a passive defender, then a live one",
      regression: "Remove the defender, slow the service",
    },
    {
      phase: "tactical",
      name: concepts[1] ? `${concepts[1].name} in a game picture` : "The principle, with opposition",
      durationMin: share(0.2),
      organisation:
        concepts[1]?.trains[0] ??
        `Positional game, ${Math.max(6, Math.floor(players / 2))}v${Math.max(6, Math.floor(players / 2))} in zones, on ${ctx.pitch || "two thirds"}.`,
      coachingPoints: concepts[1]?.cues.slice(0, 3) ?? ["Recognise the moment", "Act together"],
      progression: "Remove a neutral, shorten the pitch",
      regression: "Add a neutral, widen the pitch",
    },
    {
      phase: "conditioned-game",
      name: "Conditioned game — the behaviour scores",
      durationMin: share(0.2),
      organisation: `${Math.max(6, Math.floor(players / 2))}v${Math.max(6, Math.floor(players / 2))} on ${ctx.pitch || "half a pitch"}. A goal counts double when it comes from the session theme.`,
      coachingPoints: lead ? [lead.cues[0], "Condition rewards the decision, not the outcome"] : ["Reward the decision"],
      progression: "Only themed goals count",
      regression: "All goals count, themed goals count double",
    },
    {
      phase: "match-scenario",
      name: "Free play — match rules",
      durationMin: share(0.18),
      organisation: "11v11 or the closest available. Stop only to correct the theme.",
      coachingPoints: ["Does the behaviour survive when nothing rewards it?"],
      progression: "",
      regression: "",
    },
    {
      phase: "cooldown",
      name: "Cool-down + review",
      durationMin: share(0.07),
      organisation: "Mobility flow, then two minutes of questions to the group.",
      coachingPoints: ["Ask, do not tell", "One thing to carry into the next session"],
      progression: "",
      regression: "",
    },
  ];

  // The club's own principles ride on the blocks where they are coached.
  const principles = relevantPrinciples(ctx.methodology ?? [], ctx.objective, lead);
  if (principles.length) {
    for (const block of blocks) {
      if (block.phase === "tactical" || block.phase === "conditioned-game") {
        block.coachingPoints = [
          ...block.coachingPoints,
          ...principles.map((p) => `Club principle — ${p}`),
        ].slice(0, 6);
      }
    }
  }

  return {
    title: lead ? `Session — ${lead.name.toLowerCase()}` : "Session plan",
    objective: ctx.objective,
    blocks,
    source: "library",
    note: null,
    methodologyApplied: principles.length,
  };
}

/** Everything the coach actually recorded, as labelled lines. */
export function observations(r: OppositionReport): string[] {
  return [
    ...r.inPossession.map((s) => `In possession: ${s}`),
    ...r.outOfPossession.map((s) => `Out of possession: ${s}`),
    ...r.transition.map((s) => `Transition: ${s}`),
    ...r.setPieces.map((s) => `Set pieces: ${s}`),
    ...r.weaknesses.map((s) => `Weakness: ${s}`),
    ...r.keyPlayers.map((p) => `Key player — ${p.name} (${p.position}): ${p.threat}`),
  ];
}

/**
 * The deterministic plan: the coach's own observations, reorganised into the
 * moments of a match. It adds structure, not information.
 */
export function composeMatchPlan(r: OppositionReport): MatchPlan {
  const sections: MatchPlan["sections"] = [];

  // Observations are kept verbatim — only the framing is added, so nothing the
  // coach wrote is reworded into something they did not say.
  if (r.inPossession.length) {
    sections.push({
      title: "When they have the ball",
      points: [...r.inPossession, "Decide who covers each of these before kick-off."],
    });
  }
  if (r.outOfPossession.length) {
    sections.push({
      title: "Their shape without the ball",
      points: [...r.outOfPossession, "Build our first pattern to break exactly this."],
    });
  }
  if (r.weaknesses.length) {
    // Framed once, like every other section. Appending the same sentence to
    // each observation made a two-item list read as a template rather than as
    // the coach's own scouting.
    sections.push({
      title: "Where to attack",
      points: [...r.weaknesses, "Rehearse a repeatable way to reach these before the game."],
    });
  }
  if (r.transition.length) {
    sections.push({
      title: "Transition",
      points: [...r.transition, "Set rest defence for this before the attack finishes."],
    });
  }
  if (r.keyPlayers.length) {
    sections.push({
      title: "Individuals",
      points: r.keyPlayers.map((p) => `${p.name}${p.position ? ` (${p.position})` : ""}: ${p.threat}`),
    });
  }
  if (r.setPieces.length) {
    sections.push({ title: "Set pieces", points: r.setPieces });
  }

  return {
    headline: `Match plan — ${r.opponent}`,
    sections,
    basedOn: observations(r),
    generatedAt: new Date().toISOString(),
  };
}

