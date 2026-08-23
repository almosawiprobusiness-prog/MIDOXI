/*
  MIDO XI — Domain model.
  These types mirror a relational schema (players, matches,
  match_player_stats, clips, training_sessions, development_goals,
  calendar_events, daily_checkins ...). The seed layer implements
  them in-memory today; a Supabase/Postgres adapter can implement
  the same shapes later without touching the UI.
*/

/* Role identity lives in the role registry (lib/roles/roles.ts) so that
   navigation, terminology and AI persona resolve from one place. */
export type { RoleId } from "@/lib/roles/roles";
import type { RoleId } from "@/lib/roles/roles";

/** The four MIDO XI operating systems. */
export type Role = RoleId;

export type Position =
  | "GK"
  | "RB"
  | "RCB"
  | "LCB"
  | "LB"
  | "RWB"
  | "LWB"
  | "6"
  | "8"
  | "10"
  | "RW"
  | "LW"
  | "CF"
  | "ST";

export type Foot = "Right" | "Left" | "Both";

export interface PlayerProfile {
  id: string;
  role: Role;
  firstName: string;
  lastName: string;
  knownAs: string;
  initials: string;
  dateOfBirth: string;
  age: number;
  nationality: string;
  foot: Foot;
  heightCm: number;
  weightKg: number;
  primaryPosition: Position;
  secondaryPosition: Position;
  club: string;
  league: string;
  squadNumber: number;
  season: string;
  level: string;
}

/** Matchday notation relative to the next fixture. */
export type MatchdayTag =
  | "MD-5"
  | "MD-4"
  | "MD-3"
  | "MD-2"
  | "MD-1"
  | "MD"
  | "MD+1"
  | "MD+2";

export type ClipSentiment = "positive" | "review" | "correction";

export type DevelopmentCategory =
  | "technical"
  | "tactical"
  | "physical"
  | "mental"
  | "positional";

export type SessionKind =
  | "team"
  | "individual"
  | "gym"
  | "conditioning"
  | "speed"
  | "recovery"
  | "mobility"
  | "film"
  | "tactical"
  | "technical";

export interface Match {
  id: string;
  opponent: string;
  opponentShort: string;
  competition: string;
  date: string; // ISO
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  formation: string;
  position: Position;
  started: boolean;
  minutes: number;
  rating: number; // 1–10
  goals: number;
  assists: number;
  reviewed: boolean;
}

export interface FocusArea {
  id: string;
  category: DevelopmentCategory;
  title: string;
  detail: string;
  goalId?: string;
}

export interface ReadinessDay {
  date: string; // ISO date
  energy: number; // 1–5
  soreness: number; // 1–5 (higher = more sore)
  sleep: number; // 1–5
  mental: number; // 1–5
  rpe?: number; // 1–10 session load, optional
}

export interface WeekEvent {
  id: string;
  day: number; // 0 = Mon ... 6 = Sun
  kind: SessionKind | "match";
  label: string;
  md?: MatchdayTag;
  time?: string;
}

export interface DevelopmentGoal {
  id: string;
  index: number;
  category: DevelopmentCategory;
  title: string;
  status: "active" | "monitoring" | "achieved";
  createdLabel: string;
  why: string;
  evidence: { clips: number; training: number; study: number; coachNotes: number; matches?: number };
  progress: number; // 0–100, evidence-weighted
}

export interface Clip {
  id: string;
  timestamp: string; // mm:ss film time
  title: string;
  sentiment: ClipSentiment;
  note: string;
  tags: string[];
  matchId?: string;
  goalId?: string;
}

export type Metric = {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "flat";
};
