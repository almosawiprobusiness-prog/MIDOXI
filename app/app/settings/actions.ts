"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import type { ProfileFormInput, PublicProfileInput } from "@/lib/data/profile";
import { rememberClubAndLeague, searchClubs, searchLeagues } from "@/lib/data/clubs";
import { normaliseTransfermarkt, transfermarktIssue } from "@/lib/data/clubs-types";

export type Result = { ok: true; demo?: boolean } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, userId: null };
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

/**
 * On or off, for everything `emailWorthy()` allows — there is one switch,
 * not one per notification kind. A settings page with a checkbox for every
 * event a product might ever email is a page nobody configures correctly;
 * a single "email me" is the version people actually use.
 */
export async function updateEmailOptIn(optIn: boolean): Promise<Result> {
  if (isDemoMode) return { ok: true, demo: true };

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: userId, email_opt_in: optIn });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/settings");
  return { ok: true };
}

export async function updateProfile(input: ProfileFormInput): Promise<Result> {
  if (!input.fullName?.trim()) return { ok: false, error: "Name is required." };

  // Rejected here rather than stored and rendered as a broken link later.
  const tmIssue = transfermarktIssue(input.transfermarktUrl ?? "");
  if (tmIssue) return { ok: false, error: tmIssue };

  if (isDemoMode) return { ok: true, demo: true };

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { error: pErr } = await supabase
    .from("profiles")
    .update({ full_name: input.fullName.trim(), known_as: input.knownAs || input.fullName.trim() })
    .eq("id", userId);
  if (pErr) return { ok: false, error: pErr.message };

  const { error } = await supabase.from("player_profiles").upsert({
    user_id: userId,
    nationality: input.nationality || null,
    foot: input.foot || null,
    primary_position: input.primaryPosition || null,
    secondary_position: input.secondaryPosition || null,
    height_cm: input.heightCm ?? null,
    weight_kg: input.weightKg ?? null,
    club: input.club || null,
    league: input.league || null,
    squad_number: input.squadNumber ?? null,
    season: input.season || null,
    level: input.level || null,
    favorite_club: input.favoriteClub?.trim() || null,
    pitch_identity: input.pitchIdentity?.trim() || null,
    team_side: input.teamSide === "home" || input.teamSide === "away" ? input.teamSide : null,
    kit_primary: input.kitPrimary?.trim().slice(0, 24) || null,
    kit_secondary: input.kitSecondary?.trim().slice(0, 24) || null,
    transfermarkt_url: normaliseTransfermarkt(input.transfermarktUrl ?? ""),
  });
  if (error) return { ok: false, error: error.message };

  /*
    Add this club and league to the shared list so the next player who types
    the first few letters is offered them. After the save, and deliberately
    unable to fail it: the player's own profile is what matters to them, and a
    convenience for strangers must never cost them their edit.
  */
  await rememberClubAndLeague({ club: input.club, league: input.league });

  revalidatePath("/app/settings");
  revalidatePath("/app/profile");
  revalidatePath("/app");
  return { ok: true };
}

