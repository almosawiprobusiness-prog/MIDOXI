/*
  The tactical document — MIDO XI's football primitive.

  Client-safe: types, enums and pure helpers only, so the editor, the
  viewer, the server actions and the AI engines all read one definition.

  WHY THIS IS NOT A DRAWING FORMAT. A tactical board could be stored as
  shapes — a circle here, a line there — and it would render perfectly.
  It would also be worthless to MIDO. "Explain this board", "turn this
  into a drill", "adapt it for U14s" are all impossible against a bag of
  coordinates, because nothing in the file says a circle is a striker or
  that a red line is a press rather than a pass.

  So every object carries its football meaning. An entity knows it is a
  goalkeeper. A path knows it is a press. A zone knows it is the space
  being attacked. The renderer derives its colours from that meaning,
  which means the picture and the data can never disagree — and it means
  a board can be read, summarised and rewritten by something that has
  never seen the pixels.

  Version 1 of this format (migration 0006) was `{tokens, arrows, zones}`.
  It is still on disk and still valid; `document.ts` upgrades it on read.
*/

// ── coordinates ──────────────────────────────────────────────

/*
  Normalised 0–100 on both axes, attacking UPWARDS (y=100 is the
  opposition goal line). Inherited from v1 and kept deliberately: it is
  resolution-independent, and every board already written uses it.
*/
export interface Point {
  x: number;
  y: number;
}

// ── the pitch ────────────────────────────────────────────────

/**
 * How much of a pitch this board shows.
 *
 * Trainer work rarely happens on a full pitch — a finishing drill lives
 * in the box, a rondo in a 20x20 grid — and drawing those on a full
 * pitch makes the detail unreadable. The surface is part of the
 * football, so it is part of the document.
 */
export type PitchType =
  | "full"
  | "half"
  | "final-third"
  | "penalty-area"
  | "grid"
  | "blank";

export const PITCH_TYPES: { type: PitchType; label: string; hint: string }[] = [
  { type: "full", label: "Full pitch", hint: "Team shape, phases of play" },
  { type: "half", label: "Half pitch", hint: "Attacking or defending organisation" },
  { type: "final-third", label: "Final third", hint: "Chance creation and finishing" },
  { type: "penalty-area", label: "Penalty area", hint: "Finishing, crossing, set pieces" },
  { type: "grid", label: "Grid", hint: "Rondos, possession squares, small-sided" },
  { type: "blank", label: "Blank", hint: "Anything the shapes above cannot say" },
];

export interface PitchSpec {
  type: PitchType;
  /** "Attacking up" is the default; a grid may read better sideways. */
  orientation: "vertical" | "horizontal";
  /** Real-world size of a grid or custom area, e.g. "20 x 20 m". Display only. */
  dimensions?: string | null;
}

export const DEFAULT_PITCH: PitchSpec = { type: "full", orientation: "vertical", dimensions: null };

// ── entities ─────────────────────────────────────────────────

/**
 * What is standing on the grass.
 *
 * `player` and `opponent` are distinct types rather than one type with a
 * team flag, because that is how a coach thinks and how the AI must read
 * it: "the opponent's left back jumps" is a sentence about a kind of
 * thing, not about a colour.
 */
export type EntityKind =
  | "player"
  | "goalkeeper"
  | "opponent"
  | "opponent-goalkeeper"
  | "neutral"
  | "ball"
  | "cone"
  | "mannequin"
  | "goal"
  | "mini-goal";

export const ENTITY_KINDS: { kind: EntityKind; label: string; group: "people" | "equipment" }[] = [
  { kind: "player", label: "Player", group: "people" },
  { kind: "goalkeeper", label: "Goalkeeper", group: "people" },
  { kind: "opponent", label: "Opponent", group: "people" },
  { kind: "opponent-goalkeeper", label: "Opposition GK", group: "people" },
  { kind: "neutral", label: "Neutral / server", group: "people" },
  { kind: "ball", label: "Ball", group: "equipment" },
  { kind: "cone", label: "Cone", group: "equipment" },
  { kind: "mannequin", label: "Mannequin", group: "equipment" },
  { kind: "goal", label: "Goal", group: "equipment" },
  { kind: "mini-goal", label: "Mini goal", group: "equipment" },
];

