/*
  Coach OS — shared shapes.

  Client-safe: types, constants and pure helpers only, so forms, boards and
  server adapters all speak the same language.
*/

// ── squad ────────────────────────────────────────────────────

export type SquadStatus = "active" | "trial" | "injured" | "left";

export interface SquadPlayer {
  id: string;
  name: string;
  position: string;
  squadNumber: number | null;
  status: SquadStatus;
  /** The development headline the coach is currently reinforcing. */
  focus: string | null;
  /** True when the player has their own MIDO XI account linked. */
  linked: boolean;
  /** What a linked player has chosen to share. Null when not linked. */
  shareScope: "identity" | "development" | "full" | null;
  createdAt: string;
}

export interface SquadPlayerInput {
  name: string;
  position: string;
  squadNumber: number | null;
  status: SquadStatus;
  focus: string;
}

export const SQUAD_STATUS: { value: SquadStatus; label: string; color: string }[] = [
  { value: "active", label: "Available", color: "var(--positive)" },
  { value: "trial", label: "Trial", color: "var(--info)" },
  { value: "injured", label: "Injured", color: "var(--correction)" },
  { value: "left", label: "Left", color: "var(--text-faint)" },
];

export function statusMeta(status: SquadStatus) {
  return SQUAD_STATUS.find((s) => s.value === status) ?? SQUAD_STATUS[0];
}

export type PlayerNoteKind = "focus" | "performance" | "note" | "session" | "match";

export interface PlayerNote {
  id: string;
  playerId: string;
  kind: PlayerNoteKind;
  body: string;
  createdAt: string;
}

export const NOTE_KINDS: { kind: PlayerNoteKind; label: string; color: string }[] = [
  { kind: "focus", label: "Development focus", color: "var(--signal-bright)" },
  { kind: "performance", label: "Performance", color: "var(--info)" },
  { kind: "session", label: "In training", color: "var(--positive)" },
  { kind: "match", label: "In a match", color: "var(--review)" },
  { kind: "note", label: "Note", color: "var(--text-dim)" },
];

export function noteKindMeta(kind: PlayerNoteKind) {
  return NOTE_KINDS.find((n) => n.kind === kind) ?? NOTE_KINDS[4];
}

// ── session planner ──────────────────────────────────────────

export type SessionPhase =
  | "warmup"
  | "technical"
  | "tactical"
  | "possession"
  | "conditioned-game"
  | "match-scenario"
  | "set-piece"
  | "cooldown";

export const SESSION_PHASES: { phase: SessionPhase; label: string; color: string; hint: string }[] = [
  { phase: "warmup", label: "Warm-up", color: "var(--positive)", hint: "Prepare the body and the theme" },
  { phase: "technical", label: "Technical", color: "var(--signal-bright)", hint: "Isolated repetition of the action" },
  { phase: "tactical", label: "Tactical", color: "var(--info)", hint: "The principle, with opposition" },
  { phase: "possession", label: "Possession", color: "#c58bff", hint: "Positional or possession game" },
  { phase: "conditioned-game", label: "Conditioned game", color: "var(--review)", hint: "Rules that force the behaviour" },
  { phase: "match-scenario", label: "Match scenario", color: "var(--correction)", hint: "Free play in a match picture" },
  { phase: "set-piece", label: "Set piece", color: "var(--text-dim)", hint: "Dead-ball work" },
  { phase: "cooldown", label: "Cool-down", color: "var(--positive)", hint: "Recover and review" },
];

export function phaseMeta(phase: SessionPhase) {
  return SESSION_PHASES.find((p) => p.phase === phase) ?? SESSION_PHASES[1];
}

export type SessionStatus = "draft" | "planned" | "delivered";
export type SessionSource = "coach" | "mido" | "study";

export interface SessionBlock {
  id: string;
  phase: SessionPhase;
  name: string;
  durationMin: number | null;
  organisation: string;
  coachingPoints: string[];
  progression: string;
  regression: string;
  position: number;
}

export interface SessionBlockInput {
  phase: SessionPhase;
  name: string;
  durationMin: number | null;
  organisation: string;
  coachingPoints: string[];
  progression: string;
  regression: string;
}

export interface SessionPlan {
  id: string;
  title: string;
  scheduledAt: string | null;
  durationMin: number | null;
  objective: string;
  playersCount: number | null;
  pitch: string;
  intensity: "low" | "moderate" | "high" | null;
  status: SessionStatus;
  source: SessionSource;
  notes: string;
  createdAt: string;
}

