import "server-only";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { sanitizeShapes, NOTE_MAX, type Annotation, type Shape } from "./annotation-types";

/*
  Saved telestration. Same adapter contract as every other data module:
  a demo branch that works with no keys, and a Supabase branch that lets
  RLS do the access control rather than re-deciding it here.

  Every write runs `sanitizeShapes` again on the way in. The canvas
  already produces valid shapes and the action already filters them —
  but `shapes` is a jsonb column, and Postgres will store whatever JSON
  it is handed. A server action is a public HTTP endpoint; the only
  validation that counts is the one on this side of it.
*/

interface DemoDB {
  annotations: Annotation[];
  seq: number;
}
const g = globalThis as unknown as { __midoAnnotationDB?: DemoDB };
const demoDB: DemoDB = (g.__midoAnnotationDB ??= { annotations: [], seq: 1 });

function rowTo(r: Record<string, unknown>): Annotation {
  return {
    id: r.id as string,
    videoId: r.video_id as string,
    atSeconds: Number(r.at_seconds ?? 0),
    shapes: sanitizeShapes(r.shapes),
    note: (r.note as string) || null,
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

/** Everything drawn on one video, in the order it happens on the tape. */
export async function listAnnotations(videoId: string): Promise<Annotation[]> {
  if (isDemoMode) {
    return demoDB.annotations
      .filter((a) => a.videoId === videoId)
      .sort((a, b) => a.atSeconds - b.atSeconds);
  }
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("video_annotations")
    .select("*")
    .eq("video_id", videoId)
    .order("at_seconds", { ascending: true })
    .limit(200);
  return (data ?? []).map(rowTo);
}

export async function saveAnnotation(input: {
  videoId: string;
  atSeconds: number;
  shapes: Shape[];
  note?: string;
}): Promise<Annotation | null> {
  const shapes = sanitizeShapes(input.shapes);
  if (shapes.length === 0) return null;
  const note = (input.note ?? "").trim().slice(0, NOTE_MAX) || null;
  const at = Math.max(0, input.atSeconds);

  if (isDemoMode) {
    const row: Annotation = {
      id: `ann${demoDB.seq++}`,
      videoId: input.videoId,
      atSeconds: at,
      shapes,
      note,
      createdAt: new Date().toISOString(),
    };
    demoDB.annotations.push(row);
    return row;
  }

  const supabase = await createClient();
  if (!supabase) return null;
  const user = await getAuthUser();
  if (!user) return null;

  const { data } = await supabase
    .from("video_annotations")
    .insert({
      user_id: user.id,
      video_id: input.videoId,
      at_seconds: at,
      shapes,
      note,
    })
    .select("*")
    .maybeSingle();
  return data ? rowTo(data) : null;
}

export async function deleteAnnotation(id: string): Promise<boolean> {
  if (isDemoMode) {
    const i = demoDB.annotations.findIndex((a) => a.id === id);
    if (i < 0) return false;
    demoDB.annotations.splice(i, 1);
    return true;
  }
  const supabase = await createClient();
  if (!supabase) return false;
  // No user_id filter: RLS already restricts this to the owner's rows,
  // and adding one here would be a second, driftable copy of that rule.
  const { error } = await supabase.from("video_annotations").delete().eq("id", id);
  return !error;
}
