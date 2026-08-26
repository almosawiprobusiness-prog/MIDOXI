import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "./store";
import type { Match } from "@/lib/types";
import type { MatchStatsInput, MatchReviewInput, MatchDetail } from "./match-types";

function short(opponent: string) {
  return opponent.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "OPP";
}

function rowToMatch(m: Record<string, unknown>): Match {
  return {
    id: m.id as string,
    opponent: m.opponent as string,
    opponentShort: short(m.opponent as string),
    competition: (m.competition as string) ?? "",
    date: m.played_at as string,
    home: m.home as boolean,
    goalsFor: (m.goals_for as number) ?? 0,
    goalsAgainst: (m.goals_against as number) ?? 0,
    formation: (m.formation as string) ?? "",
    position: (m.position as Match["position"]) ?? "CF",
    started: (m.started as boolean) ?? true,
    minutes: (m.minutes as number) ?? 0,
    rating: (m.rating as number) ?? 0,
    goals: (m.goals as number) ?? 0,
    assists: (m.assists as number) ?? 0,
    reviewed: (m.reviewed as boolean) ?? false,
  };
}

export async function listMatches(): Promise<Match[]> {
  if (isDemoMode) return demoStore.listMatches();

  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("matches")
    .select("*")
    .order("played_at", { ascending: false });
  return (data ?? []).map(rowToMatch);
}

/** A reviewed match's "study this" line, with enough match to name it. */
export interface StudyMoment {
  matchId: string;
  opponent: string;
  home: boolean;
  date: string;
  moment: string;
}

/**
 * The moments a player's own reviews said to study, newest first.
 *
 * The review form has always promised "Feeds Film Room" next to this
 * field, and until this function existed nothing kept that promise —
 * the answer went into a column and an event payload that no surface
 * read. A form that asks for effort and visibly does nothing with it
 * teaches players to stop filling it in, and the review is the
 * product's richest signal source.
 */
export async function listStudyMoments(limit = 3): Promise<StudyMoment[]> {
  if (isDemoMode) {
    return demoStore
      .listMatches()
      .map((m) => ({ match: m, review: demoStore.getMatch(m.id)?.review }))
      .filter((x) => x.review?.momentToStudy?.trim())
      .slice(0, limit)
      .map((x) => ({
        matchId: x.match.id,
        opponent: x.match.opponent,
        home: x.match.home,
        date: x.match.date,
        moment: x.review!.momentToStudy!.trim(),
      }));
  }

  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("match_reviews")
    .select("match_id, moment_to_study, matches!inner(opponent, home, played_at)")
    .not("moment_to_study", "is", null)
    .neq("moment_to_study", "")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => {
    const m = r.matches as unknown as { opponent: string; home: boolean; played_at: string };
    return {
      matchId: String(r.match_id),
      opponent: String(m?.opponent ?? "Match"),
      home: Boolean(m?.home),
      date: String(m?.played_at ?? ""),
      moment: String(r.moment_to_study ?? "").trim(),
    };
  });
}

export async function getMatchDetail(id: string): Promise<MatchDetail | null> {
  if (isDemoMode) return demoStore.getMatch(id);

  const supabase = await createClient();
  if (!supabase) return null;

  const { data: m } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
  if (!m) return null;

  const [{ data: s }, { data: r }] = await Promise.all([
    supabase.from("match_stats").select("*").eq("match_id", id).maybeSingle(),
    supabase.from("match_reviews").select("*").eq("match_id", id).maybeSingle(),
  ]);

  return {
    match: rowToMatch(m),
    stats: s ? rowToStats(s) : null,
    review: r ? rowToReview(r) : null,
  };
}

function rowToStats(s: Record<string, unknown>): MatchStatsInput {
  const n = (v: unknown) => (v == null ? null : (v as number));
  return {
    shots: n(s.shots),
    shotsOnTarget: n(s.shots_on_target),
    touches: n(s.touches),
    passes: n(s.passes),
    passPct: n(s.pass_pct),
    keyPasses: n(s.key_passes),
    chancesCreated: n(s.chances_created),
    dribbles: n(s.dribbles),
    duelsWon: n(s.duels_won),
    duelsTotal: n(s.duels_total),
    aerialsWon: n(s.aerials_won),
    recoveries: n(s.recoveries),
    interceptions: n(s.interceptions),
    tackles: n(s.tackles),
    foulsWon: n(s.fouls_won),
    foulsCommitted: n(s.fouls_committed),
    offsides: n(s.offsides),
    yellow: n(s.yellow),
    red: n(s.red),
  };
}

function rowToReview(r: Record<string, unknown>): MatchReviewInput {
  return {
    didWell: (r.did_well as string) ?? "",
    couldImprove: (r.could_improve as string) ?? "",
    repeated: (r.repeated as string) ?? "",
    bestDecision: (r.best_decision as string) ?? "",
    momentToStudy: (r.moment_to_study as string) ?? "",
    intoTraining: (r.into_training as string) ?? "",
    selfRating: (r.self_rating as number) ?? null,
    confidence: (r.confidence as number) ?? null,
    physicalFeel: (r.physical_feel as number) ?? null,
    mentalFeel: (r.mental_feel as number) ?? null,
  };
}
