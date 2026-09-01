"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archiveBoard,
  createBoard,
  createBoardFromFormation,
  deleteBoard,
  duplicateBoard,
  linkBoard,
  unlinkBoard,
  updateBoard,
} from "@/lib/data/boards";
import { toDocument } from "@/lib/tactics/document";
import type { TacticalBoardInput } from "@/lib/tactics/types";
import { isBoardEntityType, isBoardLinkRole, type BoardEntityType } from "@/lib/tactics/links";

export type Result = { ok: true; id?: string; message?: string } | { ok: false; error: string };

/*
  Board actions.

  Every surface that creates or attaches a board goes through here rather
  than through its own route's actions, so "attach a board to this drill"
  behaves identically whether it was pressed in a session, a programme or
  a development goal. The paths revalidated are passed in by the caller
  for the same reason — the action does not need to know which page it
  was invoked from, only what to refresh.
*/

function revalidateBoard(id?: string, extra?: string) {
  revalidatePath("/app/tactics");
  if (id) revalidatePath(`/app/tactics/${id}`);
  if (extra) revalidatePath(extra);
}

export async function newBoard(formation: string, title: string): Promise<Result> {
  const id = await createBoardFromFormation(formation, title);
  if (!id) return { ok: false, error: "Could not create the board." };
  revalidateBoard(id);
  redirect(`/app/tactics/${id}`);
}

export async function saveBoard(id: string, input: TacticalBoardInput): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: "Give the board a title." };
  /*
    The document arrives from a client component, so it is re-normalised
    here rather than trusted: `toDocument` bounds every coordinate and
    drops anything malformed. A board is user input like any other.
  */
  const ok = await updateBoard(id, {
    ...input,
    title: input.title.trim(),
    doc: toDocument(input.doc),
  });
  if (!ok) return { ok: false, error: "Could not save the board." };
  revalidateBoard(id);
  return { ok: true, id, message: "Board saved." };
}

export async function removeBoard(id: string): Promise<Result> {
  const ok = await deleteBoard(id);
  if (!ok) return { ok: false, error: "Could not delete the board." };
  revalidateBoard();
  redirect("/app/tactics");
}

export async function setBoardArchived(id: string, archived: boolean): Promise<Result> {
  const ok = await archiveBoard(id, archived);
  if (!ok) return { ok: false, error: "Could not archive the board." };
  revalidateBoard(id);
  return { ok: true, id, message: archived ? "Board archived." : "Board restored." };
}

export async function copyBoard(id: string, title?: string): Promise<Result> {
  const copy = await duplicateBoard(id, title);
  if (!copy) return { ok: false, error: "Could not duplicate the board." };
  revalidateBoard(copy);
  return { ok: true, id: copy, message: "Board duplicated." };
}

/** Create a board already attached to something — the "Create" empty-state path. */
export async function newBoardFor(
  entityType: string,
  entityId: string,
  formation: string,
  title: string,
  revalidate?: string,
): Promise<Result> {
  if (!isBoardEntityType(entityType)) return { ok: false, error: "Unknown attachment." };
  const id = await createBoardFromFormation(formation, title, "drill");
  if (!id) return { ok: false, error: "Could not create the board." };
  await linkBoard({ boardId: id, entityType, entityId });
  revalidateBoard(id, revalidate);
  return { ok: true, id, message: "Board created and attached." };
}

export async function attachBoard(
  boardId: string,
  entityType: string,
  entityId: string,
  opts?: { role?: string; duplicate?: boolean; revalidate?: string },
): Promise<Result> {
  if (!isBoardEntityType(entityType)) return { ok: false, error: "Unknown attachment." };

  /*
    "Duplicate and customise" (§3). Attaching the live board is the right
    default — edit the press and every session teaching it updates — but a
    coach adapting one drill must not silently rewrite the original for
    every other place it appears.
  */
  const targetId = opts?.duplicate ? await duplicateBoard(boardId) : boardId;
  if (!targetId) return { ok: false, error: "Could not duplicate the board." };

  const ok = await linkBoard({
    boardId: targetId,
    entityType: entityType as BoardEntityType,
    entityId,
    role: isBoardLinkRole(opts?.role) ? opts.role : "illustrates",
  });
  if (!ok) return { ok: false, error: "Could not attach the board." };
  revalidateBoard(targetId, opts?.revalidate);
  return { ok: true, id: targetId, message: "Board attached." };
}

export async function detachBoard(
  boardId: string,
  entityType: string,
  entityId: string,
  revalidate?: string,
): Promise<Result> {
  if (!isBoardEntityType(entityType)) return { ok: false, error: "Unknown attachment." };
  const ok = await unlinkBoard(boardId, entityType, entityId);
  if (!ok) return { ok: false, error: "Could not detach the board." };
  revalidateBoard(boardId, revalidate);
  return { ok: true, message: "Board removed." };
}

/** Used by the picker's "create blank" path when a formation is not wanted. */
export async function newBlankBoard(input: TacticalBoardInput): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: "Give the board a title." };
  const id = await createBoard({ ...input, title: input.title.trim(), doc: toDocument(input.doc) });
  if (!id) return { ok: false, error: "Could not create the board." };
  revalidateBoard(id);
  return { ok: true, id };
}
