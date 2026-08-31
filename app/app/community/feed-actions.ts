"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { getProfileSettings } from "@/lib/data/profile";
import { postIssue, mediaIssue, captionIssue, youtubeId, type Visibility, type PostKind, POST_KINDS } from "@/lib/data/feed-types";
import { notify } from "@/lib/notifications/notify";
import { track } from "@/lib/analytics/track";

/*
  Everything a person can do in the feed.

  Two things run through all of it.

  The author's name, handle, position and avatar are COPIED onto each post
  rather than joined at read time. That was already true here and it is worth
  keeping: it means a public feed never has to read `player_profiles`, so a
  private profile cannot leak through a post, and a post keeps the identity it
  was written under.

  Blocking and reporting are ordinary features rather than an admin afterthought.
  Anybody can use them, immediately, without asking anyone.
*/

export type FeedResult = { ok: true; id?: string } | { ok: false; error: string };

async function me() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, userId: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

function refresh() {
  revalidatePath("/app/community");
  revalidatePath("/app/community", "layout");
}

/** My own name and handle, for the notifications this file sends on my behalf. */
async function myIdentity(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  userId: string,
): Promise<{ name: string; handle: string | null }> {
  const [{ data: profile }, { data: pp }] = await Promise.all([
    supabase.from("profiles").select("known_as, full_name").eq("id", userId).maybeSingle(),
    supabase.from("player_profiles").select("handle").eq("user_id", userId).maybeSingle(),
  ]);
  return {
    name: String(profile?.known_as || profile?.full_name || "Someone").trim(),
    handle: (pp?.handle as string) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Posting
// ---------------------------------------------------------------------------

export interface NewPost {
  caption: string;
  /** A data URL from the browser — photo already resized, or a short video. */
  media?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  /** A YouTube link, as an alternative to uploading. */
  youtubeUrl?: string | null;
  tags?: string[];
  /** What the post is about; omitted for a general post. */
  kind?: PostKind | null;
  visibility?: Visibility;
}

export async function createPost(input: NewPost): Promise<FeedResult> {
  const yt = input.youtubeUrl ? youtubeId(input.youtubeUrl) : null;
  if (input.youtubeUrl && !yt) {
    return { ok: false, error: "That does not look like a YouTube link." };
  }

  const issue = postIssue({
    caption: input.caption,
    hasMedia: Boolean(input.media || yt),
  });
  if (issue) return { ok: false, error: issue };

  if (isDemoMode) {
    refresh();
    return { ok: true };
  }

  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const profile = await getProfileSettings();

  let mediaUrl: string | null = yt;
  let mediaKind: string | null = yt ? "youtube" : null;

  if (input.media) {
    const uploaded = await uploadMedia(userId, input.media);
    if (!uploaded.ok) return { ok: false, error: uploaded.error };
    mediaUrl = uploaded.url;
    mediaKind = uploaded.kind;
  }

  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      user_id: userId,
      // Copied, not joined. See the note at the top of this file.
      author_name: profile.knownAs || profile.fullName || "Player",
      author_handle: profile.handle || null,
      author_position: profile.primaryPosition || null,
      author_avatar: profile.avatarUrl || null,
      caption: input.caption.trim() || null,
      media_url: mediaUrl,
      media_kind: mediaKind,
      media_width: input.mediaWidth ?? null,
      media_height: input.mediaHeight ?? null,
      tags: input.tags?.length ? input.tags : null,
      kind: input.kind && POST_KINDS.some((k) => k.value === input.kind) ? input.kind : null,
      visibility: input.visibility ?? "public",
    })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  await track("community_post_created", { kind: input.kind ?? "general", hasMedia: Boolean(mediaUrl) });
  refresh();
  return { ok: true, id: data?.id as string };
}

