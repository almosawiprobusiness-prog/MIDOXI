"use server";

import { revalidatePath } from "next/cache";
import {
  addMemory,
  deleteMemory,
  listMemory,
  proposeMemories,
  updateMemory,
} from "@/lib/data/memory";
import { memoryIssue, type MemoryKind } from "@/lib/data/memory-types";

/*
  Everything a player can do to what MIDO remembers about them.

  Every one of these is theirs. There is no path here for MIDO to write a
  memory on its own, and no path for a coach to write one at all — a memory is
  injected into every future prompt, so a fact nobody agreed to would quietly
  shape every answer from then on.

  Revalidation is broad on purpose: memory changes what the film reader and the
  study engine say, so the pages that call them have to stop serving a cached
  answer built on the old facts.
*/

export type MemoryResult = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/app/memory");
  revalidatePath("/app/settings");
  revalidatePath("/app/film-room", "layout");
  revalidatePath("/app/study", "layout");
  revalidatePath("/app");
}

export async function createMemory(input: {
  kind: MemoryKind;
  body: string;
  concept?: string | null;
  because?: string | null;
  /** Set only when confirming a proposal MIDO derived from the record. */
  fromProposal?: boolean;
}): Promise<MemoryResult> {
  const issue = memoryIssue(input.body);
  if (issue) return { ok: false, error: issue };

  const saved = await addMemory({
    kind: input.kind,
    body: input.body,
    concept: input.concept ?? null,
    because: input.because ?? null,
    // 'mido' means MIDO proposed it and the player accepted — never that MIDO
    // decided alone.
    source: input.fromProposal ? "mido" : "self",
  });
  if (!saved) return { ok: false, error: "It could not be saved." };

  refresh();
  return { ok: true };
}

export async function editMemory(id: string, body: string): Promise<MemoryResult> {
  const issue = memoryIssue(body);
  if (issue) return { ok: false, error: issue };
  const ok = await updateMemory(id, body);
  if (!ok) return { ok: false, error: "It could not be updated." };
  refresh();
  return { ok: true };
}

export async function forgetMemory(id: string): Promise<MemoryResult> {
  const ok = await deleteMemory(id);
  if (!ok) return { ok: false, error: "It could not be removed." };
  refresh();
  return { ok: true };
}

/** Things worth remembering, counted from the record. Read-only. */
export async function suggestMemories() {
  return proposeMemories();
}

export async function currentMemory() {
  return listMemory();
}
