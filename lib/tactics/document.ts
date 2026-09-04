/*
  Reading, writing and upgrading a tactical document.

  Pure and client-safe. Everything that decides what a board IS lives
  here, so the editor, the read-only viewer, the server actions, the demo
  store and the AI engines cannot disagree about it.

  THE COMPATIBILITY CONTRACT, which is the whole reason this file exists:

    · `toDocument()` accepts either shape. A v1 `{tokens, arrows, zones}`
      row is upgraded in memory — never migrated in place — so no existing
      board is rewritten, and a board saved before this change opens
      exactly as it was drawn.

    · `toLegacy()` projects back. Every write keeps the v1 column in step,
      so rolling this deploy back does not blank anybody's boards. Frames
      beyond the first cannot survive that projection; that is stated
      where it happens rather than discovered later.

  Neither direction throws. A board is somebody's work: a malformed field
  costs that field, never the board.
*/

import {
  DEFAULT_PITCH,
  isPersonKind,
  type BoardAnnotation,
  type BoardEntity,
  type BoardFrame,
  type BoardOrigin,
  type BoardPath,
  type BoardZone,
  type EntityKind,
  type LegacyArrowKind,
  type LegacyBoardData,
  type LegacyTokenTeam,
  type PathKind,
  type PitchSpec,
  type TacticalDocument,
  type ZoneKind,
} from "./types";

// ── ids ──────────────────────────────────────────────────────

let seq = 0;

/** Stable-enough unique id. crypto where present, counter otherwise. */
export function boardId(prefix: string): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return `${prefix}-${c.randomUUID().slice(0, 8)}`;
  return `${prefix}-${Date.now().toString(36)}${seq++}`;
}

// ── bounds ───────────────────────────────────────────────────

const clamp = (v: unknown, min = 0, max = 100): number => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return Math.min(max, Math.max(min, n));
};

const str = (v: unknown, max = 120): string =>
  typeof v === "string" ? v.slice(0, max) : "";

// ── v1 → v2 vocabulary ───────────────────────────────────────

/*
  The old four-value token team maps onto the richer entity vocabulary
  without losing anything: `home` was always "one of ours", `away`
  always "one of theirs". A v1 board labelled "GK" stays a plain player
  rather than being promoted to a goalkeeper — inferring that from a
  text label would silently rewrite what the coach drew.
*/
const TEAM_TO_KIND: Record<LegacyTokenTeam, EntityKind> = {
  home: "player",
  away: "opponent",
  ball: "ball",
  cone: "cone",
};

const KIND_TO_TEAM: Record<EntityKind, LegacyTokenTeam> = {
  player: "home",
  goalkeeper: "home",
  opponent: "away",
  "opponent-goalkeeper": "away",
  // A neutral server has no v1 equivalent; "home" keeps it visible rather
  // than dropping it out of an older renderer entirely.
  neutral: "home",
  ball: "ball",
  cone: "cone",
  mannequin: "cone",
  goal: "cone",
  "mini-goal": "cone",
};

/** v2 path kinds that v1 never had collapse to the nearest it did. */
const KIND_TO_ARROW: Record<PathKind, LegacyArrowKind> = {
  pass: "pass",
  run: "run",
  dribble: "dribble",
  press: "press",
  carry: "dribble",
  cover: "run",
  movement: "run",
  rotation: "run",
  shot: "pass",
};

const LEGACY_ARROWS: LegacyArrowKind[] = ["run", "pass", "dribble", "press"];

// ── sanitising a document ────────────────────────────────────

function toPitch(v: unknown): PitchSpec {
  if (!v || typeof v !== "object") return { ...DEFAULT_PITCH };
  const p = v as Partial<PitchSpec>;
  const types = ["full", "half", "final-third", "penalty-area", "grid", "blank"];
  return {
    type: (types.includes(p.type as string) ? p.type : "full") as PitchSpec["type"],
    orientation: p.orientation === "horizontal" ? "horizontal" : "vertical",
    dimensions: typeof p.dimensions === "string" ? p.dimensions.slice(0, 40) : null,
  };
}

