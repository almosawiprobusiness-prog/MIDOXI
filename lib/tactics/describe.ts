/*
  A board, in words MIDO can reason about.

  This is the file that makes the difference between storing football and
  understanding it. A prompt cannot see an SVG, and stuffing raw document
  JSON into one wastes most of the tokens on ids and coordinates that
  carry no football meaning.

  So a board is described the way a coach would describe it out loud:
  what is set up, who is where in football terms, what movements are
  drawn, what space is marked. Positions become thirds and channels
  because "the right half-space, just outside the box" is a fact a model
  can reason with, and "x: 68, y: 79" is not.

  Pure and client-safe, so the same description shows in the UI ("what is
  on this board") as goes to the model. If they ever disagree, one of
  them is lying to somebody.
*/

import { countDocument } from "./document";
import {
  pathMeta,
  sideOf,
  zoneMeta,
  type BoardEntity,
  type BoardFrame,
  type PitchType,
  type TacticalDocument,
} from "./types";

// ── space, named ─────────────────────────────────────────────

/**
 * Vertical thirds, attacking upwards.
 *
 * Boundaries at 33/66 are the conventional reading of a pitch and match
 * how the formation presets are laid out — a back four sits at y≈18–24
 * (defensive third), a front line at y≈70–80 (final third).
 */
export function thirdOf(y: number): "defensive third" | "middle third" | "final third" {
  if (y < 33) return "defensive third";
  if (y < 66) return "middle third";
  return "final third";
}

/**
 * Channels across the width.
 *
 * Five lanes rather than three, because the half-spaces are where most
 * modern coaching language lives and collapsing them into "centre"
 * throws away the distinction a coach most wants to make.
 */
export function channelOf(x: number): string {
  if (x < 20) return "left wing";
  if (x < 40) return "left half-space";
  if (x < 60) return "centre";
  if (x < 80) return "right half-space";
  return "right wing";
}

/** Where something is, in football terms. */
export function whereIs(x: number, y: number): string {
  return `${channelOf(x)}, ${thirdOf(y)}`;
}

const PITCH_LABEL: Record<PitchType, string> = {
  full: "a full pitch",
  half: "a half pitch",
  "final-third": "the final third",
  "penalty-area": "the penalty area",
  grid: "a training grid",
  blank: "a blank area",
};

// ── describing the parts ─────────────────────────────────────

function describeEntity(e: BoardEntity): string {
  const side = sideOf(e.kind);
  const who =
    e.kind === "goalkeeper"
      ? "our goalkeeper"
      : e.kind === "opponent-goalkeeper"
        ? "their goalkeeper"
        : e.kind === "neutral"
          ? "a neutral player"
          : side === "ours"
            ? `our ${e.label || "player"}`
            : side === "theirs"
              ? `their ${e.label || "player"}`
              : e.kind;
  return `${who} in the ${whereIs(e.x, e.y)}`;
}

function describeFrame(frame: BoardFrame, index: number, total: number): string[] {
  const lines: string[] = [];
  const head = total > 1 ? `FRAME ${index + 1} of ${total}` : "THE BOARD";
  lines.push(frame.caption ? `${head} — ${frame.caption}` : head);

  const ours = frame.entities.filter((e) => sideOf(e.kind) === "ours");
  const theirs = frame.entities.filter((e) => sideOf(e.kind) === "theirs");
  const kit = frame.entities.filter(
    (e) => e.kind === "cone" || e.kind === "mannequin" || e.kind === "goal" || e.kind === "mini-goal",
  );
  const ball = frame.entities.find((e) => e.kind === "ball");

  if (ours.length) {
    lines.push(`Ours (${ours.length}): ${ours.map(describeEntity).join("; ")}`);
  }
  if (theirs.length) {
    lines.push(`Theirs (${theirs.length}): ${theirs.map(describeEntity).join("; ")}`);
  }
  if (ball) lines.push(`Ball: ${whereIs(ball.x, ball.y)}`);
  if (kit.length) {
    const byKind = new Map<string, number>();
    for (const k of kit) byKind.set(k.kind, (byKind.get(k.kind) ?? 0) + 1);
    lines.push(
      `Equipment: ${[...byKind.entries()].map(([k, n]) => `${n} ${k}${n > 1 ? "s" : ""}`).join(", ")}`,
    );
  }

  /*
    Movements are the part a picture states and a coordinate list hides.
    Ordered by the coach's own numbering when they set one, because "1.
    pass, 2. run, 3. third-man" is a sequence and reading it out of order
    describes a different idea entirely.
  */
  if (frame.paths.length) {
    const ordered = [...frame.paths].sort(
      (a, b) => (a.sequence ?? 999) - (b.sequence ?? 999),
    );
    lines.push(
      `Movements (${ordered.length}): ${ordered
        .map((p) => {
          const n = p.sequence ? `${p.sequence}. ` : "";
          const what = pathMeta(p.kind).label.toLowerCase();
          const note = p.label ? ` (${p.label})` : "";
          return `${n}a ${what} from the ${whereIs(p.from.x, p.from.y)} to the ${whereIs(p.to.x, p.to.y)}${note}`;
        })
        .join("; ")}`,
    );
  }

  if (frame.zones.length) {
    lines.push(
      `Marked space: ${frame.zones
        .map((z) => {
          const label = z.label ? `"${z.label}"` : zoneMeta(z.kind).label.toLowerCase();
          return `${label} covering the ${whereIs(z.x + z.w / 2, z.y + z.h / 2)}`;
        })
        .join("; ")}`,
    );
  }

  if (frame.annotations.length) {
    lines.push(`Notes on the board: ${frame.annotations.map((a) => `"${a.text}"`).join("; ")}`);
  }

  return lines;
}