/*
  Media goes to a PUBLIC bucket, at a path built from the session's user id.

  Written with the admin client for the same reason avatars are: the
  alternative is four RLS policies on `storage.objects`, which is owned by
  `supabase_storage_admin` and cannot be policed from the SQL editor. No caller
  input reaches the path, so nobody can write into anyone else's folder.

  Unlike an avatar the filename is random, because a post is not a singleton —
  a fixed name would mean each new post overwrote the last one's picture.
*/
async function uploadMedia(
  userId: string,
  dataUrl: string,
): Promise<{ ok: true; url: string; kind: string } | { ok: false; error: string }> {
  const match = /^data:(image\/(?:jpeg|png|webp)|video\/(?:mp4|webm));base64,(.+)$/.exec(dataUrl);
  if (!match) return { ok: false, error: "That file could not be read." };

  const [, mime, b64] = match;
  const bytes = Buffer.from(b64, "base64");

  const issue = mediaIssue({ type: mime, size: bytes.byteLength });
  if (issue) return { ok: false, error: issue };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Storage is not configured on this deployment." };

  const ext = mime.split("/")[1].replace("jpeg", "jpg");
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await admin.storage
    .from("posts")
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (error) {
    return {
      ok: false,
      error: /bucket/i.test(error.message)
        ? "The posts bucket does not exist on this project yet."
        : error.message,
    };
  }

  const { data } = admin.storage.from("posts").getPublicUrl(path);
  return { ok: true, url: data.publicUrl, kind: mime.startsWith("video") ? "video" : "photo" };
}

/**
 * Change what a post says. The caption only — media is what the post IS, and
 * swapping the picture under existing reactions and comments would make them
 * refer to something their authors never saw. Delete and repost for that.
 */
export async function updatePost(id: string, caption: string): Promise<FeedResult> {
  const issue = captionIssue(caption);
  if (issue) return { ok: false, error: issue };

  if (isDemoMode) {
    refresh();
    return { ok: true };
  }
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  // A caption can be emptied only when media keeps the post from being
  // nothing; the DB's not-empty check is the final word either way.
  const { error } = await supabase
    .from("community_posts")
    .update({ caption: caption.trim() || null })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deletePost(id: string): Promise<FeedResult> {
  if (isDemoMode) {
    refresh();
    return { ok: true };
  }
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  // Read the media URL first: the row is about to go, and a deleted post's
  // photo left behind in a public bucket is a post that only half-deleted.
  const { data: row } = await supabase
    .from("community_posts")
    .select("media_url, media_kind")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  // RLS already restricts this to the author; the filter makes that visible.
  const { error } = await supabase.from("community_posts").delete().eq("id", id).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  // Best-effort object removal — only for uploads (a YouTube post stores an
  // id, not an object), and only within this user's own folder.
  if (row?.media_url && row.media_kind !== "youtube") {
    const path = String(row.media_url).split("/object/public/posts/")[1];
    if (path && path.startsWith(`${userId}/`)) {
      const admin = createAdminClient();
      if (admin) await admin.storage.from("posts").remove([path]);
    }
  }

  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

/**
 * A private bookmark. No notification to the author and no count anywhere —
 * the entire point of a save is that it is between the player and their own
 * development, not a public signal.
 */
export async function toggleSave(postId: string): Promise<{ ok: boolean; saved?: boolean; error?: string }> {
  if (isDemoMode) return { ok: true, saved: true };

  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { data: existing } = await supabase
    .from("post_saves")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase.from("post_saves").delete().eq("post_id", postId).eq("user_id", userId);
    refresh();
    return { ok: true, saved: false };
  }

  const { error } = await supabase.from("post_saves").insert({ post_id: postId, user_id: userId });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, saved: true };
}

// ---------------------------------------------------------------------------
// Following
// ---------------------------------------------------------------------------

export async function toggleFollow(targetId: string): Promise<{ ok: boolean; following?: boolean; error?: string }> {
  if (isDemoMode) return { ok: true, following: true };

  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };
  if (targetId === userId) return { ok: false, error: "You cannot follow yourself." };

  const { data: existing } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", userId)
    .eq("following_id", targetId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", userId)
      .eq("following_id", targetId);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, following: false };
  }

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: userId, following_id: targetId });
  if (error) return { ok: false, error: error.message };

  const { name, handle } = await myIdentity(supabase, userId);
  await notify({
    userId: targetId,
    actorId: userId,
    kind: "follow",
    title: `${name} started following you`,
    href: handle ? `/app/community/${handle}` : `/app/community/players/${userId}`,
  });

  refresh();
  return { ok: true, following: true };
}

