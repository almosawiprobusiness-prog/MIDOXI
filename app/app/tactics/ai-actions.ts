"use server";

import { revalidatePath } from "next/cache";
import { getBoard, createBoard, updateBoard } from "@/lib/data/boards";
import { getActiveRole } from "@/lib/auth/session";
import { addSessionBlock } from "@/lib/data/coach";
import { linkBoard } from "@/lib/data/boards";
import {
  boardToDrill,
  draftBoard,
  explainBoard,
  type BoardExplanation,
  type DraftedDrill,
} from "@/lib/ai/board-engine";
import { toDocument } from "@/lib/tactics/document";
import type { TacticalDocument } from "@/lib/tactics/types";

/*
  MIDO's board operations, as server actions.

  Each one is the shape §7 calls a "tool": named, single-purpose, and
  callable from any surface. What it is NOT is a function the model
  decides to call — the user presses a button, the action gates and
  spends deliberately, and the result comes back editable. That keeps
  cost, entitlement and honesty answerable per operation, which a
  model-driven loop does not.

  Every one of these returns the deterministic answer rather than an
  error when AI is unavailable, so a free account gets something real.
*/

export type AiBoardResult<T> = { ok: true; data: T } | { ok: false; error: string };

// ── read: explain this board ─────────────────────────────────

export async function askExplainBoard(
  boardId: string,
  perspective?: string | null,
): Promise<AiBoardResult<BoardExplanation>> {
  const board = await getBoard(boardId);
  if (!board) return { ok: false, error: "That board no longer exists." };
  const role = await getActiveRole();
  try {
    return { ok: true, data: await explainBoard(board, { role, perspective: perspective ?? null }) };
  } catch {
    return { ok: false, error: "MIDO could not read this board just now." };
  }
}

// ── create: draw a board from a request ──────────────────────

export interface GeneratedBoardResult {
  boardId: string;
  composed: boolean;
  note: string | null;
  title: string;
}

/**
 * Draw a board and save it.
 *
 * Saved rather than returned-and-discarded because the point of §8 is
 * that the board is a real, editable object afterwards — not a picture
 * in a chat bubble. `origin` records that MIDO drew it, so nothing here
 * can later be mistaken for the coach's own work.
 */
export async function askDraftBoard(
  request: string,
  opts?: { formation?: string; attachTo?: { entityType: string; entityId: string } },
): Promise<AiBoardResult<GeneratedBoardResult>> {
  const text = request.trim();
  if (!text) return { ok: false, error: "Say what the board should show." };

  const role = await getActiveRole();
  let drafted;
  try {
    drafted = await draftBoard(text, { role, formation: opts?.formation });
  } catch {
    return { ok: false, error: "MIDO could not draw a board just now." };
  }

  const id = await createBoard({
    title: drafted.title,
    kind: "tactical",
    phase: drafted.phase,
    formation: drafted.formation,
    notes: "",
    tags: drafted.tags,
    visibility: "private",
    origin: { source: "mido", fromBoardId: null, prompt: text.slice(0, 300) },
    doc: drafted.doc,
  });
  if (!id) return { ok: false, error: "Could not save the board." };

  revalidatePath("/app/tactics");
  return {
    ok: true,
    data: { boardId: id, composed: drafted.composed, note: drafted.note, title: drafted.title },
  };
}

// ── update: replace a board's document ───────────────────────

/**
 * Write a document back onto an existing board.
 *
 * The write path for anything MIDO changes about a board (§18's natural
 * language mutation lands here once the directive vocabulary exists).
 * It re-normalises through `toDocument` for the same reason the manual
 * save does: a document arriving from anywhere is untrusted input.
 */
export async function applyBoardDocument(
  boardId: string,
  doc: TacticalDocument,
): Promise<AiBoardResult<{ boardId: string }>> {
  const board = await getBoard(boardId);
  if (!board) return { ok: false, error: "That board no longer exists." };

  const ok = await updateBoard(boardId, {
    title: board.title,
    kind: board.kind,
    phase: board.phase,
    formation: board.formation,
    notes: board.notes,
    tags: board.tags,
    visibility: board.visibility,
    origin: board.origin,
    doc: toDocument(doc),
  });
  if (!ok) return { ok: false, error: "Could not save the board." };

  revalidatePath(`/app/tactics/${boardId}`);
  return { ok: true, data: { boardId } };
}

// ── transform: board → drill, optionally into a session ──────

export async function askBoardToDrill(
  boardId: string,
  opts?: { adaptation?: string | null },
): Promise<AiBoardResult<DraftedDrill>> {
  const board = await getBoard(boardId);
  if (!board) return { ok: false, error: "That board no longer exists." };
  const role = await getActiveRole();
  try {
    return { ok: true, data: await boardToDrill(board, { role, adaptation: opts?.adaptation ?? null }) };
  } catch {
    return { ok: false, error: "MIDO could not write a drill just now." };
  }
}

/**
 * The whole arrow, in one action: board → drill → a block in a session,
 * with the board attached to the block it produced.
 *
 * This is the step that makes the board infrastructure rather than a
 * drawing tool — the tactical idea arrives in the session planner still
 * carrying its picture, instead of being retyped by hand.
 */
export async function askBoardIntoSession(
  boardId: string,
  planId: string,
  opts?: { adaptation?: string | null },
): Promise<AiBoardResult<{ note: string | null; composed: boolean }>> {
  const board = await getBoard(boardId);
  if (!board) return { ok: false, error: "That board no longer exists." };

  const role = await getActiveRole();
  let drill: DraftedDrill;
  try {
    drill = await boardToDrill(board, { role, adaptation: opts?.adaptation ?? null });
  } catch {
    return { ok: false, error: "MIDO could not write a drill just now." };
  }

  const added = await addSessionBlock(planId, {
    phase: drill.phase,
    name: drill.name,
    durationMin: drill.durationMin,
    organisation: drill.organisation,
    coachingPoints: drill.coachingPoints,
    progression: drill.progression,
    regression: drill.regression,
  });
  if (!added) return { ok: false, error: "Could not add the block to that session." };

  /*
    Attach the board to the session, not to the block: `addSessionBlock`
    does not hand back the new block's id, and inventing a lookup by
    name would attach to the wrong block the first time a coach runs the
    same drill twice. The session-level link is correct and honest; the
    block-level one arrives when the data layer can name the row.
  */
  await linkBoard({ boardId, entityType: "session_plan", entityId: planId, role: "illustrates" });

  revalidatePath(`/app/sessions/${planId}`);
  return { ok: true, data: { note: drill.note, composed: drill.composed } };
}
