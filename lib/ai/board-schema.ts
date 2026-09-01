import { z } from "zod";
import { toDocument } from "@/lib/tactics/document";
import { DEFAULT_PITCH, type BoardPhase, type TacticalDocument } from "@/lib/tactics/types";

/*
  The shape MIDO may answer in when it draws a board.

  A generated board is the one AI output in this product that is not
  prose: it is coordinates, and a coordinate the model got wrong is a
  player standing in the crowd. So the boundary is tighter than usual.

  THE WIRE SHAPE IS FLATTER THAN THE DOCUMENT. Paths carry fromX/fromY/
  toX/toY rather than nested {from:{x,y}}, because nesting is where
  structured output most often goes wrong, and the mapping back is
  trivial. The model never sees the internal document type — it answers
  a schema designed for it, and this file converts.

  THREE GATES, IN ORDER.
    1. json_schema enforcement in the provider (bounds and enums)
    2. Zod here — the SHAPE gate, per lib/ai/schemas.ts's rule
    3. `toDocument` — the SANITY gate, which clamps every coordinate to
       the pitch and drops anything malformed

  A board that survives all three cannot put a player off the pitch, and
  cannot carry a path kind the renderer has no colour for.
*/

// ── the wire vocabulary ──────────────────────────────────────

/*
  Deliberately narrower than the full vocabulary. The model gets the
  kinds a drawn idea actually needs; `mannequin`, `mini-goal` and the
  rest stay available to a person in the editor. A smaller enum is a
  smaller surface to get wrong, and nothing is lost — a coach adds the
  mannequins.
*/
export const AI_ENTITY_KINDS = [
  "player",
  "goalkeeper",
  "opponent",
  "opponent-goalkeeper",
  "neutral",
  "ball",
  "cone",
] as const;

export const AI_PATH_KINDS = [
  "pass",
  "run",
  "dribble",
  "press",
  "carry",
  "cover",
  "shot",
] as const;

export const AI_ZONE_KINDS = ["space", "target", "trap", "danger", "area"] as const;

export const AI_PITCH_TYPES = ["full", "half", "final-third", "penalty-area", "grid"] as const;

// ── zod: the shape gate ──────────────────────────────────────

const coord = z.number().finite();

const aiEntitySchema = z.object({
  kind: z.enum(AI_ENTITY_KINDS),
  x: coord,
  y: coord,
  label: z.string().max(6).catch(""),
});

const aiPathSchema = z.object({
  kind: z.enum(AI_PATH_KINDS),
  fromX: coord,
  fromY: coord,
  toX: coord,
  toY: coord,
  /** 1,2,3 — the order the actions happen in. */
  sequence: z.number().int().min(1).max(20).nullable().catch(null),
  label: z.string().max(40).catch(""),
});

const aiZoneSchema = z.object({
  kind: z.enum(AI_ZONE_KINDS),
  x: coord,
  y: coord,
  w: coord,
  h: coord,
  label: z.string().max(40).catch(""),
});

const aiFrameSchema = z.object({
  caption: z.string().max(140).catch(""),
  entities: z.array(aiEntitySchema).max(30),
  paths: z.array(aiPathSchema).max(20),
  zones: z.array(aiZoneSchema).max(8),
});

export const aiBoardSchema = z.object({
  title: z.string().min(1).max(120),
  objective: z.string().min(1).max(300),
  phase: z.enum(["in-possession", "out-of-possession", "transition", "set-piece"]),
  pitch: z.enum(AI_PITCH_TYPES),
  formation: z.string().max(20).catch(""),
  tags: z.array(z.string().max(30)).max(8).catch([]),
  frames: z.array(aiFrameSchema).min(1).max(5),
});

export type AiBoardPayload = z.infer<typeof aiBoardSchema>;

// ── the provider schema ──────────────────────────────────────

/**
 * The json_schema handed to the model.
 *
 * Bounds live here as well as in Zod on purpose: stating `minimum: 0,
 * maximum: 100` in the schema is what stops most out-of-pitch
 * coordinates being generated at all, which is cheaper than catching
 * them afterwards.
 */
