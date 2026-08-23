import type {
  PlayerProfile,
  Match,
  FocusArea,
  ReadinessDay,
  WeekEvent,
  DevelopmentGoal,
  Clip,
  Metric,
} from "./types";

/*
  SEED / DEMO DATA — clearly fictional, for building & testing the
  interface. Marked `isSeed` so the UI can badge it. Replace via a
  real data adapter once auth + database are wired.
*/

export const isSeed = true;

/** Anchor "today" for the demo so the week + fixtures stay coherent. */
export const DEMO_TODAY = "2026-08-12";

export const player: PlayerProfile = {
  id: "p_mido",
  role: "player",
  firstName: "Mohamed",
  lastName: "Almosawi",
  knownAs: "MIDO",
  initials: "MA",
  dateOfBirth: "2004-03-19",
  age: 22,
  nationality: "Iraq",
  foot: "Right",
  heightCm: 183,
  weightKg: 76,
  primaryPosition: "CF",
  secondaryPosition: "RW",
  club: "Northgate FC",
  league: "Championship North",
  squadNumber: 9,
  season: "2026 / 27",
  level: "Senior · Semi-Professional",
};

/** The next fixture — season opener, three days out (MD-3). */
export const nextMatch = {
  opponent: "Riverside Athletic",
  opponentShort: "RIV",
  competition: "League · Round 1",
  date: "2026-08-15T15:00:00",
  home: true,
  venue: "Northgate Park",
  expectedPosition: "CF" as const,
  daysRemaining: 3,
  md: "MD-3" as const,
};

export const recentMatch: Match = {
  id: "m_ip",
  opponent: "Halton Town",
  opponentShort: "HAL",
  competition: "Pre-Season Cup · Final",
  date: "2026-08-09T15:00:00",
  home: false,
  goalsFor: 2,
  goalsAgainst: 1,
  formation: "4-3-3",
  position: "CF",
  started: true,
  minutes: 78,
  rating: 7.6,
  goals: 1,
  assists: 1,
  reviewed: true,
};

/** Detailed stat line for the most recent match (position-aware). */
export const recentMatchStats: Metric[] = [
  { label: "Minutes", value: "78" },
  { label: "Goals", value: "1" },
  { label: "Assists", value: "1" },
  { label: "Shots / OT", value: "4 / 2" },
  { label: "Box touches", value: "9", trend: "up" },
  { label: "Runs in behind", value: "6", trend: "up" },
  { label: "Duels won", value: "7 / 11" },
  { label: "Pressing actions", value: "14", trend: "up" },
];

export const currentFocus: FocusArea[] = [
  {
    id: "f1",
    category: "technical",
    title: "Near-post finishing",
    detail: "Attack the front zone — finish early, across the keeper less.",
    goalId: "g1",
  },
  {
    id: "f2",
    category: "tactical",
    title: "Pressing triggers",
    detail: "Read the CB's first touch — curve the run to lock the inside.",
    goalId: "g2",
  },
  {
    id: "f3",
    category: "positional",
    title: "Blindside movement",
    detail: "Start outside the defender's vision before the switch arrives.",
    goalId: "g3",
  },
];

/** Last 10 days of readiness check-ins (most recent last). */
export const readiness: ReadinessDay[] = [
  { date: "2026-08-03", energy: 4, soreness: 2, sleep: 4, mental: 4, rpe: 6 },
  { date: "2026-08-04", energy: 3, soreness: 3, sleep: 3, mental: 4, rpe: 7 },
  { date: "2026-08-05", energy: 4, soreness: 2, sleep: 4, mental: 5, rpe: 5 },
  { date: "2026-08-06", energy: 5, soreness: 1, sleep: 5, mental: 5, rpe: 8 },
  { date: "2026-08-07", energy: 4, soreness: 2, sleep: 4, mental: 4, rpe: 4 },
  { date: "2026-08-08", energy: 3, soreness: 3, sleep: 3, mental: 4 },
  { date: "2026-08-09", energy: 3, soreness: 4, sleep: 3, mental: 5, rpe: 9 },
  { date: "2026-08-10", energy: 3, soreness: 4, sleep: 4, mental: 4, rpe: 3 },
  { date: "2026-08-11", energy: 4, soreness: 2, sleep: 4, mental: 4, rpe: 6 },
  { date: "2026-08-12", energy: 4, soreness: 2, sleep: 5, mental: 5, rpe: 7 },
];

