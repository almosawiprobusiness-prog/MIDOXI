"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "@/lib/data/store";
import { player } from "@/lib/seed";
import { notify } from "@/lib/notifications/notify";

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

  const { data: post } = await supabase
    .from("community_posts")
    .select("user_id, caption, title")
    .eq("id", postId)
    .maybeSingle();
  if (post?.user_id) {
    const name = String(prof?.known_as || prof?.full_name || "Someone").trim();
    await notify({
      userId: String(post.user_id),
      actorId: userId,
      kind: "comment",
      title: `${name} commented on your post`,
      body: body.trim(),
      href: `/app/community/posts/${postId}`,
    });
  }

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

