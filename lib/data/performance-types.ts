/*
  Performance — shared shapes. Client-safe.

  One rule governs this file: **every number here is derived from something the
  user recorded.** Nothing is modelled, estimated or filled in.

  That rule cost the old demo data three of its six headline metrics. "Box
  touches", "runs in behind" and "pressures per 90" are tracking-data figures —
  the same numbers `LIMITS` in the capability registry says MIDO cannot produce
  — and showing them here while refusing them in the command bar would have made
  one of the two a lie. They are gone. What is left is what a person can write
  down after a match, which is less impressive and actually true.
*/

export interface MatchRow {
  id: string;
  date: string;
  opponent: string;
  opponentShort: string;
  competition: string;
  home: boolean;
  gf: number | null;
  ga: number | null;
  position: string;
  started: boolean;
  minutes: number;
  goals: number;
  assists: number;
  rating: number | null;
}

/** A per-90 figure, plus how many matches actually fed it. */
export interface Per90 {
  key: string;
  label: string;
  value: number;
  hint: string;
  /** Matches with this stat recorded. A figure from one match says nothing. */
  fromMatches: number;
}

export interface WeekLoad {
  week: string;
  training: number;
  match: number;
}

export interface Highlight {
  label: string;
  detail: string;
  date: string;
}

export interface PerformanceView {
  /** `demo` is seeded and labelled; `yours` is the user's own record. */
  source: "demo" | "yours";
  matches: MatchRow[];
  per90: Per90[];
  workload: WeekLoad[];
  highlights: Highlight[];
  /** How much of the picture is actually filled in. Shown, not hidden. */
  coverage: {
    matches: number;
    matchesWithStats: number;
    matchesWithRating: number;
    trainingSessions: number;
  };
}

/**
 * What MIDO would need a tracking provider for. Named here so the Performance
 * page can say what is missing and why, in the same place someone would go
 * looking for it.
 */
export const NOT_RECORDED = {
  metrics: ["Distance covered", "Top speed", "Sprint counts", "Pressures", "Box touches", "xG"],
  why: "These come from a camera system or a licensed data feed. MIDO holds what you and your coach record.",
} as const;

/** Which stat columns become per-90 figures, and what to call them. */
export const PER90_SOURCES: { key: string; column: string; label: string; hint: string }[] = [
  { key: "shots", column: "shots", label: "Shots", hint: "Attempts per 90" },
  { key: "sot", column: "shots_on_target", label: "On target", hint: "Shots on target per 90" },
  { key: "chances", column: "chances_created", label: "Chances created", hint: "Chances created per 90" },
  { key: "key_passes", column: "key_passes", label: "Key passes", hint: "Key passes per 90" },
  { key: "dribbles", column: "dribbles", label: "Dribbles", hint: "Successful dribbles per 90" },
  { key: "duels", column: "duels_won", label: "Duels won", hint: "Duels won per 90" },
  { key: "recoveries", column: "recoveries", label: "Recoveries", hint: "Ball recoveries per 90" },
  { key: "tackles", column: "tackles", label: "Tackles", hint: "Tackles per 90" },
  { key: "interceptions", column: "interceptions", label: "Interceptions", hint: "Interceptions per 90" },
  { key: "aerials", column: "aerials_won", label: "Aerials won", hint: "Aerial duels won per 90" },
];

/** A per-90 built from fewer than this many matches is noise, and is dropped. */
export const MIN_MATCHES_FOR_PER90 = 2;

/** Minutes are what a per-90 divides by; a per-90 from 30 minutes is nonsense. */
export const MIN_MINUTES_FOR_PER90 = 90;

// ---------------------------------------------------------------------------
// Derivations — pure, so the page and the tests agree
// ---------------------------------------------------------------------------

export interface StatLine {
  matchId: string;
  minutes: number;
  values: Record<string, number | null | undefined>;
}

/**
 * Per-90 figures from recorded stat lines.
 *
 * A column only produces a figure when enough matches recorded it and enough
 * minutes were played. Everything else is left out rather than shown thin — a
 * "3.2 shots per 90" built from one 20-minute cameo is worse than no number.
 */
export function per90From(lines: StatLine[]): Per90[] {
  const out: Per90[] = [];
  for (const src of PER90_SOURCES) {
    let total = 0;
    let minutes = 0;
    let matches = 0;
    for (const line of lines) {
      const v = line.values[src.column];
      if (v === null || v === undefined || Number.isNaN(Number(v))) continue;
      if (!line.minutes || line.minutes <= 0) continue;
      total += Number(v);
      minutes += line.minutes;
      matches += 1;
    }
    if (matches < MIN_MATCHES_FOR_PER90 || minutes < MIN_MINUTES_FOR_PER90) continue;
    out.push({
      key: src.key,
      label: src.label,
      value: Number(((total / minutes) * 90).toFixed(1)),
      hint: src.hint,
      fromMatches: matches,
    });
  }
  return out;
}

/** Rolling weekly load, newest week last. Weeks with nothing recorded show zero. */
export function workloadFrom(
  matches: { date: string; minutes: number }[],
  sessions: { date: string; minutes: number }[],
  weeks = 8,
  now = new Date(),
): WeekLoad[] {
  const out: WeekLoad[] = [];
  const msWeek = 7 * 864e5;
  const end = now.getTime();
  for (let i = weeks - 1; i >= 0; i--) {
    const from = end - (i + 1) * msWeek;
    const to = end - i * msWeek;
    const inWeek = (d: string) => {
      const t = new Date(d).getTime();
      return t > from && t <= to;
    };
    out.push({
      week: `W${weeks - i}`,
      training: sessions.filter((s) => inWeek(s.date)).reduce((n, s) => n + (s.minutes || 0), 0),
      match: matches.filter((m) => inWeek(m.date)).reduce((n, m) => n + (m.minutes || 0), 0),
    });
  }
  return out;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Highlights, read off the record rather than written about it. Each one names
 * the match it came from, so nothing here is an unattributable claim.
 */
export function highlightsFrom(matches: MatchRow[]): Highlight[] {
  const out: Highlight[] = [];
  if (matches.length === 0) return out;

  const scoring = matches.filter((m) => m.goals > 0);
  const best = [...scoring].sort((a, b) => b.goals - a.goals)[0];
  if (best && best.goals >= 2) {
    out.push({
      label: `${best.goals} goals vs ${best.opponent}`,
      detail: `${best.minutes} minutes at ${best.position}.`,
      date: shortDate(best.date),
    });
  }

  const rated = matches.filter((m) => m.rating !== null);
  const topRated = [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
  if (topRated?.rating != null) {
    out.push({
      label: `Best rating: ${topRated.rating}`,
      detail: `vs ${topRated.opponent}, ${topRated.competition}.`,
      date: shortDate(topRated.date),
    });
  }

  const contributions = matches.reduce((n, m) => n + m.goals + m.assists, 0);
  if (contributions > 0) {
    // A running total is not something that happened on a day, so it does not
    // get stamped with one — dating it would imply a single match it came from.
    out.push({
      label: `${contributions} goal contribution${contributions === 1 ? "" : "s"}`,
      detail: `Across ${matches.length} recorded ${matches.length === 1 ? "match" : "matches"}.`,
      date: "To date",
    });
  }

  return out;
}
