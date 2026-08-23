"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createBoard, updateBoard, deleteBoard } from "@/lib/data/coach";
import { boardFromFormation, type TacticalBoardInput } from "@/lib/data/coach-types";

export type Result = { ok: true; id?: string; message?: string } | { ok: false; error: string };

function revalidate(id?: string) {
  revalidatePath("/app/tactics");
  if (id) revalidatePath(`/app/tactics/${id}`);
}

export async function newBoard(formation: string, title: string): Promise<Result> {
  const input: TacticalBoardInput = {
    title: title.trim() || `Untitled board · ${formation}`,
    formation,
    phase: "in-possession",
    board: boardFromFormation(formation),
    notes: "",
  };
  const id = await createBoard(input);
  if (!id) return { ok: false, error: "Could not create the board." };
  revalidate(id);
  redirect(`/app/tactics/${id}`);
}

export async function saveBoard(id: string, input: TacticalBoardInput): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: "Give the board a title." };
  const ok = await updateBoard(id, { ...input, title: input.title.trim() });
  if (!ok) return { ok: false, error: "Could not save the board." };
  revalidate(id);
  return { ok: true, id, message: "Board saved." };
}

export async function removeBoard(id: string): Promise<Result> {
  const ok = await deleteBoard(id);
  if (!ok) return { ok: false, error: "Could not delete the board." };
  revalidate();
  redirect("/app/tactics");
}