export async function updatePublicProfile(input: PublicProfileInput): Promise<Result> {
  if (isDemoMode) return { ok: true, demo: true };

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const handle = input.handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  const { error } = await supabase.from("player_profiles").upsert({
    user_id: userId,
    handle: handle || null,
    play_style: input.playStyle || null,
    favorite_players: input.favoritePlayers.length ? input.favoritePlayers : null,
    strengths: input.strengths.length ? input.strengths : null,
    achievements: input.achievements || null,
    socials: input.socials,
  });
  if (error) {
    if (error.message.includes("duplicate") || error.code === "23505")
      return { ok: false, error: "That handle is taken — try another." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function updatePrivacy(isPublic: boolean): Promise<Result> {
  if (isDemoMode) return { ok: true, demo: true };

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase
    .from("player_profiles")
    .upsert({ user_id: userId, is_public: isPublic });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/settings");
  return { ok: true };
}

export async function updatePassword(password: string): Promise<Result> {
  if (password.length < 8) return { ok: false, error: "Use at least 8 characters." };
  if (isDemoMode) return { ok: true, demo: true };

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/*
  Every table cascades off `auth.users` — deleting the row takes the
  matches, clips, posts, meetings, everything with it. Storage objects
  do not: a bucket file is not a foreign key, nothing in Postgres knows
  it exists, and `on delete cascade` has no way to reach it. Left alone,
  a deleted account's uploaded video, avatar and community media sit in
  storage forever with no owner reference left to find them by — which
  is a real gap against "deletion removes your uploads," not a
  theoretical one.

  Run BEFORE the auth user is deleted, because the `videos` rows this
  reads from are about to cascade away with it.
*/
async function purgeUserStorage(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
): Promise<void> {
  // avatars/<userId>/ and posts/<userId>/ are fixed-prefix conventions —
  // list what's actually there rather than assuming a single filename,
  // since a post can carry more than one piece of media.
  for (const bucket of ["avatars", "posts"] as const) {
    const { data: files } = await admin.storage.from(bucket).list(userId);
    const paths = (files ?? []).map((f) => `${userId}/${f.name}`);
    if (paths.length > 0) await admin.storage.from(bucket).remove(paths);
  }

  // Uploaded video has no fixed-prefix convention — its path is
  // whatever was recorded per row, so the rows are the only reliable
  // list of what to remove.
  const { data: videos } = await admin
    .from("videos")
    .select("storage_path")
    .eq("user_id", userId)
    .eq("source", "upload")
    .not("storage_path", "is", null);
  const videoPaths = (videos ?? []).map((v) => v.storage_path as string).filter(Boolean);
  if (videoPaths.length > 0) await admin.storage.from("videos").remove(videoPaths);
}

/** Permanently delete the account. Real mode uses the service-role client. */
export async function deleteAccount(): Promise<Result> {
  if (isDemoMode) return { ok: true, demo: true };

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Account deletion is unavailable — service key not configured." };

  // Best-effort and never blocking: a storage sweep that failed is a
  // cleanup problem to notice and retry, not a reason to leave the
  // account — and the data behind it — sitting there because a bucket
  // call hiccuped.
  await purgeUserStorage(admin, userId).catch(() => {});

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  await supabase.auth.signOut();
  redirect("/");
}

/*
  ---------------------------------------------------------------------------
  Avatar
  ---------------------------------------------------------------------------
  The file is resized to a square in the BROWSER before it gets here, so what
  arrives is a small WebP rather than a 12MP phone photo. That keeps this
  action cheap and keeps a request-scoped function from having to decode
  images, which it has no business doing.

  Stored at `avatars/<user id>/avatar.webp` — a fixed name, so replacing a
  picture replaces the file instead of accumulating one per upload. The public
  URL gains a cache-busting query so the new face appears immediately.
*/
export async function updateAvatar(dataUrl: string): Promise<Result & { url?: string }> {
  if (isDemoMode) return { ok: true, demo: true };

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl ?? "");
  if (!match) return { ok: false, error: "That image could not be read." };

  const [, mime, b64] = match;
  const bytes = Buffer.from(b64, "base64");
  if (bytes.byteLength > 2 * 1024 * 1024) {
    return { ok: false, error: "That image is too large even after resizing." };
  }

  /*
    Written with the admin client, and that is safe here for one specific
    reason: the path is built from the SESSION's user id, which the caller
    cannot influence. There is no input to this action that reaches the path.

    The alternative was four RLS policies on `storage.objects`, which in
    current Supabase is owned by `supabase_storage_admin` — so creating them
    from the SQL editor fails on ownership, and the feature would depend on
    somebody clicking through the dashboard correctly. A server-side path
    derived from an authenticated session is the stronger guarantee of the two,
    and it is one line instead of a migration.
  */
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Storage is not configured on this deployment." };

  const path = `${userId}/avatar.webp`;
  const { error: upErr } = await admin.storage
    .from("avatars")
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (upErr) {
    return {
      ok: false,
      error: /bucket/i.test(upErr.message)
        ? "The avatars bucket does not exist on this project yet."
        : upErr.message,
    };
  }

  const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);
  // The path never changes, so without this the browser keeps the old face.
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/settings");
  revalidatePath("/app/profile");
  revalidatePath("/app");
  return { ok: true, url };
}

/** Take the picture down. The file goes too — a deleted face should be gone. */
export async function removeAvatar(): Promise<Result> {
  if (isDemoMode) return { ok: true, demo: true };
  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const admin = createAdminClient();
  // Same reasoning as the upload: the path comes from the session, not the caller.
  if (admin) await admin.storage.from("avatars").remove([`${userId}/avatar.webp`]);
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/settings");
  revalidatePath("/app/profile");
  revalidatePath("/app");
  return { ok: true };
}

/** Typeahead for the club field. Read-only. */
export async function findClubs(query: string) {
  return searchClubs(query);
}

/** Typeahead for the league field. Read-only. */
export async function findLeagues(query: string) {
  return searchLeagues(query);
}
