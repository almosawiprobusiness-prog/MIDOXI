"use server";

import { revalidatePath } from "next/cache";
import {
  createTeam,
  updateTeam,
  deleteTeam,
  createStaff,
  updateStaff,
  deleteStaff,
} from "@/lib/data/club";
import type { TeamInput, StaffInput } from "@/lib/data/club-types";

/*
  Teams and staff share a module: in a club they are the same act — deciding
  who is responsible for which group of players.
*/

export type Result = { ok: true; id?: string } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/app/teams");
  revalidatePath("/app/staff");
  revalidatePath("/app/intelligence");
  revalidatePath("/app");
}

export async function addTeam(input: TeamInput): Promise<Result> {
  if (!input.name.trim()) return { ok: false, error: "Name the team." };
  const id = await createTeam({ ...input, name: input.name.trim() });
  if (!id) return { ok: false, error: "Could not create the team." };
  revalidate();
  return { ok: true, id };
}

export async function editTeam(id: string, input: TeamInput): Promise<Result> {
  if (!input.name.trim()) return { ok: false, error: "Name the team." };
  const ok = await updateTeam(id, { ...input, name: input.name.trim() });
  if (!ok) return { ok: false, error: "Could not save the team." };
  revalidate();
  return { ok: true, id };
}

export async function removeTeam(id: string): Promise<Result> {
  const ok = await deleteTeam(id);
  if (!ok) return { ok: false, error: "Could not delete the team." };
  revalidate();
  return { ok: true };
}

export async function addStaff(input: StaffInput): Promise<Result> {
  if (!input.name.trim()) return { ok: false, error: "Give the staff member a name." };
  const id = await createStaff({ ...input, name: input.name.trim() });
  if (!id) return { ok: false, error: "Could not add them." };
  revalidate();
  return { ok: true, id };
}

export async function editStaff(id: string, input: StaffInput): Promise<Result> {
  if (!input.name.trim()) return { ok: false, error: "Give the staff member a name." };
  const ok = await updateStaff(id, { ...input, name: input.name.trim() });
  if (!ok) return { ok: false, error: "Could not save them." };
  revalidate();
  return { ok: true, id };
}

export async function removeStaff(id: string): Promise<Result> {
  const ok = await deleteStaff(id);
  if (!ok) return { ok: false, error: "Could not remove them." };
  revalidate();
  return { ok: true };
}
