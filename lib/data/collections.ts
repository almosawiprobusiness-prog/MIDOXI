import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "./store";
import type { Collection, CollectionDetail, FilmClip, ClipSentiment } from "./film-types";

export async function listCollections(): Promise<Collection[]> {
  if (isDemoMode) return demoStore.listCollections();
  const supabase = await createClient();
  if (!supabase) return [];
  const [{ data: cols }, { data: links }] = await Promise.all([
    supabase.from("collections").select("*").order("created_at", { ascending: false }),
    supabase.from("collection_clips").select("collection_id"),
  ]);
  const counts = new Map<string, number>();
  for (const l of links ?? []) counts.set(l.collection_id as string, (counts.get(l.collection_id as string) ?? 0) + 1);
  return (cols ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    createdAt: (c.created_at as string) ?? new Date().toISOString(),
    clipCount: counts.get(c.id as string) ?? 0,
  }));
}

export async function getCollectionDetail(id: string): Promise<CollectionDetail | null> {
  if (isDemoMode) return demoStore.getCollection(id);
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: col } = await supabase.from("collections").select("*").eq("id", id).maybeSingle();
  if (!col) return null;

  const { data: links } = await supabase.from("collection_clips").select("clip_id").eq("collection_id", id);
  const ids = (links ?? []).map((l) => l.clip_id as string);
  let clips: FilmClip[] = [];
  if (ids.length) {
    const { data: clipRows } = await supabase.from("clips").select("*").in("id", ids);
    const { data: tagRows } = await supabase.from("clip_tags").select("clip_id, tag").in("clip_id", ids);
    const tagMap = new Map<string, string[]>();
    for (const t of tagRows ?? []) {
      const key = t.clip_id as string;
      if (!tagMap.has(key)) tagMap.set(key, []);
      tagMap.get(key)!.push(t.tag as string);
    }
    clips = (clipRows ?? []).map((c) => ({
      id: c.id as string,
      videoId: (c.video_id as string) ?? "",
      matchId: (c.match_id as string) ?? null,
      goalId: (c.goal_id as string) ?? null,
      title: (c.title as string) ?? "",
      startSeconds: Number(c.start_seconds ?? 0),
      endSeconds: c.end_seconds == null ? null : Number(c.end_seconds),
      sentiment: (c.sentiment as ClipSentiment) ?? null,
      note: (c.note as string) ?? "",
      favorite: (c.favorite as boolean) ?? false,
      tags: tagMap.get(c.id as string) ?? [],
      createdAt: (c.created_at as string) ?? new Date().toISOString(),
    }));
  }

  return {
    collection: { id: col.id as string, name: col.name as string, createdAt: (col.created_at as string) ?? "", clipCount: clips.length },
    clips,
  };
}

/** Which collections a clip belongs to (ids). */
export async function clipMembership(clipId: string): Promise<string[]> {
  if (isDemoMode) return demoStore.clipMembership(clipId);
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from("collection_clips").select("collection_id").eq("clip_id", clipId);
  return (data ?? []).map((r) => r.collection_id as string);
}
