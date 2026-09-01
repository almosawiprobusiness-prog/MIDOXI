/*
  The deterministic half of MIDO's board work.

  Pure and client-safe, separated from `lib/ai/board-engine.ts` for the
  same reason `lib/data/coach-compose.ts` is separate from
  `lib/ai/coach-engine.ts`: the composition is football logic that can
  be held still under test, and the engine around it is metering,
  gating and a network call that cannot.

  Everything here works with no AI allowance, no credits and no network.
  That is the point — the free tier gets a real answer rather than a
  locked door, and every AI path in the engine falls back to exactly
  these functions when the model is unavailable.

  What none of it does is pretend. A composed explanation states what is
  on the board; it does not interpret it. A composed drill states the
  setup that is drawn; it does not invent coaching points nobody wrote.
*/

import { countDocument, documentFromFormation } from "./document";
import { summariseBoard } from "./describe";
import type { BoardPhase, TacticalBoard, TacticalDocument } from "./types";

/** The board fields any of these functions need. */
export type BoardLike = Pick<
  TacticalBoard,
  "title" | "phase" | "formation" | "notes" | "tags" | "doc"
>;

// ── explaining ───────────────────────────────────────────────

export interface BoardExplanation {
  headline: string;
  points: string[];
  watchFor: string[];
  /** True when this is the factual reading rather than MIDO's. */
  composed: boolean;
  note: string | null;
}

/**
 * What is on the board, said plainly.
 *
 * Not a placeholder: this is genuinely useful and costs nothing. The
 * free tier gets the FACTS; the paid tier gets the interpretation. The
 * split is honest in both directions — it never dresses the reading up
 * as coaching insight, and never withholds what the product can see.
 */
export function composeExplanation(board: BoardLike): BoardExplanation {
  const c = countDocument(board.doc);
  const points: string[] = [];

  points.push(
    `${c.ours} of your players against ${c.theirs}, set up ${
      board.formation ? `in a ${board.formation} ` : ""
    }for the ${board.phase.replace(/-/g, " ")} phase.`,
  );
  if (board.doc.objective) points.push(`The stated objective: ${board.doc.objective}`);
  if (c.paths) {
    points.push(
      `${c.paths} movement${c.paths === 1 ? "" : "s"} drawn${
        c.zones ? `, and ${c.zones} area${c.zones === 1 ? "" : "s"} of space marked` : ""
      }.`,
    );
  }
  if (c.frames > 1) points.push(`The idea runs through ${c.frames} phases.`);
  if (board.notes.trim()) points.push(board.notes.trim());

  return {
    headline: board.doc.objective || board.title,
    points,
    watchFor: [],
    composed: true,
    note: null,
  };
}

// ── drawing ──────────────────────────────────────────────────

export interface DraftedBoard {
  title: string;
  objective: string;
  phase: BoardPhase;
  formation: string;
  tags: string[];
  doc: TacticalDocument;
  /** True when this is the starting shape, not a drawn idea. */
  composed: boolean;
  note: string | null;
}

/**
 * A real starting shape, and nothing pretended.
 *
 * Eleven players in the formation asked for, correctly placed, ready to
 * draw on. What it does NOT include is an objective — because inventing
 * one the user never stated is precisely the fabrication HARD_RULES
 * exists to prevent, and the caller's note says the idea is still
 * theirs to draw.
 */
export function composeBoard(brief: {
  title?: string;
  formation?: string;
  phase?: BoardPhase;
}): DraftedBoard {
  const formation = brief.formation || "4-3-3";
  return {
    title: brief.title?.trim() || `${formation} board`,
    objective: "",
    phase: brief.phase ?? "in-possession",
    formation,
    tags: [],
    doc: documentFromFormation(formation),
    composed: true,
    note: null,
  };
}

// ── turning a board into work ────────────────────────────────

export type DrillPhase =
  | "warmup"
  | "technical"
  | "tactical"
  | "possession"
  | "conditioned-game"
  | "match-scenario"
  | "set-piece"
  | "cooldown";

export interface DraftedDrill {
  name: string;
  phase: DrillPhase;
  durationMin: number;
  organisation: string;
  coachingPoints: string[];
  progression: string;
  regression: string;
  composed: boolean;
  note: string | null;
}

/**
 * The setup that is visibly on the board, written out.
 *
 * The coaching points come from the board's own objective or are empty.
 * A composed drill inventing "scan before receiving" because the board
 * looks like a possession game would be the product making up coaching,
 * which is worse than saying less.
 */
export function composeDrill(board: BoardLike): DraftedDrill {
  const c = countDocument(board.doc);
  return {
    name: board.title,
    phase: board.phase === "out-of-possession" ? "tactical" : "possession",
    durationMin: 15,
    organisation: `Set up as drawn on the board "${board.title}": ${c.ours} v ${c.theirs}${
      board.doc.pitch.dimensions ? ` in ${board.doc.pitch.dimensions}` : ""
    }. ${summariseBoard({ title: board.title, phase: board.phase, doc: board.doc })}.`,
    coachingPoints: board.doc.objective ? [board.doc.objective] : [],
    progression: "",
    regression: "",
    composed: true,
    note: null,
  };
}
