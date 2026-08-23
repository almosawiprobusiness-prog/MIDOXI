"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAthlete,
  updateAthlete,
  deleteAthlete,
  addAthleteNote,
  deleteAthleteNote,
} from "@/lib/data/trainer";
import type { AthleteInput, AthleteNoteKind } from "@/lib/data/trainer-types";

export type Result = { ok: true; id?: string } | { ok: false; error: string };

function revalidate(id?: string) {
  revalidatePath("/app/athletes");
  revalidatePath("/app");
  if (id) revalidatePath(`/app/athletes/${id}`);
}

export async function addAthlete(input: AthleteInput): Promise<Result> {
  if (!input.name.trim()) return { ok: false, error: "Give the athlete a name." };
  const id = await createAthlete({ ...input, name: input.name.trim() });
  if (!id) return { ok: false, error: "Could not add the athlete." };
  revalidate();
  return { ok: true, id };
}

export async function editAthlete(id: string, input: AthleteInput): Promise<Result> {
  if (!input.name.trim()) return { ok: false, error: "Give the athlete a name." };
  const ok = await updateAthlete(id, { ...input, name: input.name.trim() });
  if (!ok) return { ok: false, error: "Could not save the athlete." };
  revalidate(id);
  return { ok: true, id };
}

export async function removeAthlete(id: string): Promise<Result> {
  const ok = await deleteAthlete(id);
  if (!ok) return { ok: false, error: "Could not remove the athlete." };
  revalidate();
  redirect("/app/athletes");
}

export async function addNote(athleteId: string, kind: AthleteNoteKind, body: string): Promise<Result> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Write the note first." };
  const ok = await addAthleteNote(athleteId, kind, text);
  if (!ok) return { ok: false, error: "Could not save the note." };
  revalidate(athleteId);
  return { ok: true };
}

export async function removeNote(athleteId: string, noteId: string): Promise<Result> {
  const ok = await deleteAthleteNote(noteId);
  if (!ok) return { ok: false, error: "Could not delete the note." };
  revalidate(athleteId);
  return { ok: true };
}