function toEntity(v: unknown): BoardEntity | null {
  if (!v || typeof v !== "object") return null;
  const e = v as Record<string, unknown>;
  const kinds: EntityKind[] = [
    "player", "goalkeeper", "opponent", "opponent-goalkeeper", "neutral",
    "ball", "cone", "mannequin", "goal", "mini-goal",
  ];
  const kind = (kinds.includes(e.kind as EntityKind) ? e.kind : "player") as EntityKind;
  return {
    id: str(e.id, 40) || boardId("e"),
    kind,
    x: clamp(e.x),
    y: clamp(e.y),
    label: isPersonKind(kind) ? str(e.label, 6) : "",
    role: typeof e.role === "string" ? e.role.slice(0, 24) : null,
    playerId: typeof e.playerId === "string" ? e.playerId.slice(0, 64) : null,
  };
}

function toPath(v: unknown): BoardPath | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  const kinds: PathKind[] = [
    "pass", "run", "dribble", "press", "carry", "cover", "movement", "rotation", "shot",
  ];
  const from = p.from as Record<string, unknown> | undefined;
  const to = p.to as Record<string, unknown> | undefined;
  if (!from || !to) return null;
  return {
    id: str(p.id, 40) || boardId("p"),
    kind: (kinds.includes(p.kind as PathKind) ? p.kind : "run") as PathKind,
    from: { x: clamp(from.x), y: clamp(from.y) },
    to: { x: clamp(to.x), y: clamp(to.y) },
    entityId: typeof p.entityId === "string" ? p.entityId.slice(0, 40) : null,
    sequence: typeof p.sequence === "number" && Number.isFinite(p.sequence) ? p.sequence : null,
    label: str(p.label, 60),
    curved: p.curved === true,
  };
}

function toZone(v: unknown): BoardZone | null {
  if (!v || typeof v !== "object") return null;
  const z = v as Record<string, unknown>;
  const kinds: ZoneKind[] = ["space", "target", "trap", "danger", "area"];
  return {
    id: str(z.id, 40) || boardId("z"),
    kind: (kinds.includes(z.kind as ZoneKind) ? z.kind : "space") as ZoneKind,
    x: clamp(z.x),
    y: clamp(z.y),
    w: clamp(z.w, 0, 100),
    h: clamp(z.h, 0, 100),
    label: str(z.label, 40),
    shape: z.shape === "ellipse" ? "ellipse" : "rect",
  };
}

function toAnnotation(v: unknown): BoardAnnotation | null {
  if (!v || typeof v !== "object") return null;
  const a = v as Record<string, unknown>;
  const text = str(a.text, 160);
  if (!text.trim()) return null;
  return { id: str(a.id, 40) || boardId("n"), x: clamp(a.x), y: clamp(a.y), text };
}

const list = <T>(v: unknown, f: (x: unknown) => T | null, cap: number): T[] =>
  Array.isArray(v) ? (v.slice(0, cap).map(f).filter(Boolean) as T[]) : [];

function toFrame(v: unknown): BoardFrame {
  const f = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    id: str(f.id, 40) || boardId("f"),
    caption: str(f.caption, 140),
    entities: list(f.entities, toEntity, 60),
    paths: list(f.paths, toPath, 80),
    zones: list(f.zones, toZone, 30),
    annotations: list(f.annotations, toAnnotation, 30),
  };
}

// ── the two directions ───────────────────────────────────────

export function emptyFrame(caption = ""): BoardFrame {
  return { id: boardId("f"), caption, entities: [], paths: [], zones: [], annotations: [] };
}

export function emptyDocument(pitch: PitchSpec = DEFAULT_PITCH): TacticalDocument {
  return { version: 2, pitch: { ...pitch }, formation: null, objective: null, frames: [emptyFrame()] };
}

/** Is this stored value the v1 `{tokens, arrows, zones}` shape? */
function isLegacy(v: unknown): v is LegacyBoardData {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if ((o as { version?: unknown }).version === 2) return false;
  return Array.isArray(o.tokens) || Array.isArray(o.arrows);
}