export const AI_BOARD_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    objective: { type: "string" },
    phase: {
      type: "string",
      enum: ["in-possession", "out-of-possession", "transition", "set-piece"],
    },
    pitch: { type: "string", enum: [...AI_PITCH_TYPES] },
    formation: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    frames: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          caption: { type: "string" },
          entities: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                kind: { type: "string", enum: [...AI_ENTITY_KINDS] },
                x: { type: "number", minimum: 0, maximum: 100 },
                y: { type: "number", minimum: 0, maximum: 100 },
                label: { type: "string" },
              },
              required: ["kind", "x", "y", "label"],
            },
          },
          paths: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                kind: { type: "string", enum: [...AI_PATH_KINDS] },
                fromX: { type: "number", minimum: 0, maximum: 100 },
                fromY: { type: "number", minimum: 0, maximum: 100 },
                toX: { type: "number", minimum: 0, maximum: 100 },
                toY: { type: "number", minimum: 0, maximum: 100 },
                sequence: { type: "number" },
                label: { type: "string" },
              },
              required: ["kind", "fromX", "fromY", "toX", "toY", "label"],
            },
          },
          zones: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                kind: { type: "string", enum: [...AI_ZONE_KINDS] },
                x: { type: "number", minimum: 0, maximum: 100 },
                y: { type: "number", minimum: 0, maximum: 100 },
                w: { type: "number", minimum: 0, maximum: 100 },
                h: { type: "number", minimum: 0, maximum: 100 },
                label: { type: "string" },
              },
              required: ["kind", "x", "y", "w", "h", "label"],
            },
          },
        },
        required: ["caption", "entities", "paths", "zones"],
      },
    },
  },
  required: ["title", "objective", "phase", "pitch", "formation", "tags", "frames"],
} as const;

// ── wire → document ──────────────────────────────────────────

/**
 * Turn a validated payload into a real tactical document.
 *
 * Everything passes through `toDocument`, which is the same function
 * that reads boards off disk. A generated board is therefore held to
 * exactly the bounds a hand-drawn one is — there is no path by which
 * model output enters the product under looser rules than a person's.
 */
export function documentFromAi(payload: AiBoardPayload): TacticalDocument {
  return toDocument({
    version: 2,
    pitch: { ...DEFAULT_PITCH, type: payload.pitch },
    formation: payload.formation || null,
    objective: payload.objective,
    frames: payload.frames.map((f) => ({
      caption: f.caption,
      entities: f.entities.map((e) => ({
        kind: e.kind,
        x: e.x,
        y: e.y,
        label: e.label,
      })),
      paths: f.paths.map((p) => ({
        kind: p.kind,
        from: { x: p.fromX, y: p.fromY },
        to: { x: p.toX, y: p.toY },
        sequence: p.sequence,
        label: p.label,
      })),
      zones: f.zones.map((z) => ({
        kind: z.kind,
        x: z.x,
        y: z.y,
        w: z.w,
        h: z.h,
        label: z.label,
      })),
      annotations: [],
    })),
  });
}

/** The phase a generated board declares, safe for the board record. */
export function phaseFromAi(payload: AiBoardPayload): BoardPhase {
  return payload.phase;
}

// ── turning a board into a drill ─────────────────────────────

/*
  The other direction (§9): a board becomes a session block. The shape
  matches `SessionBlockInput` so the result drops straight into the
  session planner with no translation layer to drift.
*/
export const aiDrillSchema = z.object({
  name: z.string().min(1).max(200),
  phase: z.enum([
    "warmup",
    "technical",
    "tactical",
    "possession",
    "conditioned-game",
    "match-scenario",
    "set-piece",
    "cooldown",
  ]),
  durationMin: z.number().int().min(3).max(60),
  organisation: z.string().min(1).max(800),
  coachingPoints: z.array(z.string().min(1).max(200)).min(1).max(6),
  progression: z.string().max(300).catch(""),
  regression: z.string().max(300).catch(""),
});

export type AiDrillPayload = z.infer<typeof aiDrillSchema>;

export const AI_DRILL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    phase: {
      type: "string",
      enum: [
        "warmup",
        "technical",
        "tactical",
        "possession",
        "conditioned-game",
        "match-scenario",
        "set-piece",
        "cooldown",
      ],
    },
    durationMin: { type: "number" },
    organisation: { type: "string" },
    coachingPoints: { type: "array", items: { type: "string" } },
    progression: { type: "string" },
    regression: { type: "string" },
  },
  required: ["name", "phase", "durationMin", "organisation", "coachingPoints"],
} as const;

// ── explaining a board ───────────────────────────────────────

export const aiExplanationSchema = z.object({
  headline: z.string().min(1).max(160),
  /** What the board is doing, in 2-4 short paragraphs' worth of points. */
  points: z.array(z.string().min(1).max(400)).min(1).max(6),
  /** What to watch for when it is coached. Optional by nature. */
  watchFor: z.array(z.string().min(1).max(200)).max(4).catch([]),
});

export type AiExplanationPayload = z.infer<typeof aiExplanationSchema>;

export const AI_EXPLANATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    points: { type: "array", items: { type: "string" } },
    watchFor: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "points"],
} as const;
