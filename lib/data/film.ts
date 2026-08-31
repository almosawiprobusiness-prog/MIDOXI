import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "./store";
import type { Video, FilmClip, VideoDetail, VideoSource, ClipSentiment } from "./film-types";

function rowToVideo(v: Record<string, unknown>): Video {
  return {
    id: v.id as string,
    title: (v.title as string) ?? "",
    source: (v.source as VideoSource) ?? "url",
    url: (v.external_url as string) ?? (v.storage_path as string) ?? "",
    externalId: (v.external_url as string)?.match(/[\w-]{11}/)?.[0],
    thumbnailUrl: (v.thumbnail_url as string) ?? undefined,
    durationSeconds: (v.duration_seconds as number) ?? null,
    pitchIdentityOverride: (v.pitch_identity_override as string) ?? null,
    matchId: (v.match_id as string) ?? null,
    status: (v.status as Video["status"]) ?? "ready",
    createdAt: (v.created_at as string) ?? new Date().toISOString(),
  };
}

function rowToClip(c: Record<string, unknown>, tags: string[]): FilmClip {
  return {
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
    tags,
    createdAt: (c.created_at as string) ?? new Date().toISOString(),
  };
}

async function clipsWithTags(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, clipRows: Record<string, unknown>[]) {
  if (clipRows.length === 0) return [];
  const ids = clipRows.map((c) => c.id as string);
  const { data: tagRows } = await supabase.from("clip_tags").select("clip_id, tag").in("clip_id", ids);
  const tagMap = new Map<string, string[]>();
  for (const t of tagRows ?? []) {
    const key = t.clip_id as string;
    if (!tagMap.has(key)) tagMap.set(key, []);
    tagMap.get(key)!.push(t.tag as string);
  }
  return clipRows.map((c) => rowToClip(c, tagMap.get(c.id as string) ?? []));
}

export async function listVideos(): Promise<Video[]> {
  if (isDemoMode) return demoStore.listVideos();
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from("videos").select("*").order("created_at", { ascending: false });
  const videos = (data ?? []).map(rowToVideo);

  /*
    Uploads carry a storage PATH, not a URL — nothing can play or even
    peek at one. Signed here in a single batch call so a library page
    can show a real frame from each video instead of a grey rectangle,
    and so `url` means the same thing for every source.

    Batched deliberately: signing one at a time is a round trip per
    video, which on a full library is the slowest thing on the page.
  */
  const uploads = videos.filter((v) => v.source === "upload" && v.url && !v.url.startsWith("http"));
  if (uploads.length > 0) {
    const { data: signed } = await supabase.storage
      .from("videos")
      .createSignedUrls(uploads.map((v) => v.url), 3600);
    const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    for (const v of uploads) {
      const url = byPath.get(v.url);
      if (url) v.url = url;
    }
  }

  return videos;
}

export async function getVideoWithClips(id: string): Promise<VideoDetail | null> {
  if (isDemoMode) return demoStore.getVideo(id);
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: v } = await supabase.from("videos").select("*").eq("id", id).maybeSingle();
  if (!v) return null;
  const { data: clipRows } = await supabase
    .from("clips")
    .select("*")
    .eq("video_id", id)
    .order("start_seconds", { ascending: true });
  const clips = await clipsWithTags(supabase, clipRows ?? []);

  const video = rowToVideo(v);
  // Private bucket → sign a short-lived playback URL for uploaded footage.
  if (video.source === "upload" && v.storage_path) {
    const { data: signed } = await supabase.storage
      .from("videos")
      .createSignedUrl(v.storage_path as string, 3600);
    if (signed?.signedUrl) video.url = signed.signedUrl;
  }
  return { video, clips };
}

/*
  Backfill a video's length once it is learned after the fact — videos
  added before duration fetching existed, or while the YouTube key was
  down. Fail-soft: a false return means the length stays unknown, and
  callers can still use the fetched value for the current request.
*/
/**
 * This match's "how to spot you". Kits change between fixtures; the override
 * lives on the video row and beats the profile identity for reads of it.
 * Empty string clears it back to the profile.
 */
export async function setPitchIdentityOverride(videoId: string, identity: string): Promise<boolean> {
  const value = identity.trim().slice(0, 140) || null;
  if (isDemoMode) return true;
  const supabase = await createClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from("videos")
    .update({ pitch_identity_override: value })
    .eq("id", videoId);
  return !error;
}

export async function setVideoDuration(id: string, seconds: number): Promise<boolean> {
  if (!Number.isFinite(seconds) || seconds <= 0) return false;
  if (isDemoMode) return demoStore.setVideoDuration(id, seconds);
  const supabase = await createClient();
  if (!supabase) return false;
  const { error } = await supabase.from("videos").update({ duration_seconds: Math.round(seconds) }).eq("id", id);
  return !error;
}

export async function listClips(): Promise<FilmClip[]> {
  if (isDemoMode) return demoStore.listClips();
  const supabase = await createClient();
  if (!supabase) return [];
  const { data: clipRows } = await supabase.from("clips").select("*").order("created_at", { ascending: false });
  return clipsWithTags(supabase, clipRows ?? []);
}
