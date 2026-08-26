import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "./store";
import type {
  PlayerProfile,
  Match,
  FocusArea,
  ReadinessDay,
  WeekEvent,
  Metric,
  DevelopmentGoal,
  DevelopmentCategory,
} from "@/lib/types";
import * as seed from "@/lib/seed";
import { daysBetween } from "@/lib/intelligence/signals";

export interface LockerData {
  isSeed: boolean;
  displayName: string;
  player: PlayerProfile | null;
  nextMatch: {
    opponent: string;
    competition: string | null;
    home: boolean;
    venue?: string;
    expectedPosition?: string;
    daysRemaining: number;
    md: string;
    kickoff?: string;
  } | null;
  recentMatch: (Match & { stats: Metric[] }) | null;
  focus: FocusArea[];
  goals: DevelopmentGoal[];
  readiness: { latest: ReadinessDay | null; rpe: number[] };
  week: WeekEvent[];
  study: { title: string; detail: string; duration: string; clips: number } | null;
  checkedInToday: boolean;
  todayIndex: number;
}

/** Monday=0 … Sunday=6 for a given date. */
function weekdayIndex(d: Date) {
  return (d.getDay() + 6) % 7;
}

function buildSeedLocker(): LockerData {
  const latest = seed.readiness[seed.readiness.length - 1] ?? null;
  const rpe = seed.readiness.slice(-7).map((r) => r.rpe ?? 0);
  const goals = demoStore.listGoals();
  const focus: FocusArea[] = goals
    .filter((gl) => gl.status !== "achieved")
    .slice(0, 3)
    .map((gl) => ({ id: gl.id, category: gl.category, title: gl.title, detail: gl.why, goalId: gl.id }));

  /*
    ONE CLOCK.

    The fixture's timing used to be stated here as literals — a
    hardcoded "3 days out", frozen on the day the seed was written —
    while the Match Center computed the same fixture's distance from the
    demo calendar. Two screens, two counts, and a player who noticed
    stopped believing both. The seed now keeps only what a fixture IS
    (opponent, venue, competition); WHEN is always computed, from the
    same calendar rows the Match Center reads.

    On a Sunday the seeded Saturday match is in the past, so there is no
    upcoming fixture — and the locker says so honestly, exactly as the
    Match Center does, rather than inventing one.
  */
  const now = new Date();
  const fixtureEvent = demoStore
    .listEvents()
    .filter((e) => e.kind === "match" && daysBetween(e.startsAt, now) <= 0)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  /*
    Counted with the scorer's own daysBetween, not with a ceil of
    elapsed hours. Two counting rules is how "Next match in 4 days" sat
    directly above a recommendation saying "you play in 3 days" — and a
    ceil of hours also calls matchday morning "1 day out", which no
    footballer would.
  */
  const daysRemaining = fixtureEvent
    ? Math.max(0, -daysBetween(fixtureEvent.startsAt, now))
    : null;
  const kickoff = fixtureEvent
    ? new Date(fixtureEvent.startsAt).toLocaleDateString("en-GB", { weekday: "short" }) +
      " · " +
      new Date(fixtureEvent.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : undefined;

  // The most recent match is the store's, not a private copy of it.
  const recent = demoStore.listMatches()[0] ?? null;

  return {
    isSeed: true,
    displayName: seed.player.knownAs,
    player: seed.player,
    nextMatch:
      daysRemaining === null
        ? null
        : {
            opponent: seed.nextMatch.opponent,
            competition: seed.nextMatch.competition,
            home: seed.nextMatch.home,
            venue: seed.nextMatch.venue,
            expectedPosition: seed.nextMatch.expectedPosition,
            daysRemaining,
            md: daysRemaining === 0 ? "MD" : `MD-${daysRemaining}`,
            kickoff,
          },
    recentMatch: recent ? { ...recent, stats: seed.recentMatchStats } : null,
    focus,
    goals,
    readiness: { latest, rpe },
    week: seed.weekEvents,
    study: seed.studyAssignment,
    checkedInToday: seed.todayCheckedIn,
    todayIndex: weekdayIndex(new Date()),
  };
}

/** Empty locker for a brand-new real account (drives empty states). */
function emptyLocker(name: string, player: PlayerProfile | null): LockerData {
  return {
    isSeed: false,
    displayName: name,
    player,
    nextMatch: null,
    recentMatch: null,
    focus: [],
    goals: [],
    readiness: { latest: null, rpe: [] },
    week: [],
    study: null,
    checkedInToday: false,
    todayIndex: weekdayIndex(new Date()),
  };
}

export async function getLockerData(): Promise<LockerData> {
  if (isDemoMode) return buildSeedLocker();

  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user || !supabase) return emptyLocker("Player", null);

  const todayIndex = weekdayIndex(new Date());
  const todayISO = new Date().toISOString().slice(0, 10);

  // Fetch in parallel; every query is defensive.
  const [
    { data: profile },
    { data: playerRow },
    { data: matches },
    { data: goals },
    { data: checkins },
    { data: events },
  ] = await Promise.all([
    supabase.from("profiles").select("known_as, full_name").eq("id", user.id).maybeSingle(),
    supabase.from("player_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("matches").select("*").eq("user_id", user.id).order("played_at", { ascending: false }).limit(20),
    supabase.from("development_goals").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
    supabase.from("daily_checkins").select("*").eq("user_id", user.id).order("checkin_date", { ascending: true }).limit(14),
    supabase.from("calendar_events").select("*").eq("user_id", user.id),
  ]);

  const name = profile?.known_as || profile?.full_name || "Player";
  const player = playerRow ? mapPlayer(user.id, name, playerRow) : null;
  const data = emptyLocker(name, player);

  // Recent match (most recent past) + next fixture (nearest future).
  const now = Date.now();
  const past = (matches ?? []).filter((m) => new Date(m.played_at).getTime() <= now);
  const future = (matches ?? [])
    .filter((m) => new Date(m.played_at).getTime() > now)
    .sort((a, b) => new Date(a.played_at).getTime() - new Date(b.played_at).getTime());

  if (past[0]) {
    const m = past[0];
    const { data: stats } = await supabase
      .from("match_stats")
      .select("*")
      .eq("match_id", m.id)
      .maybeSingle();
    data.recentMatch = { ...mapMatch(m), stats: stats ? statLine(stats) : [] };
  }
  if (future[0]) {
    const m = future[0];
    const days = Math.max(0, Math.ceil((new Date(m.played_at).getTime() - now) / 86400000));
    data.nextMatch = {
      opponent: m.opponent,
      competition: m.competition,
      home: m.home,
      expectedPosition: m.position ?? player?.primaryPosition,
      daysRemaining: days,
      md: days <= 5 ? `MD-${days}` : `MD-${days}`,
    };
  }

  data.goals = (goals ?? []).map(mapGoal);
  data.focus = data.goals
    .filter((g) => g.status === "active")
    .slice(0, 3)
    .map((g) => ({ id: g.id, category: g.category, title: g.title, detail: g.why, goalId: g.id }));

  data.readiness = {
    latest: checkins?.length ? mapCheckin(checkins[checkins.length - 1]) : null,
    rpe: [],
  };
  data.checkedInToday = (checkins ?? []).some((c) => c.checkin_date === todayISO);

  data.week = (events ?? [])
    .map(mapEvent)
    .filter((e): e is WeekEvent => e !== null);
  data.todayIndex = todayIndex;

  return data;
}

// ---------- mappers (DB row → app type) ----------

function mapPlayer(id: string, name: string, r: Record<string, unknown>): PlayerProfile {
  const dob = (r.date_of_birth as string) ?? "";
  const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 3.15576e10) : 0;
  return {
    id,
    role: "player",
    firstName: name.split(" ")[0] ?? name,
    lastName: name.split(" ").slice(1).join(" "),
    knownAs: name,
    initials: name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "P",
    dateOfBirth: dob,
    age,
    nationality: (r.nationality as string) ?? "",
    foot: (r.foot as PlayerProfile["foot"]) ?? "Right",
    heightCm: (r.height_cm as number) ?? 0,
    weightKg: (r.weight_kg as number) ?? 0,
    primaryPosition: (r.primary_position as PlayerProfile["primaryPosition"]) ?? "CF",
    secondaryPosition: (r.secondary_position as PlayerProfile["secondaryPosition"]) ?? "RW",
    club: (r.club as string) ?? "",
    league: (r.league as string) ?? "",
    squadNumber: (r.squad_number as number) ?? 0,
    season: (r.season as string) ?? "",
    level: (r.level as string) ?? "",
  };
}

