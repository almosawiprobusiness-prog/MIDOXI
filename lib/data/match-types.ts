import type { Match } from "@/lib/types";

/** Form input for creating/updating a match. */
export interface MatchInput {
  opponent: string;
  competition?: string;
  playedAt: string; // ISO datetime-local
  home: boolean;
  goalsFor?: number | null;
  goalsAgainst?: number | null;
  formation?: string;
  position?: string;
  started: boolean;
  minutes?: number | null;
  rating?: number | null;
  goals: number;
  assists: number;
}

export interface MatchStatsInput {
  shots?: number | null;
  shotsOnTarget?: number | null;
  touches?: number | null;
  passes?: number | null;
  passPct?: number | null;
  keyPasses?: number | null;
  chancesCreated?: number | null;
  dribbles?: number | null;
  duelsWon?: number | null;
  duelsTotal?: number | null;
  aerialsWon?: number | null;
  recoveries?: number | null;
  interceptions?: number | null;
  tackles?: number | null;
  foulsWon?: number | null;
  foulsCommitted?: number | null;
  offsides?: number | null;
  yellow?: number | null;
  red?: number | null;
}

export interface MatchReviewInput {
  didWell?: string;
  couldImprove?: string;
  repeated?: string;
  bestDecision?: string;
  momentToStudy?: string;
  intoTraining?: string;
  selfRating?: number | null;
  confidence?: number | null;
  physicalFeel?: number | null;
  mentalFeel?: number | null;
}

export interface MatchDetail {
  match: Match;
  stats: MatchStatsInput | null;
  review: MatchReviewInput | null;
}

/** Numeric stat fields, in display order, for building the entry form. */
export const STAT_FIELDS: { key: keyof MatchStatsInput; label: string }[] = [
  { key: "shots", label: "Shots" },
  { key: "shotsOnTarget", label: "On target" },
  { key: "touches", label: "Touches" },
  { key: "passes", label: "Passes" },
  { key: "passPct", label: "Pass %" },
  { key: "keyPasses", label: "Key passes" },
  { key: "chancesCreated", label: "Chances" },
  { key: "dribbles", label: "Dribbles" },
  { key: "duelsWon", label: "Duels won" },
  { key: "duelsTotal", label: "Duels total" },
  { key: "aerialsWon", label: "Aerials won" },
  { key: "recoveries", label: "Recoveries" },
  { key: "interceptions", label: "Interceptions" },
  { key: "tackles", label: "Tackles" },
  { key: "foulsWon", label: "Fouls won" },
  { key: "foulsCommitted", label: "Fouls comm." },
  { key: "offsides", label: "Offsides" },
  { key: "yellow", label: "Yellow" },
  { key: "red", label: "Red" },
];

export const REVIEW_PROMPTS: { key: keyof MatchReviewInput; label: string; hint: string }[] = [
  { key: "didWell", label: "What did I do well?", hint: "Your strongest moments" },
  { key: "couldImprove", label: "What could I have done better?", hint: "Be specific" },
  { key: "repeated", label: "What repeated from previous matches?", hint: "Patterns matter" },
  { key: "bestDecision", label: "Which decision am I happiest with?", hint: "" },
  { key: "momentToStudy", label: "What moment should I study?", hint: "Feeds Film Room" },
  { key: "intoTraining", label: "What needs to enter next week's training?", hint: "" },
];
