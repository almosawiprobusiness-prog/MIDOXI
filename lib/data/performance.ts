import "server-only";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
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
  Seeded, and deliberately only as rich as the real thing can be. The old demo
  showed box touches, runs in behind and pressures per 90 — tracking numbers
  MIDO cannot record and explicitly refuses to claim. A demo that promises more
  than the product delivers is a demo that sells a lie.
*/
function demoPerformance(): PerformanceView {
  const day = 864e5;
  const now = Date.now();
  const at = (d: number) => new Date(now - d * day).toISOString();

  const seed: (Omit<MatchRow, "date" | "opponentShort"> & { daysAgo: number })[] = [
    { id: "m6", daysAgo: 12, opponent: "Halton Town", competition: "Pre-Season Cup · Final", home: false, gf: 2, ga: 1, position: "CF", started: true, minutes: 78, goals: 1, assists: 1, rating: 7.6 },
    { id: "m5", daysAgo: 19, opponent: "Ashford United", competition: "Pre-Season", home: true, gf: 3, ga: 0, position: "CF", started: true, minutes: 90, goals: 2, assists: 0, rating: 8.1 },
    { id: "m4", daysAgo: 26, opponent: "Fenwick City", competition: "Pre-Season", home: false, gf: 1, ga: 1, position: "RW", started: true, minutes: 62, goals: 0, assists: 1, rating: 6.9 },
    { id: "m3", daysAgo: 33, opponent: "Marden Rovers", competition: "Pre-Season", home: true, gf: 1, ga: 2, position: "CF", started: true, minutes: 71, goals: 1, assists: 0, rating: 6.8 },
    { id: "m2", daysAgo: 40, opponent: "Colby Athletic", competition: "Friendly", home: false, gf: 2, ga: 2, position: "CF", started: false, minutes: 45, goals: 0, assists: 1, rating: 6.7 },
    { id: "m1", daysAgo: 47, opponent: "Deanwood", competition: "Friendly", home: true, gf: 4, ga: 1, position: "CF", started: true, minutes: 82, goals: 0, assists: 0, rating: 7.0 },
  ];

  const matches: MatchRow[] = seed.map((m) => ({
    ...m,
    date: at(m.daysAgo),
    opponentShort: abbr(m.opponent),
  }));

  // Stat lines a person could plausibly have written down after a match.
  const statSeed: Record<string, Partial<Record<string, number>>> = {
    m6: { shots: 4, shots_on_target: 2, chances_created: 2, key_passes: 2, duels_won: 5, aerials_won: 3 },
    m5: { shots: 5, shots_on_target: 3, chances_created: 1, key_passes: 1, duels_won: 6, aerials_won: 4 },
    m4: { shots: 2, shots_on_target: 1, chances_created: 2, key_passes: 3, duels_won: 4, aerials_won: 1 },
    m3: { shots: 3, shots_on_target: 2, chances_created: 0, key_passes: 1, duels_won: 3, aerials_won: 2 },
    m2: { shots: 1, shots_on_target: 0, chances_created: 1, key_passes: 1, duels_won: 2, aerials_won: 1 },
    m1: { shots: 3, shots_on_target: 1, chances_created: 1, key_passes: 2, duels_won: 5, aerials_won: 3 },
  };

  const lines: StatLine[] = matches.map((m) => ({
    matchId: m.id,
    minutes: m.minutes,
    values: statSeed[m.id] ?? {},
  }));

  const sessions = Array.from({ length: 24 }, (_, i) => ({
    date: at(i * 2 + 1),
    minutes: 60 + ((i * 17) % 45),
  }));

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