function mapMatch(m: Record<string, unknown>): Match {
  return {
    id: m.id as string,
    opponent: m.opponent as string,
    opponentShort: (m.opponent as string).slice(0, 3).toUpperCase(),
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

function statLine(s: Record<string, unknown>): Metric[] {
  const n = (v: unknown) => (v == null ? "—" : String(v));
  return [
    { label: "Shots / OT", value: `${n(s.shots)} / ${n(s.shots_on_target)}` },
    { label: "Touches", value: n(s.touches) },
    { label: "Key passes", value: n(s.key_passes) },
    { label: "Duels won", value: `${n(s.duels_won)} / ${n(s.duels_total)}` },
  ];
}

function mapGoal(g: Record<string, unknown>): DevelopmentGoal {
  return {
    id: g.id as string,
    index: 0,
    category: g.category as DevelopmentCategory,
    title: g.title as string,
    status: (g.status as DevelopmentGoal["status"]) ?? "active",
    createdLabel: new Date((g.created_at as string) ?? Date.now()).toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    }),
    why: (g.why as string) ?? "",
    evidence: { clips: 0, training: 0, study: 0, coachNotes: 0 },
    progress: (g.progress as number) ?? 0,
  };
}

function mapCheckin(c: Record<string, unknown>): ReadinessDay {
  return {
    date: c.checkin_date as string,
    energy: (c.energy as number) ?? 3,
    soreness: (c.soreness as number) ?? 3,
    sleep: (c.sleep as number) ?? 3,
    mental: (c.mental as number) ?? 3,
  };
}

function mapEvent(e: Record<string, unknown>): WeekEvent | null {
  const start = e.starts_at ? new Date(e.starts_at as string) : null;
  if (!start) return null;
  return {
    id: e.id as string,
    day: weekdayIndex(start),
    kind: (e.kind as WeekEvent["kind"]) ?? "team",
    label: e.title as string,
    md: (e.md_tag as WeekEvent["md"]) ?? undefined,
    time: start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}
