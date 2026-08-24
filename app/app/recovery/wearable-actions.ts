"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { syncWhoop } from "@/lib/health/whoop";

export type WearableResult = { ok: true; message: string } | { ok: false; error: string };

/*
  Syncing and disconnecting.

  Connecting is not here: OAuth needs a redirect, so it lives in the two
  route handlers under /api/wearables/whoop.
*/

async function me() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, userId: null };
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

export async function syncWearable(): Promise<WearableResult> {
  if (isDemoMode) return { ok: false, error: "This is the demo. Sign in to connect a wearable." };
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "Sign in first." };

  const { data: conn } = await supabase
    .from("provider_connections")
    .select("id, provider")
    .eq("user_id", userId)
    .eq("provider", "whoop")
    .maybeSingle();
  if (!conn) return { ok: false, error: "No WHOOP connection to sync." };

  const result = await syncWhoop(userId, String(conn.id), 30);
  revalidatePath("/app/recovery");
  return result.ok ? { ok: true, message: result.message } : { ok: false, error: result.message };
}

/**
 * Disconnect.
 *
 * The connection row goes, and `provider_tokens` follows it by cascade —
 * so the refresh token is genuinely gone rather than merely marked
 * inactive. Anything else would mean a player who disconnected still had
 * a live key to their physiology sitting in the database.
 *
 * The readings STAY. They are a record of what happened, the player owns
 * them, and silently deleting a season of recovery history because
 * somebody unplugged a strap would be its own kind of data loss. They
 * are deletable separately, deliberately as a second decision.
 */
export async function disconnectWearable(): Promise<WearableResult> {
  if (isDemoMode) return { ok: false, error: "This is the demo." };
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "Sign in first." };

  const { error } = await supabase
    .from("provider_connections")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "whoop");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/recovery");
  return { ok: true, message: "WHOOP disconnected. Your existing readings have been kept." };
}

/** Remove the measured readings themselves. Separate, and irreversible. */
export async function deleteWearableData(): Promise<WearableResult> {
  if (isDemoMode) return { ok: false, error: "This is the demo." };
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "Sign in first." };

  const { error } = await supabase.from("recovery_samples").delete().eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  /*
    Confirm from the other side rather than trusting the delete's own
    response — the habit this codebase has had to learn repeatedly.
  */
  const admin = createAdminClient();
  if (admin) {
    const { count } = await admin
      .from("recovery_samples")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) > 0) return { ok: false, error: `${count} readings could not be removed.` };
  }

  revalidatePath("/app/recovery");
  return { ok: true, message: "All measured readings deleted." };
}
