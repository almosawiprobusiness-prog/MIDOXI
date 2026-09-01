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

/*
  The board moved to `lib/tactics` in migration 0044, because it stopped
  being a Coach OS feature and became a primitive that Trainer OS, Player
  OS and MIDO all use. What remains here is the V1 SHAPE — the
  `{tokens, arrows, zones}` still stored in `tactical_boards.board` — and
  the re-exports that keep existing importers working.

  New code should import from `@/lib/tactics/types` and
  `@/lib/tactics/document` directly.
*/

export {
  BOARD_PHASES,
  type BoardPhase,
} from "@/lib/tactics/types";

export {
  FORMATIONS,
  FORMATION_NAMES,
} from "@/lib/tactics/document";

import { documentFromFormation, toLegacy } from "@/lib/tactics/document";

/** v1 token teams. Superseded by `EntityKind`, still on disk. */
export type TokenTeam = "home" | "away" | "ball" | "cone";

export interface BoardToken {
  id: string;
  team: TokenTeam;
  label: string;
  /** Normalised pitch coordinates, 0–100 on both axes. */
  x: number;
  y: number;
}

/** v1 arrow kinds. Superseded by `PathKind`, which adds five more. */
export type ArrowKind = "run" | "pass" | "dribble" | "press";

export interface BoardArrow {
  id: string;
  kind: ArrowKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface BoardZoneV1 {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

/** The v1 document, as `tactical_boards.board` still holds it. */
export interface BoardData {
  tokens: BoardToken[];
  arrows: BoardArrow[];
  zones: BoardZoneV1[];
}

/**
 * A fresh board for a formation, in the v1 shape.
 *
 * Now derived from `documentFromFormation` and projected back, so the
 * one definition of a 4-3-3 lives in `lib/tactics` and this cannot drift
 * from what the editor actually creates.
 */
export function boardFromFormation(formation: string): BoardData {
  return toLegacy(documentFromFormation(formation));
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