// ---------------------------------------------------------------------------
// Liking
// ---------------------------------------------------------------------------

export async function toggleLike(postId: string): Promise<{ ok: boolean; liked?: boolean; error?: string }> {
  if (isDemoMode) return { ok: true, liked: true };

  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { data: existing } = await supabase
    .from("post_reactions")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", userId);
    refresh();
    return { ok: true, liked: false };
  }

  const { error } = await supabase.from("post_reactions").insert({ post_id: postId, user_id: userId });
  if (error) return { ok: false, error: error.message };

  const { data: post } = await supabase
    .from("community_posts")
    .select("user_id, caption, title")
    .eq("id", postId)
    .maybeSingle();
  if (post?.user_id) {
    const { name } = await myIdentity(supabase, userId);
    await notify({
      userId: String(post.user_id),
      actorId: userId,
      kind: "like",
      title: `${name} liked your post`,
      body: (post.caption as string) || (post.title as string) || null,
      href: `/app/community/posts/${postId}`,
    });
  }

  refresh();
  return { ok: true, liked: true };
}

// ---------------------------------------------------------------------------
// Blocking and reporting
// ---------------------------------------------------------------------------

/**
 * Stop seeing them, and stop them seeing you.
 *
 * Takes effect on the next read, in both directions — `lib/data/feed.ts`
 * applies it. Following is removed both ways too: a block that leaves a follow
 * in place is a block that still delivers their posts to somebody's Following
 * tab.
 */
export async function blockUser(targetId: string): Promise<FeedResult> {
  if (isDemoMode) return { ok: true };

  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };
  if (targetId === userId) return { ok: false, error: "You cannot block yourself." };

  const { error } = await supabase
    .from("user_blocks")
    .upsert({ blocker_id: userId, blocked_id: targetId }, { onConflict: "blocker_id,blocked_id" });
  if (error) return { ok: false, error: error.message };

  // Both directions. RLS allows deleting only rows where I am the follower, so
  // the other side goes through the admin client.
  await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", targetId);
  const admin = createAdminClient();
  if (admin) {
    await admin.from("follows").delete().eq("follower_id", targetId).eq("following_id", userId);
  }

  refresh();
  return { ok: true };
}

export async function unblockUser(targetId: string): Promise<FeedResult> {
  if (isDemoMode) return { ok: true };
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", userId)
    .eq("blocked_id", targetId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/**
 * Ask a person to look at something.
 *
 * Nothing automated happens as a result — a report is not a vote that deletes
 * a post. It lands in a queue only an admin can read, and one person can file
 * one report per post, so it is a signal rather than a score to run up.
 */
export async function reportPost(
  postId: string,
  reason: string,
  detail?: string,
): Promise<FeedResult> {
  if (isDemoMode) return { ok: true };

  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase
    .from("post_reports")
    .upsert(
      { post_id: postId, reporter_id: userId, reason, detail: detail?.trim() || null },
      { onConflict: "post_id,reporter_id" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Who this person has blocked, so they can undo it. */
export async function myBlocks(): Promise<{ id: string; name: string }[]> {
  if (isDemoMode) return [];
  const { supabase, userId } = await me();
  if (!supabase || !userId) return [];

  const { data } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", userId);
  const ids = (data ?? []).map((r) => String(r.blocked_id));
  if (ids.length === 0) return [];

  const { data: people } = await supabase
    .from("profiles")
    .select("id, known_as, full_name")
    .in("id", ids);
  return (people ?? []).map((p) => ({
    id: String(p.id),
    name: (p.known_as as string) || (p.full_name as string) || "Player",
  }));
}
