"use server";

import { revalidatePath } from "next/cache";
import { createSection, updateSection, deleteSection, moveSection } from "@/lib/data/club";
import type { MethodologySectionInput } from "@/lib/data/club-types";

/*
  The methodology is the club's own words. MIDO never writes it — it only ever
  answers inside it. Every action here is a straight edit of what a person wrote.
*/

export type Result = { ok: true; id?: string } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/app/methodology");
  revalidatePath("/app/intelligence");
  revalidatePath("/app");
}

export async function addSection(input: MethodologySectionInput): Promise<Result> {
  if (!input.section.trim()) return { ok: false, error: "Name the section." };
  if (input.principles.length === 0) {
    return { ok: false, error: "A section needs at least one principle — that is what MIDO reads." };
  }
  const id = await createSection({ ...input, section: input.section.trim() });
  if (!id) return { ok: false, error: "Could not save the section." };
  revalidate();
  return { ok: true, id };
}

export async function editSection(id: string, input: MethodologySectionInput): Promise<Result> {
  if (!input.section.trim()) return { ok: false, error: "Name the section." };
  const ok = await updateSection(id, { ...input, section: input.section.trim() });
  if (!ok) return { ok: false, error: "Could not save the section." };
  revalidate();
  return { ok: true, id };
}

export async function removeSection(id: string): Promise<Result> {
  const ok = await deleteSection(id);
  if (!ok) return { ok: false, error: "Could not delete the section." };
  revalidate();
  return { ok: true };
}

export async function reorderSection(id: string, direction: -1 | 1): Promise<Result> {
  const ok = await moveSection(id, direction);
  if (!ok) return { ok: false, error: "Could not reorder." };
  revalidate();
  return { ok: true };
}