// ── the whole thing ──────────────────────────────────────────

export interface BoardDescriptionInput {
  title: string;
  phase: string;
  formation?: string | null;
  notes?: string;
  tags?: string[];
  doc: TacticalDocument;
}

/**
 * The board as a prompt block.
 *
 * Bounded on purpose: a twelve-frame board with sixty entities would
 * otherwise dominate a request. Frames past the cap are counted rather
 * than described, which is honest and cheap.
 */
export function describeBoard(input: BoardDescriptionInput, maxFrames = 4): string {
  const { doc } = input;
  const lines: string[] = [];

  lines.push(`TACTICAL BOARD: "${input.title}"`);
  lines.push(
    `Set up on ${PITCH_LABEL[doc.pitch.type]}${doc.pitch.dimensions ? ` (${doc.pitch.dimensions})` : ""}, attacking upwards.`,
  );
  const shape = input.formation || doc.formation;
  if (shape) lines.push(`Shape: ${shape}. Phase: ${input.phase}.`);
  else lines.push(`Phase: ${input.phase}.`);

  if (doc.objective) lines.push(`Stated objective: ${doc.objective}`);
  if (input.notes?.trim()) lines.push(`Coach's note: ${input.notes.trim().slice(0, 400)}`);
  if (input.tags?.length) lines.push(`Tagged: ${input.tags.slice(0, 12).join(", ")}`);

  const shown = doc.frames.slice(0, maxFrames);
  for (const [i, f] of shown.entries()) {
    lines.push("");
    lines.push(...describeFrame(f, i, doc.frames.length));
  }
  if (doc.frames.length > shown.length) {
    lines.push("");
    lines.push(`(${doc.frames.length - shown.length} further frame(s) not described here.)`);
  }

  return lines.join("\n");
}

/**
 * One line for a card, a picker row or a search result.
 *
 * Deliberately not the same text as `describeBoard`: this is for a human
 * scanning a list, and a paragraph in a card is noise.
 */
export function summariseBoard(input: BoardDescriptionInput): string {
  const c = countDocument(input.doc);
  const bits: string[] = [];
  if (c.ours || c.theirs) bits.push(`${c.ours}v${c.theirs}`);
  if (c.paths) bits.push(`${c.paths} movement${c.paths === 1 ? "" : "s"}`);
  if (c.zones) bits.push(`${c.zones} zone${c.zones === 1 ? "" : "s"}`);
  if (c.frames > 1) bits.push(`${c.frames} frames`);
  return bits.join(" · ");
}

/**
 * Semantic keywords for retrieval (§27).
 *
 * Derived from what is actually on the board rather than typed by the
 * user, so "use my wide pressing board" can resolve without anyone
 * having remembered to tag it. Deduped and lowercased; the caller
 * decides whether to store or match against them.
 */
export function boardKeywords(input: BoardDescriptionInput): string[] {
  const words = new Set<string>();
  const add = (s: string) => {
    const v = s.trim().toLowerCase();
    if (v) words.add(v);
  };

  add(input.phase);
  if (input.formation) add(input.formation);
  if (input.doc.formation) add(input.doc.formation);
  for (const t of input.tags ?? []) add(t);
  add(PITCH_LABEL[input.doc.pitch.type].replace(/^(a|the) /, ""));

  for (const f of input.doc.frames) {
    for (const p of f.paths) {
      add(pathMeta(p.kind).label);
      // Where the action happens is as searchable as what it is.
      add(thirdOf(p.from.y));
      add(channelOf(p.from.x));
    }
    for (const z of f.zones) {
      add(zoneMeta(z.kind).label);
      if (z.label) add(z.label);
    }
    for (const e of f.entities) {
      if (e.role) add(e.role);
    }
  }

  // Title words carry the coach's own language, which is often the exact
  // phrase they will search with later.
  for (const w of input.title.split(/[^\p{L}\p{N}-]+/u)) {
    if (w.length > 2) add(w);
  }

  return [...words].slice(0, 40);
}
