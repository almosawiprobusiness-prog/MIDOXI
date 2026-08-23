"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "@/lib/data/store";
import { player } from "@/lib/seed";
import { youtubeId } from "@/lib/data/film-types";
import type { PostInput } from "@/lib/data/community-types";

export type Result = { ok: true; id?: string; demo?: boolean } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, userId: null };
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

function revalidate(id?: string) {
  revalidatePath("/app/community");
  if (id) revalidatePath(`/app/community/posts/${id}`);
}

export async function createPost(input: PostInput): Promise<Result> {
  if (!input.title?.trim()) return { ok: false, error: "Give your post a title." };
  if (!input.body?.trim()) return { ok: false, error: "Add your analysis." };

  if (isDemoMode) {
    let clip = null;
    if (input.clipId) {
      const c = demoStore.getClipById(input.clipId);
      if (c) {
        const v = demoStore.getVideo(c.videoId)?.video;
        clip = {
          title: c.title, start: c.startSeconds, tags: c.tags, sentiment: c.sentiment ?? null,
          videoSource: v?.source ?? null, videoExternalId: v?.externalId ?? null,
        };
      }
    }
    const id = demoStore.createPost({
      userId: "demo", authorName: player.knownAs, authorHandle: "mido9",
      authorPosition: player.primaryPosition, authorAvatar: null,
      title: input.title.trim(), body: input.body.trim(), clip, tags: input.tags ?? [],
    });
    revalidate();
    return { ok: true, id, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const [{ data: prof }, { data: pp }] = await Promise.all([
    supabase.from("profiles").select("full_name, known_as, avatar_url").eq("id", userId).maybeSingle(),
    supabase.from("player_profiles").select("handle, primary_position").eq("user_id", userId).maybeSingle(),
  ]);

  // Snapshot the clip (so shared clips render without exposing private tables).
  let clipSnap: Record<string, unknown> = {};
  if (input.clipId) {
    const { data: c } = await supabase.from("clips").select("title, start_seconds, sentiment, video_id").eq("id", input.clipId).maybeSingle();
    if (c) {
      const { data: tagRows } = await supabase.from("clip_tags").select("tag").eq("clip_id", input.clipId);
      const { data: vid } = await supabase.from("videos").select("source, external_url").eq("id", c.video_id as string).maybeSingle();
      const ytId = vid?.external_url ? youtubeId(vid.external_url as string) : null;
      clipSnap = {
        clip_id: input.clipId,
        clip_title: c.title,
        clip_start: c.start_seconds,
        clip_tags: (tagRows ?? []).map((t) => t.tag),
        clip_sentiment: c.sentiment ?? null,
        video_source: (vid?.source as string) ?? null,
        video_external_id: ytId,
      };
    }
  }

  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      author_name: prof?.known_as || prof?.full_name || "Player",
      author_handle: pp?.handle ?? null,
      author_position: pp?.primary_position ?? null,
      author_avatar: prof?.avatar_url ?? null,
      title: input.title.trim(),
      body: input.body.trim(),
      tags: input.tags ?? [],
      ...clipSnap,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
}

export async function deletePost(id: string): Promise<Result> {
  if (isDemoMode) { demoStore.deletePost(id); revalidate(); return { ok: true, demo: true }; }
  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };
  const { error } = await supabase.from("community_posts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function addComment(postId: string, body: string): Promise<Result> {
  if (!body?.trim()) return { ok: false, error: "Write a comment." };

  if (isDemoMode) {
    const id = demoStore.addComment({ postId, userId: "demo", authorName: player.knownAs, authorHandle: "mido9", body: body.trim() });
    revalidate(postId);
    return { ok: true, id, demo: true };
  }
  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };
  const [{ data: prof }, { data: pp }] = await Promise.all([
    supabase.from("profiles").select("known_as, full_name").eq("id", userId).maybeSingle(),
    supabase.from("player_profiles").select("handle").eq("user_id", userId).maybeSingle(),
  ]);
  const { error } = await supabase.from("post_comments").insert({
    post_id: postId,
    author_name: prof?.known_as || prof?.full_name || "Player",
    author_handle: pp?.handle ?? null,
    body: body.trim(),
  });
  if (error) return { ok: false, error: error.message };
  revalidate(postId);
  return { ok: true };
}

export async function deleteComment(id: string, postId: string): Promise<Result> {
  if (isDemoMode) { demoStore.deleteComment(id); revalidate(postId); return { ok: true, demo: true }; }
  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };
  const { error } = await supabase.from("post_comments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate(postId);
  return { ok: true };
}

export async function toggleReaction(postId: string): Promise<Result> {
  if (isDemoMode) { demoStore.toggleReaction(postId); revalidate(postId); return { ok: true, demo: true }; }
  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { data: existing } = await supabase
    .from("post_reactions").select("post_id").eq("post_id", postId).eq("user_id", userId).maybeSingle();
  if (existing) {
    await supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", userId);
  } else {
    await supabase.from("post_reactions").insert({ post_id: postId });
  }
  revalidate(postId);
  return { ok: true };
}