/** Is this thing a person? Decides whether a label/role is meaningful. */
export function isPersonKind(kind: EntityKind): boolean {
  return ["player", "goalkeeper", "opponent", "opponent-goalkeeper", "neutral"].includes(kind);
}

/** Which side an entity belongs to — derived, never stored twice. */
export function sideOf(kind: EntityKind): "ours" | "theirs" | "neutral" {
  if (kind === "player" || kind === "goalkeeper") return "ours";
  if (kind === "opponent" || kind === "opponent-goalkeeper") return "theirs";
  return "neutral";
}

export interface BoardEntity {
  id: string;
  kind: EntityKind;
  x: number;
  y: number;
  /** What is written on the token — "9", "RB", "GK". */
  label?: string;
  /** Positional role, when it is known separately from the label. */
  role?: string | null;
  /** A real squad member, when this token represents a specific person. */
  playerId?: string | null;
}

// ── movement ─────────────────────────────────────────────────

/**
 * A line with a football meaning.
 *
 * This is the distinction §44 of the brief is about: a pressing arrow is
 * not a red line that happens to look like pressing, it is a press. The
 * colour is derived from the kind, so the two cannot drift apart.
 */
export type PathKind =
  | "pass"
  | "run"
  | "dribble"
  | "press"
  | "carry"
  | "cover"
  | "movement"
  | "rotation"
  | "shot";

export const PATH_KINDS: { kind: PathKind; label: string; color: string; dash: string; hint: string }[] = [
  { kind: "run", label: "Run", color: "var(--signal-bright)", dash: "", hint: "Off-the-ball movement" },
  { kind: "pass", label: "Pass", color: "var(--positive)", dash: "6 4", hint: "The ball travels" },
  { kind: "dribble", label: "Dribble", color: "var(--review)", dash: "2 3", hint: "Carrying past someone" },
  { kind: "press", label: "Press", color: "var(--correction)", dash: "10 4", hint: "Pressure on the ball" },
  { kind: "carry", label: "Carry", color: "#c58bff", dash: "1 3", hint: "Driving into space" },
  { kind: "cover", label: "Cover", color: "var(--info)", dash: "4 4", hint: "Shifting to protect" },
  { kind: "movement", label: "Movement", color: "var(--text-dim)", dash: "3 3", hint: "Any other shift" },
  { kind: "rotation", label: "Rotation", color: "#f6c177", dash: "5 3", hint: "Two players swapping" },
  { kind: "shot", label: "Shot", color: "var(--correction)", dash: "", hint: "Strike at goal" },
];

export function pathMeta(kind: PathKind) {
  return PATH_KINDS.find((p) => p.kind === kind) ?? PATH_KINDS[0];
}

export interface BoardPath {
  id: string;
  kind: PathKind;
  from: Point;
  to: Point;
  /** The entity doing it, when the coach tied the line to a token. */
  entityId?: string | null;
  /** Numbered ordering — "1. pass, 2. run, 3. third-man". */
  sequence?: number | null;
  label?: string;
  /** Curved lines read better for runs around a defender. */
  curved?: boolean;
}

// ── space ────────────────────────────────────────────────────

/** What a highlighted area MEANS, so MIDO can talk about it. */
export type ZoneKind = "space" | "target" | "trap" | "danger" | "area";

export const ZONE_KINDS: { kind: ZoneKind; label: string; color: string }[] = [
  { kind: "space", label: "Space", color: "var(--signal)" },
  { kind: "target", label: "Target area", color: "var(--positive)" },
  { kind: "trap", label: "Press trap", color: "var(--correction)" },
  { kind: "danger", label: "Danger", color: "var(--review)" },
  { kind: "area", label: "Playing area", color: "var(--text-dim)" },
];

export function zoneMeta(kind: ZoneKind) {
  return ZONE_KINDS.find((z) => z.kind === kind) ?? ZONE_KINDS[0];
}