/** Upgrade a v1 board into one frame of a v2 document. */
function fromLegacy(v1: LegacyBoardData, pitch: PitchSpec): TacticalDocument {
  const frame = emptyFrame();

  frame.entities = (Array.isArray(v1.tokens) ? v1.tokens : []).slice(0, 60).map((t) => {
    const team = (["home", "away", "ball", "cone"] as LegacyTokenTeam[]).includes(t?.team)
      ? t.team
      : "home";
    const kind = TEAM_TO_KIND[team];
    return {
      id: str(t?.id, 40) || boardId("e"),
      kind,
      x: clamp(t?.x),
      y: clamp(t?.y),
      label: isPersonKind(kind) ? str(t?.label, 6) : "",
      role: null,
      playerId: null,
    };
  });

  frame.paths = (Array.isArray(v1.arrows) ? v1.arrows : []).slice(0, 80).map((a) => ({
    id: str(a?.id, 40) || boardId("p"),
    kind: (LEGACY_ARROWS.includes(a?.kind) ? a.kind : "run") as PathKind,
    from: { x: clamp(a?.x1), y: clamp(a?.y1) },
    to: { x: clamp(a?.x2), y: clamp(a?.y2) },
    entityId: null,
    sequence: null,
    label: "",
    curved: false,
  }));

  frame.zones = (Array.isArray(v1.zones) ? v1.zones : []).slice(0, 30).map((z) => ({
    id: str(z?.id, 40) || boardId("z"),
    // v1 zones carried no meaning, and inventing one would put words in
    // the coach's mouth. "space" is the honest neutral reading.
    kind: "space" as ZoneKind,
    x: clamp(z?.x),
    y: clamp(z?.y),
    w: clamp(z?.w, 0, 100),
    h: clamp(z?.h, 0, 100),
    label: str(z?.label, 40),
    shape: "rect" as const,
  }));

  return { version: 2, pitch: { ...pitch }, formation: null, objective: null, frames: [frame] };
}

/**
 * Read whatever is on disk as a v2 document.
 *
 * Accepts a v2 document, a v1 board, null, or nonsense. Always returns a
 * renderable document with at least one frame.
 */
export function toDocument(stored: unknown, pitch: PitchSpec = DEFAULT_PITCH): TacticalDocument {
  if (isLegacy(stored)) return fromLegacy(stored, pitch);
  if (!stored || typeof stored !== "object") return emptyDocument(pitch);

  const d = stored as Record<string, unknown>;
  const frames = Array.isArray(d.frames) ? d.frames.slice(0, 12).map(toFrame) : [];
  return {
    version: 2,
    pitch: toPitch(d.pitch ?? pitch),
    formation: typeof d.formation === "string" ? d.formation.slice(0, 20) : null,
    objective: typeof d.objective === "string" ? d.objective.slice(0, 300) : null,
    // A document with no frames cannot be drawn on or read; give it one.
    frames: frames.length ? frames : [emptyFrame()],
  };
}

/**
 * Project back to the v1 shape for the legacy column.
 *
 * ONLY THE FIRST FRAME SURVIVES. A five-frame sequence has no v1
 * representation, and inventing one by flattening every frame on top of
 * each other would produce a picture the coach never drew. The first
 * frame is the board's opening position, which is the most useful single
 * still — and the v2 column remains the source of truth regardless.
 */
export function toLegacy(doc: TacticalDocument): LegacyBoardData {
  const frame = doc.frames[0] ?? emptyFrame();
  return {
    tokens: frame.entities.map((e) => ({
      id: e.id,
      team: KIND_TO_TEAM[e.kind] ?? "home",
      label: e.label ?? "",
      x: e.x,
      y: e.y,
    })),
    arrows: frame.paths.map((p) => ({
      id: p.id,
      kind: KIND_TO_ARROW[p.kind] ?? "run",
      x1: p.from.x,
      y1: p.from.y,
      x2: p.to.x,
      y2: p.to.y,
    })),
    zones: frame.zones.map((z) => ({
      id: z.id,
      x: z.x,
      y: z.y,
      w: z.w,
      h: z.h,
      label: z.label ?? "",
    })),
  };
}

// ── building from football ───────────────────────────────────

/**
 * Formation presets, normalised, attacking upwards.
 *
 * Moved here from coach-types.ts unchanged — the same coordinates the
 * existing tests pin, so every board created before and after this
 * change starts in the identical shape.
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

/*
  The opposition block a new board is drawn against: a 4-4-2 mid-block.

  It used to be a back four and two centre-mids — no front line at all. That
  is the half of the opposition a build-up board is actually about, and
  `in-possession` is the default phase, so the commonest first board on this
  product contradicted its own objective: you would write "split the two
  strikers" and there were no strikers on the pitch.

  A 4-4-2 because it is the shape most teams are coached against, and a
  complete one because deleting a player you do not need is a smaller cost
  than not noticing an absent line until a coach reads the board back.
*/
const OPPOSITION_BLOCK: { label: string; x: number; y: number }[] = [
  { label: "GK", x: 50, y: 95 },

  { label: "RB", x: 18, y: 82 },
  { label: "CB", x: 40, y: 85 },
  { label: "CB", x: 60, y: 85 },
  { label: "LB", x: 82, y: 82 },

  { label: "RM", x: 18, y: 64 },
  { label: "CM", x: 39, y: 64 },
  { label: "CM", x: 61, y: 64 },
  { label: "LM", x: 82, y: 64 },

  /* Just inside our half — a mid-block, not a high press. Where they stand
     is what the board teaches, so the neutral default is the common one. */
  { label: "ST", x: 43, y: 47 },
  { label: "ST", x: 57, y: 47 },
];

