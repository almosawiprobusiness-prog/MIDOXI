import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "./store";
import type { FeedPost, PostComment, PostDetail } from "./community-types";

function rowToPost(
  p: Record<string, unknown>,
  reactionCount: number,
  commentCount: number,
  hasReacted: boolean
): FeedPost {
  const hasClip = Boolean(p.clip_title);
  return {
    id: p.id as string,
    userId: p.user_id as string,
    authorName: (p.author_name as string) ?? "Player",
    authorHandle: (p.author_handle as string) ?? null,
    authorPosition: (p.author_position as string) ?? null,
    authorAvatar: (p.author_avatar as string) ?? null,
    title: (p.title as string) ?? "",
    body: (p.body as string) ?? "",
    clip: hasClip
      ? {
          title: p.clip_title as string,
          start: Number(p.clip_start ?? 0),
          tags: (p.clip_tags as string[]) ?? [],
          sentiment: (p.clip_sentiment as string) ?? null,
          videoSource: (p.video_source as string) ?? null,
          videoExternalId: (p.video_external_id as string) ?? null,
        }
      : null,
    tags: (p.tags as string[]) ?? [],
    createdAt: (p.created_at as string) ?? new Date().toISOString(),
    reactionCount,
    commentCount,
    hasReacted,
  };
}

export async function listFeed(): Promise<FeedPost[]> {
  if (isDemoMode) return demoStore.listFeed();

  const supabase = await createClient();
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user?.id ?? "";

  const { data: posts } = await supabase
    .from("community_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (!posts?.length) return [];

  const ids = posts.map((p) => p.id as string);
  const [{ data: reactions }, { data: comments }] = await Promise.all([
    supabase.from("post_reactions").select("post_id, user_id").in("post_id", ids),
    supabase.from("post_comments").select("post_id").in("post_id", ids),
  ]);

  const rCount = new Map<string, number>();
  const mine = new Set<string>();
  for (const r of reactions ?? []) {
    rCount.set(r.post_id as string, (rCount.get(r.post_id as string) ?? 0) + 1);
    if (r.user_id === uid) mine.add(r.post_id as string);
  }
  const cCount = new Map<string, number>();
  for (const c of comments ?? []) cCount.set(c.post_id as string, (cCount.get(c.post_id as string) ?? 0) + 1);

  return posts.map((p) =>
    rowToPost(p, rCount.get(p.id as string) ?? 0, cCount.get(p.id as string) ?? 0, mine.has(p.id as string))
  );
}

export async function getPostDetail(id: string): Promise<PostDetail | null> {
  if (isDemoMode) return demoStore.getPost(id);

  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user?.id ?? "";

  const { data: p } = await supabase.from("community_posts").select("*").eq("id", id).maybeSingle();
  if (!p) return null;

  const [{ data: reactions }, { data: commentRows }] = await Promise.all([
    supabase.from("post_reactions").select("user_id").eq("post_id", id),
    supabase.from("post_comments").select("*").eq("post_id", id).order("created_at", { ascending: true }),
  ]);

  const comments: PostComment[] = (commentRows ?? []).map((c) => ({
    id: c.id as string,
    postId: c.post_id as string,
    userId: c.user_id as string,
    authorName: (c.author_name as string) ?? "Player",
    authorHandle: (c.author_handle as string) ?? null,
    body: (c.body as string) ?? "",
    createdAt: (c.created_at as string) ?? new Date().toISOString(),
  }));

  const post = rowToPost(
    p,
    (reactions ?? []).length,
    comments.length,
    (reactions ?? []).some((r) => r.user_id === uid)
  );
  return { post, comments };
}
