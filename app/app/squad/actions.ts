"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSquadPlayer,
  updateSquadPlayer,
  deleteSquadPlayer,
  addPlayerNote,
  deletePlayerNote,
} from "@/lib/data/coach";
import type { SquadPlayerInput, PlayerNoteKind } from "@/lib/data/coach-types";

export type Result = { ok: true; id?: string } | { ok: false; error: string };

function revalidate(id?: string) {
  revalidatePath("/app/squad");
  revalidatePath("/app");
  if (id) revalidatePath(`/app/squad/${id}`);
}

export async function createPlayer(input: SquadPlayerInput): Promise<Result> {
  if (!input.name.trim()) return { ok: false, error: "Give the player a name." };
  const id = await createSquadPlayer({ ...input, name: input.name.trim() });
  if (!id) return { ok: false, error: "Could not add the player." };
  revalidate();
  return { ok: true, id };
}

export async function updatePlayer(id: string, input: SquadPlayerInput): Promise<Result> {
  if (!input.name.trim()) return { ok: false, error: "Give the player a name." };
  const ok = await updateSquadPlayer(id, { ...input, name: input.name.trim() });
  if (!ok) return { ok: false, error: "Could not save the player." };
  revalidate(id);
  return { ok: true, id };
}

export async function removePlayer(id: string): Promise<Result> {
  const ok = await deleteSquadPlayer(id);
  if (!ok) return { ok: false, error: "Could not remove the player." };
  revalidate();
  redirect("/app/squad");
}

export async function addNote(playerId: string, kind: PlayerNoteKind, body: string): Promise<Result> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Write the note first." };
  const ok = await addPlayerNote(playerId, kind, text);
  if (!ok) return { ok: false, error: "Could not save the note." };
  revalidate(playerId);
  return { ok: true };
}

export async function removeNote(playerId: string, noteId: string): Promise<Result> {
  const ok = await deletePlayerNote(noteId);
  if (!ok) return { ok: false, error: "Could not delete the note." };
  revalidate(playerId);
  return { ok: true };
}
