import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "./store";
import { collectionReelOrder } from "./film-types";
import type { Collection, CollectionDetail, FilmClip, ClipSentiment, ReelItem } from "./film-types";
import { listVideos } from "./film";
import { listAnnotationsForVideos } from "./annotations";
import type { Annotation } from "./annotation-types";

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

/**
 * Everything needed to PLAY a collection, not just list it.
 *
 * A collection spans videos, so each clip has to arrive carrying its own
 * source. Uploaded footage lives in a private bucket and needs a signed
 * URL — signed once per video here rather than once per clip, since a
 * collection of thirty clips routinely comes from a handful of matches.
 *
 * Those URLs expire, which is the reason this is built fresh on every
 * request and never cached.
 */
export async function getCollectionReel(id: string): Promise<{
  collection: Collection;
  items: ReelItem[];
  annotations: Annotation[];
} | null> {
  const detail = await getCollectionDetail(id);
  if (!detail) return null;

  const videoIds = [...new Set(detail.clips.map((c) => c.videoId).filter(Boolean))];
  if (videoIds.length === 0) {
    return { collection: detail.collection, items: [], annotations: [] };
  }

  /*
    Videos oldest first. That is the order the reel plays them in —
    match by match — so it is settled here, where the created dates
    are, rather than guessed at in the browser.
  */
  const videos = (await listVideos())
    .filter((v) => videoIds.includes(v.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const supabase = isDemoMode ? null : await createClient();
  const sources = new Map<string, ReelItem["video"]>();

  for (const v of videos) {
    let url = v.url;
    /*
      Signed per video, and only for uploads. `listVideos` returns the
      storage path for those, which is not playable on its own.
    */
    if (v.source === "upload" && supabase && url && !url.startsWith("http")) {
      const { data: signed } = await supabase.storage.from("videos").createSignedUrl(url, 3600);
      if (signed?.signedUrl) url = signed.signedUrl;
    }
    sources.set(v.id, {
      id: v.id,
      title: v.title,
      source: v.source,
      url,
      externalId: v.externalId,
    });
  }

  const items: ReelItem[] = [];
  for (const clip of detail.clips) {
    const video = sources.get(clip.videoId);
    // A clip whose video is gone is dropped rather than played as a
    // black rectangle with no explanation.
    if (video) items.push({ clip, video });
  }

  const annotations = await listAnnotationsForVideos(videoIds);

  return {
    collection: detail.collection,
    items: collectionReelOrder(items, videos.map((v) => v.id)),
    annotations,
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
