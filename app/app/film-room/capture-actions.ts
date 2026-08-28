"use server";

import { revalidatePath } from "next/cache";
import { track } from "@/lib/analytics/track";
import { deleteCapture } from "@/lib/data/captures";

/*
  The Player OS side of captured moments.

  markCaptureOpened is the third leg of the extension's funnel — a
  moment was not just saved but come back to, which is the behaviour
  the whole experiment exists to measure. It records THAT a moment was
  opened, never what it said.
*/

export async function markCaptureOpened(captureId: string): Promise<void> {
  if (!/^[\w:-]{1,64}$/.test(captureId)) return;
  await track("capture_opened_in_mido", { captureId });
}

export type Result = { ok: true } | { ok: false; error: string };

export async function removeCapture(id: string): Promise<Result> {
  if (!/^[\w:-]{1,64}$/.test(id)) return { ok: false, error: "Not a capture id." };
  const done = await deleteCapture(id);
  if (!done) return { ok: false, error: "Could not delete the moment." };
  revalidatePath("/app/film-room");
  return { ok: true };
}