/**
 * A fresh document for a formation: eleven of ours, a block to play
 * against, and a ball. The goalkeeper is typed as one — v1 could not say
 * that, so this is the first thing new boards know that old ones do not.
 */
export function documentFromFormation(formation: string): TacticalDocument {
  const shape = FORMATIONS[formation] ?? FORMATIONS["4-3-3"];
  const frame = emptyFrame();

  frame.entities = shape.map((p, i) => ({
    id: `h${i}`,
    kind: (p.label === "GK" ? "goalkeeper" : "player") as EntityKind,
    x: p.x,
    y: p.y,
    label: p.label,
    role: p.label,
    playerId: null,
  }));

  frame.entities.push(
    ...OPPOSITION_BLOCK.map((p, i) => ({
      id: `a${i}`,
      kind: (p.label === "GK" ? "opponent-goalkeeper" : "opponent") as EntityKind,
      x: p.x,
      y: p.y,
      label: p.label,
      role: p.label,
      playerId: null,
    })),
  );

  frame.entities.push({ id: "ball", kind: "ball", x: 50, y: 12, label: "", role: null, playerId: null });

  return { version: 2, pitch: { ...DEFAULT_PITCH }, formation, objective: null, frames: [frame] };
}

/** Reposition our outfield shape without disturbing anything drawn. */
export function applyFormation(frame: BoardFrame, formation: string): BoardFrame {
  const shape = FORMATIONS[formation] ?? FORMATIONS["4-3-3"];
  const ours = frame.entities.filter((e) => e.kind === "player" || e.kind === "goalkeeper");
  const others = frame.entities.filter((e) => e.kind !== "player" && e.kind !== "goalkeeper");
  const moved = shape.map((p, i) => ({
    id: ours[i]?.id ?? `h${i}`,
    kind: (p.label === "GK" ? "goalkeeper" : "player") as EntityKind,
    x: p.x,
    y: p.y,
    label: p.label,
    role: p.label,
    playerId: ours[i]?.playerId ?? null,
  }));
  return { ...frame, entities: [...moved, ...others] };
}

// ── small queries the UI and the AI both want ────────────────

export interface BoardCounts {
  ours: number;
  theirs: number;
  paths: number;
  zones: number;
  frames: number;
}

export function countDocument(doc: TacticalDocument): BoardCounts {
  const f = doc.frames[0] ?? emptyFrame();
  return {
    ours: f.entities.filter((e) => e.kind === "player" || e.kind === "goalkeeper").length,
    theirs: f.entities.filter((e) => e.kind === "opponent" || e.kind === "opponent-goalkeeper").length,
    paths: f.paths.length,
    zones: f.zones.length,
    frames: doc.frames.length,
  };
}

/** Is there anything on this board besides the starting shape? */
export function isDrawnOn(doc: TacticalDocument): boolean {
  return doc.frames.some((f) => f.paths.length > 0 || f.zones.length > 0 || f.annotations.length > 0);
}

export const DEFAULT_ORIGIN: BoardOrigin = { source: "manual", fromBoardId: null, prompt: null };

/** Deep copy, with fresh ids, so a duplicate can never alias the original. */
export function cloneDocument(doc: TacticalDocument): TacticalDocument {
  return {
    ...doc,
    pitch: { ...doc.pitch },
    frames: doc.frames.map((f) => ({
      id: boardId("f"),
      caption: f.caption,
      entities: f.entities.map((e) => ({ ...e })),
      paths: f.paths.map((p) => ({ ...p, from: { ...p.from }, to: { ...p.to } })),
      zones: f.zones.map((z) => ({ ...z })),
      annotations: f.annotations.map((a) => ({ ...a })),
    })),
  };
}
