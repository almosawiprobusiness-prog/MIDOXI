import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { player } from "@/lib/seed";

export interface ProfileSettings {
  email: string;
  fullName: string;
  knownAs: string;
  /** ISO date. Age is derived, never stored — a stored age is wrong within a year. */
  dateOfBirth: string;
  nationality: string;
  foot: string;
  primaryPosition: string;
  secondaryPosition: string;
  heightCm: number | null;
  weightKg: number | null;
  club: string;
  league: string;
  squadNumber: number | null;
  season: string;
  level: string;
  /**
   * How to find this player in their own footage — "9, blue shirts, left
   * footed". Passed to video reading. Without it a read cannot claim to be
   * about them, and says so rather than guessing.
   */
  pitchIdentity: string;
  /** A link a report's reader can follow. Never a source of facts. */
  transfermarktUrl: string;
  /** Public URL in the `avatars` bucket, or "". */
  avatarUrl: string;
  isPublic: boolean;
  // public / community profile
  handle: string;
  playStyle: string;
  favoritePlayers: string[];
  strengths: string[];
  achievements: string;
  socials: { instagram?: string; twitter?: string; youtube?: string };
}

export interface PublicProfileInput {
  handle: string;
  playStyle: string;
  favoritePlayers: string[];
  strengths: string[];
  achievements: string;
  socials: { instagram?: string; twitter?: string; youtube?: string };
}

export interface ProfileFormInput {
  fullName: string;
  knownAs: string;
  nationality: string;
  foot: string;
  primaryPosition: string;
  secondaryPosition: string;
  heightCm: number | null;
  weightKg: number | null;
  club: string;
  league: string;
  squadNumber: number | null;
  season: string;
  level: string;
  pitchIdentity: string;
  transfermarktUrl: string;
}

/**
 * @param forUser read somebody else's profile with the service role. Only the
 * public share route may pass this, with an id from a validated token.
 */
export async function getProfileSettings(forUser?: string): Promise<ProfileSettings> {
  if (isDemoMode) {
    return {
      email: "demo@mido.xi",
      fullName: `${player.firstName} ${player.lastName}`,
      knownAs: player.knownAs,
      dateOfBirth: player.dateOfBirth ?? "",
      nationality: player.nationality,
      foot: player.foot,
      primaryPosition: player.primaryPosition,
      secondaryPosition: player.secondaryPosition,
      heightCm: player.heightCm,
      weightKg: player.weightKg,
      club: player.club,
      league: player.league,
      squadNumber: player.squadNumber,
      season: player.season,
      level: player.level,
      pitchIdentity: `${player.squadNumber}, home kit`,
      transfermarktUrl: "",
      avatarUrl: "",
      isPublic: false,
      handle: "mido9",
      playStyle: "Direct forward — runs in behind, presses from the front.",
      favoritePlayers: ["Erling Haaland", "Harry Kane"],
      strengths: ["Movement", "Finishing", "Pressing"],
      achievements: "Top scorer, Pre-Season Cup 2026.",
      socials: {},
    };
  }

  const supabase = forUser ? createAdminClient() : await createClient();
  const empty: ProfileSettings = {
    email: "", fullName: "", knownAs: "", dateOfBirth: "", nationality: "", foot: "Right",
    primaryPosition: "", secondaryPosition: "", heightCm: null, weightKg: null,
    club: "", league: "", squadNumber: null, season: "", level: "", pitchIdentity: "",
    transfermarktUrl: "", avatarUrl: "", isPublic: false,
    handle: "", playStyle: "", favoritePlayers: [], strengths: [], achievements: "", socials: {},
  };
  if (!supabase) return empty;

  let userId = forUser;
  let email = "";
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return empty;
    userId = user.id;
    email = user.email ?? "";
  }

  const [{ data: profile }, { data: pp }] = await Promise.all([
    supabase.from("profiles").select("full_name, known_as, avatar_url").eq("id", userId).maybeSingle(),
    supabase.from("player_profiles").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  return {
    // Blank when read through a share: an email is only ever disclosed
    // because the player ticked the contact field, and the route decides that.
    email,
    fullName: profile?.full_name ?? "",
    knownAs: profile?.known_as ?? "",
    dateOfBirth: pp?.date_of_birth ?? "",
    nationality: pp?.nationality ?? "",
    foot: pp?.foot ?? "Right",
    primaryPosition: pp?.primary_position ?? "",
    secondaryPosition: pp?.secondary_position ?? "",
    heightCm: pp?.height_cm ?? null,
    weightKg: pp?.weight_kg ?? null,
    club: pp?.club ?? "",
    league: pp?.league ?? "",
    squadNumber: pp?.squad_number ?? null,
    season: pp?.season ?? "",
    level: pp?.level ?? "",
    pitchIdentity: pp?.pitch_identity ?? "",
    transfermarktUrl: pp?.transfermarkt_url ?? "",
    avatarUrl: profile?.avatar_url ?? "",
    isPublic: pp?.is_public ?? false,
    handle: pp?.handle ?? "",
    playStyle: pp?.play_style ?? "",
    favoritePlayers: pp?.favorite_players ?? [],
    strengths: pp?.strengths ?? [],
    achievements: pp?.achievements ?? "",
    socials: pp?.socials ?? {},
  };
}

/** Public profile for community viewing (another user, by id). */
export async function getPublicProfile(userId: string): Promise<{
  name: string; handle: string; position: string; club: string; league: string;
  season: string; foot: string; nationality: string; bio: string;
  playStyle: string; favoritePlayers: string[]; strengths: string[]; achievements: string;
  socials: { instagram?: string; twitter?: string; youtube?: string };
} | null> {
  if (isDemoMode) {
    return {
      name: player.knownAs, handle: "mido9", position: player.primaryPosition, club: player.club,
      league: player.league, season: player.season, foot: player.foot, nationality: player.nationality,
      bio: "", playStyle: "Direct forward — runs in behind, presses from the front.",
      favoritePlayers: ["Erling Haaland", "Harry Kane"], strengths: ["Movement", "Finishing", "Pressing"],
      achievements: "Top scorer, Pre-Season Cup 2026.", socials: {},
    };
  }
  const supabase = await createClient();
  if (!supabase) return null;
  const [{ data: prof }, { data: pp }] = await Promise.all([
    supabase.from("profiles").select("full_name, known_as").eq("id", userId).maybeSingle(),
    supabase.from("player_profiles").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (!pp || !pp.is_public) return null; // only public profiles are viewable
  return {
    name: prof?.known_as || prof?.full_name || "Player",
    handle: pp.handle ?? "",
    position: pp.primary_position ?? "",
    club: pp.club ?? "",
    league: pp.league ?? "",
    season: pp.season ?? "",
    foot: pp.foot ?? "",
    nationality: pp.nationality ?? "",
    bio: pp.bio ?? "",
    playStyle: pp.play_style ?? "",
    favoritePlayers: pp.favorite_players ?? [],
    strengths: pp.strengths ?? [],
    achievements: pp.achievements ?? "",
    socials: pp.socials ?? {},
  };
}
