import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { FILE_TTL_HOURS } from "@/lib/video/gemini";

/*
  Remembering that a video has already been handed to the video model.

  Without this, a player reading five passages from one match uploads the same
  file five times. With it, the second read onwards is a single API call.

  The handle expires on the provider's side, so the row carries an expiry and
  anything past it is treated as absent. A stale handle is not an error to
  recover from — it is a re-upload, and the cheapest way to get that right is to
  never trust the handle past its window.
*/

export interface CachedVideoFile {
  uri: string;
  mimeType: string;
}

/** The live handle for a video, or null if there isn't one worth using. */
export async function cachedFileFor(videoId: string): Promise<CachedVideoFile | null> {
  if (isDemoMode) return null;

  const supabase = await createClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("videos")
    .select("ai_file_uri, ai_file_mime, ai_file_expires_at")
    .eq("id", videoId)
    .maybeSingle();

  if (!data?.ai_file_uri || !data.ai_file_expires_at) return null;
  // A minute of margin: a handle that expires mid-request is a confusing error.
  if (new Date(String(data.ai_file_expires_at)).getTime() < Date.now() + 60_000) return null;

  return {
    uri: String(data.ai_file_uri),
    mimeType: String(data.ai_file_mime ?? "video/mp4"),
  };
}

/**
 * Record a handle. Best-effort by design: if this write fails the next read
 * simply uploads again, which is slower and still correct. It must never be
 * the reason an analysis the user already paid for fails.
 */
export async function rememberFile(
  videoId: string,
  uri: string,
  mimeType: string,
): Promise<void> {
  if (isDemoMode) return;

  const supabase = await createClient();
  if (!supabase) return;

  const expires = new Date(Date.now() + FILE_TTL_HOURS * 3600_000).toISOString();
  await supabase
    .from("videos")
    .update({ ai_file_uri: uri, ai_file_mime: mimeType, ai_file_expires_at: expires })
    .eq("id", videoId);
}

/** Forget a handle — used when a read fails in a way that suggests it is stale. */
export async function forgetFile(videoId: string): Promise<void> {
  if (isDemoMode) return;
  const supabase = await createClient();
  if (!supabase) return;
  await supabase
    .from("videos")
    .update({ ai_file_uri: null, ai_file_mime: null, ai_file_expires_at: null })
    .eq("id", videoId);
}