export const todayCheckedIn = true;

/** The training week — Mon(0) → Sun(6). Season opener is Saturday. */
export const weekEvents: WeekEvent[] = [
  { id: "w1", day: 0, kind: "recovery", label: "Recovery + Pool", md: "MD-5", time: "10:00" },
  { id: "w2", day: 1, kind: "team", label: "Team Training", md: "MD-4", time: "10:30" },
  { id: "w2b", day: 1, kind: "gym", label: "Lower Power", time: "13:00" },
  { id: "w3", day: 2, kind: "team", label: "Team Training", md: "MD-3", time: "10:30" },
  { id: "w3b", day: 2, kind: "individual", label: "Finishing · Individual", time: "12:30" },
  { id: "w4", day: 3, kind: "tactical", label: "Opposition Shape", md: "MD-2", time: "10:30" },
  { id: "w5", day: 4, kind: "team", label: "Activation + Set Pieces", md: "MD-1", time: "11:00" },
  { id: "w5b", day: 4, kind: "film", label: "Opponent Study · RIV", time: "15:00" },
  { id: "w6", day: 5, kind: "match", label: "Riverside Athletic (H)", md: "MD", time: "15:00" },
  { id: "w7", day: 6, kind: "recovery", label: "Recovery", md: "MD+1", time: "11:00" },
];

export const developmentGoals: DevelopmentGoal[] = [
  {
    id: "g1",
    index: 1,
    category: "technical",
    title: "Near-post finishing",
    status: "active",
    createdLabel: "Aug 2026",
    why: "I arrive correctly but finish across goal too often. Front-post is open.",
    evidence: { clips: 3, training: 4, study: 2, coachNotes: 1 },
    progress: 46,
  },
  {
    id: "g2",
    index: 2,
    category: "tactical",
    title: "Pressing trigger recognition",
    status: "active",
    createdLabel: "Jul 2026",
    why: "First press is a beat late — I react to the ball, not the touch.",
    evidence: { clips: 5, training: 3, study: 3, coachNotes: 2 },
    progress: 62,
  },
  {
    id: "g3",
    index: 3,
    category: "positional",
    title: "Blindside movement",
    status: "monitoring",
    createdLabel: "Jul 2026",
    why: "Show for the ball too early — CB tracks me the whole way.",
    evidence: { clips: 4, training: 2, study: 2, coachNotes: 1 },
    progress: 38,
  },
];

export const recentClips: Clip[] = [
  {
    id: "c1",
    timestamp: "67:14",
    title: "Run in behind — goal",
    sentiment: "positive",
    note: "Waited until the CB checked the ball before accelerating.",
    tags: ["Movement", "Timing", "Final Third"],
    matchId: "m_ip",
    goalId: "g3",
  },
  {
    id: "c2",
    timestamp: "41:02",
    title: "Near-post arrival",
    sentiment: "review",
    note: "Right zone, right time — chose to cut back instead of finishing early.",
    tags: ["Finishing", "Decision Making"],
    matchId: "m_ip",
    goalId: "g1",
  },
  {
    id: "c3",
    timestamp: "12:48",
    title: "Late first press",
    sentiment: "correction",
    note: "Reacted to the pass, not the touch. Trigger was the open body shape.",
    tags: ["Pressing", "Transition"],
    matchId: "m_ip",
    goalId: "g2",
  },
];

export const seasonMetrics: Metric[] = [
  { label: "Matches", value: "6" },
  { label: "Starts", value: "5" },
  { label: "Minutes", value: "428" },
  { label: "Goals", value: "4", trend: "up" },
  { label: "Assists", value: "3", trend: "up" },
  { label: "G+A / 90", value: "1.47", trend: "up" },
  { label: "Avg rating", value: "7.2", trend: "flat" },
  { label: "Min / goal", value: "107" },
];

/** Small study assignment shown on the Locker. */
export const studyAssignment = {
  title: "Opponent Study — Riverside Athletic",
  detail: "Right center-back steps early into the channel. Find the blindside.",
  duration: "18 min",
  clips: 5,
};
