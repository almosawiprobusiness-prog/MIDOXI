import "server-only";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "./store";
import {
  PER90_SOURCES,
  highlightsFrom,
  per90From,
  workloadFrom,
  type MatchRow,
  type PerformanceView,
  type StatLine,
} from "./performance-types";

/*
  Performance data access.

  The Performance page used to import a hardcoded module directly, with no
  branch on demo mode at all — so a real signed-in user saw a fictional
  centre-forward's season presented as their own. This adapter is the fix, and
  it follows the rule the rest of `lib/data` follows: branch once, identical
  shapes both sides.

  Real mode derives everything from the user's own `matches`, `match_stats` and
  `training_sessions`. Where there is nothing recorded, it returns nothing — the
  page has an honest empty state, and an empty chart is a truer answer than a
  plausible one.
*/

const abbr = (name: string) => name.replace(/[^A-Za-z ]/g, "").slice(0, 3).toUpperCase();

export async function getPerformance(): Promise<PerformanceView> {
  if (isDemoMode) return demoPerformance();

  const supabase = await createClient();
  if (!supabase) return empty();
  const user = await getAuthUser();
  if (!user) return empty();

  const since = new Date(Date.now() - 120 * 864e5).toISOString();

  const [matchRes, sessionRes] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, opponent, competition, played_at, home, goals_for, goals_against, position, started, minutes, rating, goals, assists",
      )
      .eq("user_id", user.id)
      .order("played_at", { ascending: false })
      .limit(60),
    supabase
      .from("training_sessions")
      .select("id, scheduled_at, duration_min")
      .eq("user_id", user.id)
      .gte("scheduled_at", since)
      .limit(400),
  ]);

  const rows = matchRes.data ?? [];
  const matches: MatchRow[] = rows.map((m) => ({
    id: String(m.id),
    date: String(m.played_at),
    opponent: String(m.opponent),
    opponentShort: abbr(String(m.opponent)),
    competition: String(m.competition ?? "Match"),
    home: Boolean(m.home),
    gf: m.goals_for ?? null,
    ga: m.goals_against ?? null,
    position: String(m.position ?? "—"),
    started: Boolean(m.started),
    minutes: Number(m.minutes ?? 0),
    goals: Number(m.goals ?? 0),
    assists: Number(m.assists ?? 0),
    rating: m.rating === null || m.rating === undefined ? null : Number(m.rating),
  }));

  // Only ask for stat lines belonging to matches we actually loaded.
  let lines: StatLine[] = [];
  if (matches.length) {
    const columns = ["match_id", ...PER90_SOURCES.map((s) => s.column)].join(", ");
    const { data: stats } = await supabase
      .from("match_stats")
      .select(columns)
      .in(
        "match_id",
        matches.map((m) => m.id),
      );
    const minutesById = new Map(matches.map((m) => [m.id, m.minutes]));
    lines = ((stats ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
      matchId: String(row.match_id),
      minutes: minutesById.get(String(row.match_id)) ?? 0,
      values: row as Record<string, number | null | undefined>,
    }));
  }

  const sessions = (sessionRes.data ?? [])
    .filter((s) => s.scheduled_at)
    .map((s) => ({ date: String(s.scheduled_at), minutes: Number(s.duration_min ?? 0) }));

  return {
    source: "yours",
    matches,
    per90: per90From(lines),
    workload: workloadFrom(
      matches.map((m) => ({ date: m.date, minutes: m.minutes })),
      sessions,
    ),
    highlights: highlightsFrom(matches),
    coverage: {
      matches: matches.length,
      matchesWithStats: lines.length,
      matchesWithRating: matches.filter((m) => m.rating !== null).length,
      trainingSessions: sessions.length,
    },
  };
}

function empty(): PerformanceView {
  return {
    source: "yours",
    matches: [],
    per90: [],
    workload: workloadFrom([], []),
    highlights: [],
    coverage: { matches: 0, matchesWithStats: 0, matchesWithRating: 0, trainingSessions: 0 },
  };
}

// ── demo ─────────────────────────────────────────────────────

/*
  Derived from the demo store, never stated here.

  This function used to carry a private six-match season — different
  opponents, different minutes, a different world from the one the Match
  Center showed on the previous screen. A player flipping between the
  two pages saw "vs Carlton United 3–0" become "vs Ashford United 3–0",
  which is the fastest possible way to stop trusting every number in the
  product.

  So the rule the real path follows is the rule the demo follows: this
  page HOLDS no matches. It reads the same store rows the Match Center,
  the Timeline and the Locker read, and if the demo season changes it
  changes here for free. The only work done here is translating the
  store's camelCase stat fields into the snake_case column names the
  per-90 maths shares with the Supabase path.
*/

/** Store stat fields → the match_stats column names per90From reads. */
const STAT_COLUMN: Record<string, string> = {
  shots: "shots",
  shotsOnTarget: "shots_on_target",
  chancesCreated: "chances_created",
  keyPasses: "key_passes",
  dribbles: "dribbles",
  duelsWon: "duels_won",
  recoveries: "recoveries",
  tackles: "tackles",
  interceptions: "interceptions",
  aerialsWon: "aerials_won",
};

function demoPerformance(): PerformanceView {
  const stored = demoStore.listMatches();
  const statById = demoStore.listStats();

  const matches: MatchRow[] = stored.map((m) => ({
    id: m.id,
    date: m.date,
    opponent: m.opponent,
    opponentShort: m.opponentShort || abbr(m.opponent),
    competition: m.competition || "Match",
    home: m.home,
    gf: m.goalsFor ?? null,
    ga: m.goalsAgainst ?? null,
    position: m.position || "—",
    started: m.started,
    minutes: m.minutes || 0,
    goals: m.goals || 0,
    assists: m.assists || 0,
    rating: m.rating ?? null,
  }));

  const minutesById = new Map(matches.map((m) => [m.id, m.minutes]));
  const lines: StatLine[] = Object.entries(statById).map(([matchId, stats]) => {
    const values: Record<string, number | null | undefined> = {};
    for (const [field, column] of Object.entries(STAT_COLUMN)) {
      const v = (stats as Record<string, number | undefined>)[field];
      if (v !== undefined) values[column] = v;
    }
    return { matchId, minutes: minutesById.get(matchId) ?? 0, values };
  });

  const sessions = demoStore
    .listTraining()
    .map((t) => ({ date: t.scheduledAt, minutes: t.durationMin || 0 }));

  return {
    source: "demo",
    matches,
    per90: per90From(lines),
    workload: workloadFrom(
      matches.map((m) => ({ date: m.date, minutes: m.minutes })),
      sessions,
    ),
    highlights: highlightsFrom(matches),
    coverage: {
      matches: matches.length,
      matchesWithStats: lines.length,
      matchesWithRating: matches.filter((m) => m.rating !== null).length,
      trainingSessions: sessions.length,
    },
  };
}