export interface BoardZone {
  id: string;
  kind: ZoneKind;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  shape?: "rect" | "ellipse";
}

export interface BoardAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
}

// ── frames ───────────────────────────────────────────────────

/**
 * One moment in a sequence.
 *
 * A single still cannot teach "CB receives, winger presses, pivot drops,
 * full-back advances" — that is four pictures, and a coach drawing it as
 * one gets a diagram nobody can read. Every board therefore has at least
 * one frame; most have exactly one, and the UI stays silent about frames
 * until a second is added.
 */
export interface BoardFrame {
  id: string;
  /** What changes in this moment. Shown above the pitch when present. */
  caption?: string;
  entities: BoardEntity[];
  paths: BoardPath[];
  zones: BoardZone[];
  annotations: BoardAnnotation[];
}

// ── the document ─────────────────────────────────────────────

/** Phase of play. Unchanged from v1 — existing rows use these values. */
export type BoardPhase = "in-possession" | "out-of-possession" | "transition" | "set-piece";

export const BOARD_PHASES: { phase: BoardPhase; label: string }[] = [
  { phase: "in-possession", label: "In possession" },
  { phase: "out-of-possession", label: "Out of possession" },
  { phase: "transition", label: "Transition" },
  { phase: "set-piece", label: "Set piece" },
];

/**
 * What this board is FOR. Drives which editor tools appear and how MIDO
 * reads it — a drill board is a setup to run, a tactical board is an
 * idea to teach.
 */
export type BoardKind = "tactical" | "drill" | "personal" | "study";

export const BOARD_KINDS: { kind: BoardKind; label: string }[] = [
  { kind: "tactical", label: "Tactical" },
  { kind: "drill", label: "Drill" },
  { kind: "personal", label: "Personal" },
  { kind: "study", label: "Study" },
];

/** Who may see it. Deliberately small; `board_links` carries assignment. */
export type BoardVisibility = "private" | "team" | "shared";

/** Where a board came from — for honesty, not decoration. */
export interface BoardOrigin {
  source: "manual" | "mido" | "duplicate" | "drill" | "opposition" | "study";
  /** The board this was copied from, when it was. */
  fromBoardId?: string | null;
  /** What the user asked MIDO for, when MIDO drew it. */
  prompt?: string | null;
}

/**
 * The whole board, as everything except the database sees it.
 *
 * `version` is what makes the v1 → v2 upgrade safe: a reader can always
 * tell which shape it is holding, rather than guessing from which keys
 * happen to be present.
 */
export interface TacticalDocument {
  version: 2;
  pitch: PitchSpec;
  formation?: string | null;
  /** One sentence: what this board is trying to achieve. Read by MIDO. */
  objective?: string | null;
  frames: BoardFrame[];
}

/** The board as a row: the document plus everything filed around it. */
export interface TacticalBoard {
  id: string;
  title: string;
  kind: BoardKind;
  phase: BoardPhase;
  formation: string;
  notes: string;
  tags: string[];
  visibility: BoardVisibility;
  origin: BoardOrigin;
  doc: TacticalDocument;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What a writer supplies. Everything else is the database's business. */
export interface TacticalBoardInput {
  title: string;
  kind?: BoardKind;
  phase: BoardPhase;
  formation: string;
  notes: string;
  tags?: string[];
  visibility?: BoardVisibility;
  origin?: BoardOrigin;
  doc: TacticalDocument;
}

// ── the v1 shape, still on disk ──────────────────────────────

/*
  Migration 0006's format. Nothing writes it as the source of truth any
  more, but `document.ts` reads it and projects back to it, so a board
  written today still renders on a deploy from before this change.
*/
export type LegacyTokenTeam = "home" | "away" | "ball" | "cone";
export type LegacyArrowKind = "run" | "pass" | "dribble" | "press";

export interface LegacyBoardData {
  tokens: { id: string; team: LegacyTokenTeam; label: string; x: number; y: number }[];
  arrows: { id: string; kind: LegacyArrowKind; x1: number; y1: number; x2: number; y2: number }[];
  zones: { id: string; x: number; y: number; w: number; h: number; label: string }[];
}
