"use server";

import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import type { Role } from "@/lib/types";

export interface OnboardingPayload {
  role: Role;
  fullName: string;
  knownAs: string;
  // player
  dateOfBirth?: string;
  nationality?: string;
  foot?: "Right" | "Left" | "Both";
  primaryPosition?: string;
  secondaryPosition?: string;
  heightCm?: number;
  weightKg?: number;
  club?: string;
  league?: string;
  squadNumber?: number;
  season?: string;
  level?: string;
  goals?: { category: string; title: string }[];
  // coach
  team?: string;
  coachingRole?: string;
  formations?: string[];
  focus?: string;
  // trainer
  practice?: string;
  specialism?: string;
  qualifications?: string[];
  athleteCapacity?: number;
  // club
  clubName?: string;
  country?: string;
  ageGroups?: string[];
}

export type OnboardingResult = { ok: true } | { ok: false; error: string };

export async function completeOnboarding(
  payload: OnboardingPayload
): Promise<OnboardingResult> {
  // Demo mode: nothing to persist — the wizard just forwards to the app.
  if (isDemoMode) return { ok: true };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Backend unavailable." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  // 1) Core profile + role + completion flag.
  const { error: pErr } = await supabase
    .from("profiles")
    .update({
      role: payload.role,
      full_name: payload.fullName,
      known_as: payload.knownAs || payload.fullName,
      onboarding_complete: true,
    })
    .eq("id", user.id);
  if (pErr) return { ok: false, error: pErr.message };

  // 2) Role-specific detail row.
  if (payload.role === "player") {
    const { error } = await supabase.from("player_profiles").upsert({
      user_id: user.id,
      date_of_birth: payload.dateOfBirth || null,
      nationality: payload.nationality || null,
      foot: payload.foot || null,
      primary_position: payload.primaryPosition || null,
      secondary_position: payload.secondaryPosition || null,
      height_cm: payload.heightCm || null,
      weight_kg: payload.weightKg || null,
      club: payload.club || null,
      league: payload.league || null,
      squad_number: payload.squadNumber || null,
      season: payload.season || null,
      level: payload.level || null,
    });
    if (error) return { ok: false, error: error.message };

    // 3) Seed the player's active development goals.
    const goals = (payload.goals ?? []).filter((g) => g.title.trim());
    if (goals.length) {
      const { error: gErr } = await supabase.from("development_goals").insert(
        goals.map((g) => ({
          user_id: user.id,
          category: g.category,
          title: g.title.trim(),
          status: "active",
        }))
      );
      if (gErr) return { ok: false, error: gErr.message };
    }
  } else if (payload.role === "coach") {
    const { error } = await supabase.from("coach_profiles").upsert({
      user_id: user.id,
      team: payload.team || null,
      coaching_role: payload.coachingRole || null,
      level: payload.level || null,
      formations: payload.formations || null,
      focus: payload.focus || null,
      club: payload.club || null,
      season: payload.season || null,
    });
    if (error) return { ok: false, error: error.message };
  } else if (payload.role === "trainer") {
    const { error } = await supabase.from("trainer_profiles").upsert({
      user_id: user.id,
      practice: payload.practice || null,
      specialism: payload.specialism || null,
      qualifications: payload.qualifications || null,
      athlete_capacity: payload.athleteCapacity || null,
      bio: payload.focus || null,
    });
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("club_profiles").upsert({
      user_id: user.id,
      club_name: payload.clubName || null,
      level: payload.level || null,
      country: payload.country || null,
      age_groups: payload.ageGroups || null,
      bio: payload.focus || null,
    });
    if (error) return { ok: false, error: error.message };

    // A club account is an organization: create it so teams and staff have a home.
    if (payload.clubName) {
      const { error: oErr } = await supabase.from("organizations").insert({
        owner_id: user.id,
        name: payload.clubName,
        country: payload.country || null,
        level: payload.level || null,
      });
      if (oErr) return { ok: false, error: oErr.message };
    }
  }

  return { ok: true };
}

