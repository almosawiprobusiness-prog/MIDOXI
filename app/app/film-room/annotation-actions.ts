"use server";

import { revalidatePath } from "next/cache";
import { track } from "@/lib/analytics/track";
import {
  saveAnnotation as save,
  deleteAnnotation as remove,
} from "@/lib/data/annotations";
import { sanitizeShapes, noteIssue, type Annotation, type Shape } from "@/lib/data/annotation-types";

/*
  Drawing on a frame, and undoing it.

  The client sends shapes it has already validated. This validates them
  again — a server action is a public endpoint, and the browser is not
  a trusted source of the JSON that ends up in a jsonb column.
*/

export type AnnotationResult =
  | { ok: true; annotation: Annotation }
  | { ok: false; error: string };

export async function createAnnotation(input: {
  videoId: string;
  atSeconds: number;
  shapes: Shape[];
  note?: string;
}): Promise<AnnotationResult> {
  if (!input.videoId) return { ok: false, error: "Which video?" };

  const shapes = sanitizeShapes(input.shapes);
  if (shapes.length === 0) return { ok: false, error: "Draw something first." };

  const note = (input.note ?? "").trim();
  const issue = noteIssue(note);
  if (issue) return { ok: false, error: issue };

  const annotation = await save({
    videoId: input.videoId,
    atSeconds: Number(input.atSeconds) || 0,
    shapes,
    note,
  });
  if (!annotation) return { ok: false, error: "Could not save the drawing." };

  await track("annotation_saved", { shapes: input.shapes.length });
  revalidatePath(`/app/film-room/${input.videoId}`);
  return { ok: true, annotation };
}

export async function removeAnnotation(
  id: string,
  videoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const done = await remove(id);
  if (!done) return { ok: false, error: "Could not delete that drawing." };
  revalidatePath(`/app/film-room/${videoId}`);
  return { ok: true };
}
