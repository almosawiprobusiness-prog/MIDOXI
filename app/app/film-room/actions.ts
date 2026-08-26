"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "@/lib/data/store";
import { videoUrlKind, LONG_FOOTAGE_ADVICE } from "@/lib/data/film-types";
import type { ClipInput } from "@/lib/data/film-types";
import { emitMidoEvent } from "@/lib/events/emit";
import { idempotencyKey } from "@/lib/events/types";
import { track } from "@/lib/analytics/track";

export type Result = { ok: true; id?: string; demo?: boolean } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, userId: null };
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

function revalidateFilm(videoId?: string) {
  revalidatePath("/app/film-room");
  revalidatePath("/app");
  if (videoId) revalidatePath(`/app/film-room/${videoId}`);
}

/*
  Footage arriving is the start of the film half of the loop.

  Emitted from both entry points — a pasted link and an uploaded file —
  because from the log's point of view they are the same fact: this
  player now has footage they did not have before. Recording only one of
  them would make "when did you last bring film in" answerable for half
  the product.

  `occurredAt` is left to default. Unlike a match, footage has no date of
  its own that differs from when it was added; the moment it arrived IS
  the fact.
*/
async function recordVideoAdded(id: string, title: string, source: string) {
  await track("film_uploaded", { source });
  await emitMidoEvent({
    type: "VIDEO_UPLOADED",
    subjectType: "video",
    subjectId: id,
    payload: { title, source },
    idempotencyKey: idempotencyKey(["video", "added", id]),
  });
}

// ---------- videos ----------

export async function addVideo(input: { title: string; url: string; matchId?: string | null }): Promise<Result> {
  const url = input.url.trim();
  if (!input.title?.trim()) return { ok: false, error: "Give the video a title." };
  if (!url) return { ok: false, error: "Paste a video URL." };

  /*
    Checked here as well as in the dialog. A form that only hides a bad
    option is not enforcing anything — and this one saved a web page as
    `status: "ready"`, which is the app asserting something it had never
    verified.
  */
  const detected = videoUrlKind(url);
  if (detected.kind === "unsupported") {
    return { ok: false, error: `${detected.reason} ${LONG_FOOTAGE_ADVICE}` };
  }

  const yt = detected.kind === "youtube" ? detected.id : null;
  const source = yt ? "youtube" : "url";

  if (isDemoMode) {
    const id = demoStore.createVideo({ title: input.title.trim(), source, url, externalId: yt ?? undefined, matchId: input.matchId ?? null });
    await recordVideoAdded(id, input.title.trim(), source);
    revalidateFilm();
    return { ok: true, id, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase
    .from("videos")
    .insert({ title: input.title.trim(), source, external_url: url, match_id: input.matchId ?? null, status: "ready" })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await recordVideoAdded(data.id, input.title.trim(), source);
  revalidateFilm();
  return { ok: true, id: data.id };
}

/** Record a video that was uploaded to Supabase Storage (client-side). */
export async function createUploadedVideo(input: {
  title: string;
  storagePath: string;
  durationSeconds?: number | null;
  matchId?: string | null;
}): Promise<Result> {
  if (!input.title?.trim()) return { ok: false, error: "Give the video a title." };
  if (isDemoMode) return { ok: false, error: "File upload needs Supabase — connect it first." };

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase
    .from("videos")
    .insert({
      title: input.title.trim(),
      source: "upload",
      storage_path: input.storagePath,
      duration_seconds: input.durationSeconds ?? null,
      match_id: input.matchId ?? null,
      status: "ready",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await recordVideoAdded(data.id, input.title.trim(), "upload");
  revalidateFilm();
  return { ok: true, id: data.id };
}

export async function deleteVideo(id: string): Promise<Result> {
  if (isDemoMode) {
    demoStore.deleteVideo(id);
    revalidateFilm();
    return { ok: true, demo: true };
  }
  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  // Remove the storage object first (uploaded videos only).
  const { data: v } = await supabase.from("videos").select("source, storage_path").eq("id", id).maybeSingle();
  if (v?.source === "upload" && v.storage_path) {
    await supabase.storage.from("videos").remove([v.storage_path as string]);
  }

  const { error } = await supabase.from("videos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateFilm();
  return { ok: true };
}

// ---------- clips ----------

export async function createClip(input: ClipInput): Promise<Result> {
  if (!input.title?.trim()) return { ok: false, error: "Name the clip." };

  if (isDemoMode) {
    const id = demoStore.createClip(input);
    // Feed the development loop: a goal-linked clip is Film evidence.
    if (input.goalId) demoStore.addEvidence(input.goalId, { kind: "film", note: input.title.trim() });
    revalidateFilm(input.videoId);
    if (input.goalId) revalidatePath(`/app/development/${input.goalId}`);
    return { ok: true, id, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase
    .from("clips")
    .insert({
      video_id: input.videoId,
      match_id: input.matchId ?? null,
      goal_id: input.goalId ?? null,
      title: input.title.trim(),
      start_seconds: input.startSeconds,
      end_seconds: input.endSeconds ?? null,
      sentiment: input.sentiment ?? null,
      note: input.note || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  if (input.tags.length) {
    await supabase.from("clip_tags").insert(input.tags.map((tag) => ({ clip_id: data.id, tag })));
  }
  if (input.goalId) {
    await supabase.from("development_evidence").insert({ goal_id: input.goalId, kind: "film", note: input.title.trim(), ref_id: data.id });
  }

  revalidateFilm(input.videoId);
  if (input.goalId) revalidatePath(`/app/development/${input.goalId}`);
  return { ok: true, id: data.id };
}

export async function deleteClip(id: string, videoId: string): Promise<Result> {
  if (isDemoMode) {
    demoStore.deleteClip(id);
    revalidateFilm(videoId);
    return { ok: true, demo: true };
  }
  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };
  const { error } = await supabase.from("clips").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateFilm(videoId);
  return { ok: true };
}

export async function toggleClipFavorite(id: string, videoId?: string): Promise<Result> {
  if (isDemoMode) {
    demoStore.toggleClipFavorite(id);
    revalidateFilm(videoId);
    return { ok: true, demo: true };
  }
  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };
  const { data: current } = await supabase.from("clips").select("favorite").eq("id", id).maybeSingle();
  const { error } = await supabase.from("clips").update({ favorite: !current?.favorite }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateFilm(videoId);
  return { ok: true };
}
