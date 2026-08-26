"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "@/lib/data/store";
import type { MatchInput, MatchStatsInput, MatchReviewInput } from "@/lib/data/match-types";
import { emitMidoEvent } from "@/lib/events/emit";
import { idempotencyKey } from "@/lib/events/types";
import { track } from "@/lib/analytics/track";

export type Result = { ok: true; id?: string; demo?: boolean } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, userId: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

function revalidate() {
  revalidatePath("/app/matches");
  revalidatePath("/app");
}

/*
  A match was entered.

  `occurredAt` is the match's OWN date, not now. A match played on
  Saturday and entered on Monday is a Saturday event — every ordering,
  every "how long since you played", and every recommendation about the
  next fixture depends on that distinction. Using the insert time here
  would quietly make the whole log a record of when somebody did
  paperwork.
*/
async function recordMatchCreated(id: string, input: MatchInput) {
  await track("match_logged");
  await emitMidoEvent({
    type: "MATCH_CREATED",
    subjectType: "match",
    subjectId: id,
    occurredAt: input.playedAt,
    // The match row is authoritative; this is only what an event needs
    // to be legible without a join.
    payload: { opponent: input.opponent.trim(), competition: input.competition ?? null },
    idempotencyKey: idempotencyKey(["match", "created", id]),
  });
}

export async function createMatch(input: MatchInput): Promise<Result> {
  if (!input.opponent?.trim()) return { ok: false, error: "Opponent is required." };
  if (!input.playedAt) return { ok: false, error: "Match date is required." };

  if (isDemoMode) {
    const id = demoStore.createMatch(input);
    await recordMatchCreated(id, input);
    revalidate();
    return { ok: true, id, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase
    .from("matches")
    .insert({
      opponent: input.opponent.trim(),
      competition: input.competition || null,
      played_at: input.playedAt,
      home: input.home,
      goals_for: input.goalsFor ?? null,
      goals_against: input.goalsAgainst ?? null,
      formation: input.formation || null,
      position: input.position || null,
      started: input.started,
      minutes: input.minutes ?? null,
      rating: input.rating ?? null,
      goals: input.goals ?? 0,
      assists: input.assists ?? 0,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  await recordMatchCreated(data.id, input);
  revalidate();
  return { ok: true, id: data.id };
}

export async function updateMatch(id: string, input: MatchInput): Promise<Result> {
  if (!input.opponent?.trim()) return { ok: false, error: "Opponent is required." };

  if (isDemoMode) {
    demoStore.updateMatch(id, input);
    revalidate();
    revalidatePath(`/app/matches/${id}`);
    return { ok: true, id, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase
    .from("matches")
    .update({
      opponent: input.opponent.trim(),
      competition: input.competition || null,
      played_at: input.playedAt,
      home: input.home,
      goals_for: input.goalsFor ?? null,
      goals_against: input.goalsAgainst ?? null,
      formation: input.formation || null,
      position: input.position || null,
      started: input.started,
      minutes: input.minutes ?? null,
      rating: input.rating ?? null,
      goals: input.goals ?? 0,
      assists: input.assists ?? 0,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidate();
  revalidatePath(`/app/matches/${id}`);
  return { ok: true, id };
}

export async function deleteMatch(id: string): Promise<Result> {
  if (isDemoMode) {
    demoStore.deleteMatch(id);
    revalidate();
    return { ok: true, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function saveMatchStats(id: string, stats: MatchStatsInput): Promise<Result> {
  if (isDemoMode) {
    demoStore.saveStats(id, stats);
    revalidatePath(`/app/matches/${id}`);
    return { ok: true, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase.from("match_stats").upsert({
    match_id: id,
    shots: stats.shots ?? null,
    shots_on_target: stats.shotsOnTarget ?? null,
    touches: stats.touches ?? null,
    passes: stats.passes ?? null,
    pass_pct: stats.passPct ?? null,
    key_passes: stats.keyPasses ?? null,
    chances_created: stats.chancesCreated ?? null,
    dribbles: stats.dribbles ?? null,
    duels_won: stats.duelsWon ?? null,
    duels_total: stats.duelsTotal ?? null,
    aerials_won: stats.aerialsWon ?? null,
    recoveries: stats.recoveries ?? null,
    interceptions: stats.interceptions ?? null,
    tackles: stats.tackles ?? null,
    fouls_won: stats.foulsWon ?? null,
    fouls_committed: stats.foulsCommitted ?? null,
    offsides: stats.offsides ?? null,
    yellow: stats.yellow ?? 0,
    red: stats.red ?? 0,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/matches/${id}`);
  return { ok: true };
}

/*
  A match was reviewed.

  The most valuable event in the player loop: it is the moment a result
  becomes a reflection, and it is what turns "review your match" from the
  top recommendation into a finished one.

  The payload carries WHETHER each answer was written, never the answers
  themselves. A match review is the most personal text in the product —
  what somebody thinks they did badly — and copying it into a second
  table would double the places it has to be protected and deleted. The
  review stays in `match_reviews`, reachable by subjectId; the event
  records only that it happened and how substantial it was, which is all
  a recommendation needs to decide what to say next.
*/
async function recordMatchReviewed(id: string, review: MatchReviewInput) {
  await track("match_review_completed", { flaggedForStudy: Boolean(review.momentToStudy?.trim()) });
  const answered = [
    review.didWell,
    review.couldImprove,
    review.repeated,
    review.bestDecision,
    review.momentToStudy,
    review.intoTraining,
  ].filter((v) => Boolean(v?.trim())).length;

  await emitMidoEvent({
    type: "MATCH_REVIEWED",
    subjectType: "match",
    subjectId: id,
    payload: {
      answered,
      // A moment marked for study is the one field that should reach the
      // film room later, so its PRESENCE is recorded — not its text.
      flaggedForStudy: Boolean(review.momentToStudy?.trim()),
      selfRating: review.selfRating ?? null,
    },
    idempotencyKey: idempotencyKey(["match", "reviewed", id]),
  });
}

export async function saveMatchReview(id: string, review: MatchReviewInput): Promise<Result> {
  if (isDemoMode) {
    demoStore.saveReview(id, review);
    await recordMatchReviewed(id, review);
    revalidate();
    revalidatePath(`/app/matches/${id}`);
    return { ok: true, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase.from("match_reviews").upsert({
    match_id: id,
    did_well: review.didWell || null,
    could_improve: review.couldImprove || null,
    repeated: review.repeated || null,
    best_decision: review.bestDecision || null,
    moment_to_study: review.momentToStudy || null,
    into_training: review.intoTraining || null,
    self_rating: review.selfRating ?? null,
    confidence: review.confidence ?? null,
    physical_feel: review.physicalFeel ?? null,
    mental_feel: review.mentalFeel ?? null,
  });
  if (error) return { ok: false, error: error.message };

  // Mark the match reviewed.
  await supabase.from("matches").update({ reviewed: true }).eq("id", id);
  await recordMatchReviewed(id, review);
  revalidate();
  revalidatePath(`/app/matches/${id}`);
  return { ok: true };
}