export interface SessionPlanInput {
  title: string;
  scheduledAt: string;
  durationMin: number | null;
  objective: string;
  playersCount: number | null;
  pitch: string;
  intensity: "low" | "moderate" | "high" | null;
  status: SessionStatus;
}

export interface SessionPlanDetail {
  plan: SessionPlan;
  blocks: SessionBlock[];
}

/** Total planned minutes across the blocks. */
export function plannedMinutes(blocks: SessionBlock[]): number {
  return blocks.reduce((s, b) => s + (b.durationMin ?? 0), 0);
}

// ── tactical board ───────────────────────────────────────────

export type TokenTeam = "home" | "away" | "ball" | "cone";

export interface BoardToken {
  id: string;
  team: TokenTeam;
  label: string;
  /** Normalised pitch coordinates, 0–100 on both axes. */
  x: number;
  y: number;
}

export type ArrowKind = "run" | "pass" | "dribble" | "press";

export interface BoardArrow {
  id: string;
  kind: ArrowKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface BoardZone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface BoardData {
  tokens: BoardToken[];
  arrows: BoardArrow[];
  zones: BoardZone[];
}

export const ARROW_KINDS: { kind: ArrowKind; label: string; color: string; dash: string }[] = [
  { kind: "run", label: "Run", color: "var(--signal-bright)", dash: "" },
  { kind: "pass", label: "Pass", color: "var(--positive)", dash: "6 4" },
  { kind: "dribble", label: "Dribble", color: "var(--review)", dash: "2 3" },
  { kind: "press", label: "Press", color: "var(--correction)", dash: "10 4" },
];

export function arrowMeta(kind: ArrowKind) {
  return ARROW_KINDS.find((a) => a.kind === kind) ?? ARROW_KINDS[0];
}

export type BoardPhase = "in-possession" | "out-of-possession" | "transition" | "set-piece";

export const BOARD_PHASES: { phase: BoardPhase; label: string }[] = [
  { phase: "in-possession", label: "In possession" },
  { phase: "out-of-possession", label: "Out of possession" },
  { phase: "transition", label: "Transition" },
  { phase: "set-piece", label: "Set piece" },
];

export interface TacticalBoard {
  id: string;
  title: string;
  formation: string;
  phase: BoardPhase;
  board: BoardData;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface TacticalBoardInput {
  title: string;
  formation: string;
  phase: BoardPhase;
  board: BoardData;
  notes: string;
}

/**
 * Formation presets as normalised coordinates, attacking upwards.
 * y=8 is the goalkeeper's line; y=88 is the opposition box.
 */
export const FORMATIONS: Record<string, { label: string; x: number; y: number }[]> = {
  "4-3-3": [
    { label: "GK", x: 50, y: 7 },
    { label: "RB", x: 84, y: 24 },
    { label: "RCB", x: 62, y: 18 },
    { label: "LCB", x: 38, y: 18 },
    { label: "LB", x: 16, y: 24 },
    { label: "6", x: 50, y: 36 },
    { label: "8", x: 66, y: 50 },
    { label: "10", x: 34, y: 50 },
    { label: "RW", x: 86, y: 70 },
    { label: "CF", x: 50, y: 78 },
    { label: "LW", x: 14, y: 70 },
  ],
  "4-2-3-1": [
    { label: "GK", x: 50, y: 7 },
    { label: "RB", x: 84, y: 24 },
    { label: "RCB", x: 62, y: 18 },
    { label: "LCB", x: 38, y: 18 },
    { label: "LB", x: 16, y: 24 },
    { label: "6", x: 62, y: 38 },
    { label: "6", x: 38, y: 38 },
    { label: "RW", x: 84, y: 62 },
    { label: "10", x: 50, y: 58 },
    { label: "LW", x: 16, y: 62 },
    { label: "CF", x: 50, y: 80 },
  ],
  "4-4-2": [
    { label: "GK", x: 50, y: 7 },
    { label: "RB", x: 84, y: 24 },
    { label: "RCB", x: 62, y: 18 },
    { label: "LCB", x: 38, y: 18 },
    { label: "LB", x: 16, y: 24 },
    { label: "RM", x: 84, y: 48 },
    { label: "CM", x: 60, y: 44 },
    { label: "CM", x: 40, y: 44 },
    { label: "LM", x: 16, y: 48 },
    { label: "ST", x: 60, y: 76 },
    { label: "ST", x: 40, y: 76 },
  ],
  "3-5-2": [
    { label: "GK", x: 50, y: 7 },
    { label: "RCB", x: 70, y: 18 },
    { label: "CB", x: 50, y: 16 },
    { label: "LCB", x: 30, y: 18 },
    { label: "RWB", x: 90, y: 46 },
    { label: "8", x: 66, y: 46 },
    { label: "6", x: 50, y: 36 },
    { label: "8", x: 34, y: 46 },
    { label: "LWB", x: 10, y: 46 },
    { label: "ST", x: 60, y: 76 },
    { label: "ST", x: 40, y: 76 },
  ],
  "3-4-3": [
    { label: "GK", x: 50, y: 7 },
    { label: "RCB", x: 70, y: 18 },
    { label: "CB", x: 50, y: 16 },
    { label: "LCB", x: 30, y: 18 },
    { label: "RWB", x: 90, y: 44 },
    { label: "8", x: 62, y: 42 },
    { label: "8", x: 38, y: 42 },
    { label: "LWB", x: 10, y: 44 },
    { label: "RW", x: 78, y: 72 },
    { label: "CF", x: 50, y: 78 },
    { label: "LW", x: 22, y: 72 },
  ],
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);

/** A fresh board for a formation, with the opposition block sketched in. */
export function boardFromFormation(formation: string): BoardData {
  const shape = FORMATIONS[formation] ?? FORMATIONS["4-3-3"];
  const tokens: BoardToken[] = shape.map((p, i) => ({
    id: `h${i}`,
    team: "home",
    label: p.label,
    x: p.x,
    y: p.y,
  }));
  // A mirrored back four + midfield line to defend against.
  const away: { label: string; x: number; y: number }[] = [
    { label: "GK", x: 50, y: 95 },
    { label: "RB", x: 18, y: 80 },
    { label: "CB", x: 40, y: 84 },
    { label: "CB", x: 60, y: 84 },
    { label: "LB", x: 82, y: 80 },
    { label: "CM", x: 34, y: 64 },
    { label: "CM", x: 66, y: 64 },
  ];
  tokens.push(
    ...away.map((p, i) => ({ id: `a${i}`, team: "away" as const, label: p.label, x: p.x, y: p.y })),
  );
  tokens.push({ id: "ball", team: "ball", label: "", x: 50, y: 12 });
  return { tokens, arrows: [], zones: [] };
}

// ── opposition ───────────────────────────────────────────────

export interface OppositionKeyPlayer {
  name: string;
  position: string;
  threat: string;
}

export interface OppositionReport {
  id: string;
  opponent: string;
  competition: string;
  matchDate: string | null;
  home: boolean | null;
  formation: string;
  keyPlayers: OppositionKeyPlayer[];
  inPossession: string[];
  outOfPossession: string[];
  transition: string[];
  setPieces: string[];
  weaknesses: string[];
  notes: string;
  plan: MatchPlan | null;
  planSource: "coach" | "mido" | null;
  createdAt: string;
}

export interface OppositionReportInput {
  opponent: string;
  competition: string;
  matchDate: string;
  home: boolean;
  formation: string;
  keyPlayers: OppositionKeyPlayer[];
  inPossession: string[];
  outOfPossession: string[];
  transition: string[];
  setPieces: string[];
  weaknesses: string[];
  notes: string;
}

export interface MatchPlanSection {
  title: string;
  points: string[];
}

export interface MatchPlan {
  headline: string;
  sections: MatchPlanSection[];
  /** Which recorded observations the plan was built from. */
  basedOn: string[];
  generatedAt: string;
}

/** Every observation recorded on a report, flattened for the AI and the UI. */
export function observationCount(r: OppositionReport | OppositionReportInput): number {
  return (
    r.inPossession.length +
    r.outOfPossession.length +
    r.transition.length +
    r.setPieces.length +
    r.weaknesses.length +
    r.keyPlayers.length
  );
}

export const OBSERVATION_GROUPS: {
  key: "inPossession" | "outOfPossession" | "transition" | "setPieces" | "weaknesses";
  label: string;
  hint: string;
  color: string;
}[] = [
  { key: "inPossession", label: "In possession", hint: "How they build and attack", color: "var(--signal-bright)" },
  { key: "outOfPossession", label: "Out of possession", hint: "Shape, pressing, triggers", color: "var(--info)" },
  { key: "transition", label: "Transition", hint: "What happens in the first seconds", color: "var(--review)" },
  { key: "setPieces", label: "Set pieces", hint: "Routines, deliveries, marking", color: "#c58bff" },
  { key: "weaknesses", label: "Weaknesses", hint: "Where they can be hurt", color: "var(--positive)" },
];
