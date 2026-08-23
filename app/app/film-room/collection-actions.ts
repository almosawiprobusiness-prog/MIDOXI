"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "@/lib/data/store";
import { listCollections, clipMembership } from "@/lib/data/collections";
import type { Collection } from "@/lib/data/film-types";

export type Result = { ok: true; id?: string; demo?: boolean } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, userId: null };
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

function revalidate(id?: string) {
  revalidatePath("/app/film-room");
  if (id) revalidatePath(`/app/film-room/collections/${id}`);
}

export async function getClipCollectionState(
  clipId: string
): Promise<{ collections: Collection[]; memberOf: string[] }> {
  const [collections, memberOf] = await Promise.all([listCollections(), clipMembership(clipId)]);
  return { collections, memberOf };
}

export async function createCollection(name: string): Promise<Result> {
  if (!name?.trim()) return { ok: false, error: "Name the collection." };

  if (isDemoMode) {
    const id = demoStore.createCollection(name.trim());
    revalidate();
    return { ok: true, id, demo: true };
  }
  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };
  const { data, error } = await supabase.from("collections").insert({ name: name.trim() }).select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
}

export async function deleteCollection(id: string): Promise<Result> {
  if (isDemoMode) {
    demoStore.deleteCollection(id);
    revalidate();
    return { ok: true, demo: true };
  }
  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };
  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function setClipCollection(
  collectionId: string,
  clipId: string,
  member: boolean
): Promise<Result> {
  if (isDemoMode) {
    if (member) demoStore.addClipToCollection(collectionId, clipId);
    else demoStore.removeClipFromCollection(collectionId, clipId);
    revalidate(collectionId);
    return { ok: true, demo: true };
  }
  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };
  if (member) {
    const { error } = await supabase.from("collection_clips").insert({ collection_id: collectionId, clip_id: clipId });
    if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("collection_clips")
      .delete()
      .eq("collection_id", collectionId)
      .eq("clip_id", clipId);
    if (error) return { ok: false, error: error.message };
  }
  revalidate(collectionId);
  return { ok: true };
}
