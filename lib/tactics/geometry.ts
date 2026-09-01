/*
  Turning football coordinates into pixels, in one place.

  Board data is normalised 0–100 on both axes with y increasing towards
  the opposition goal, because that survives any screen size and matches
  how a coach reads a pitch. SVG disagrees on both counts: its y grows
  downwards, and it needs a concrete viewBox.

  Both renderers — the read-only viewer and the editor — go through these
  functions, so a board cannot appear in one place and be subtly wrong in
  the other. That was a real risk before: the pitch was drawn twice, in
  two components, with the numbers copied by hand.

  Pure and dependency-free.
*/

import type { PitchType } from "./types";

export interface PitchView {
  /** viewBox width. Always 100 — x is already the full width. */
  w: number;
  /** viewBox height. Sets the aspect ratio for this surface. */
  h: number;
}

/**
 * How tall each surface is drawn.
 *
 * The coordinate space never changes — 0–100 always spans whatever is on
 * screen — so a board can switch surface without moving a single entity.
 * Only the aspect and the markings change. `full` is 100x150, exactly
 * what migration 0006's boards were drawn in, so every existing board
 * renders pixel-identically.
 */
export const PITCH_VIEW: Record<PitchType, PitchView> = {
  full: { w: 100, h: 150 },
  half: { w: 100, h: 82 },
  "final-third": { w: 100, h: 70 },
  "penalty-area": { w: 100, h: 62 },
  grid: { w: 100, h: 100 },
  blank: { w: 100, h: 100 },
};

export function pitchView(type: PitchType): PitchView {
  return PITCH_VIEW[type] ?? PITCH_VIEW.full;
}

/** Board coordinates → SVG user units, flipping y so attacking is up. */
export function toSvg(x: number, y: number, view: PitchView): { px: number; py: number } {
  return { px: x, py: (100 - y) * (view.h / 100) };
}

/** SVG user units → board coordinates. The inverse of `toSvg`. */
export function fromSvg(px: number, py: number, view: PitchView): { x: number; y: number } {
  return { x: px, y: 100 - py / (view.h / 100) };
}

export function clampToPitch(v: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0));
}

/**
 * A pointer event's position in board coordinates.
 *
 * Reads the element's box rather than assuming the SVG is laid out at
 * its natural size, which it never is — it scales to the container.
 */
export function pointerToBoard(
  e: { clientX: number; clientY: number },
  el: Element | null,
  view: PitchView,
): { x: number; y: number } {
  if (!el) return { x: 50, y: 50 };
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 50, y: 50 };
  const px = ((e.clientX - rect.left) / rect.width) * view.w;
  const py = ((e.clientY - rect.top) / rect.height) * view.h;
  const p = fromSvg(px, py, view);
  return { x: clampToPitch(p.x), y: clampToPitch(p.y) };
}

/** Distance in board units — used for "did the drag actually go anywhere". */
export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * A gentle arc for a curved path.
 *
 * Runs around a defender read as curves on a real whiteboard; a straight
 * line says something slightly different. The control point is offset
 * perpendicular to the line by a fixed fraction of its length, which
 * bends short and long paths by a proportional amount.
 */
export function arcPath(
  from: { px: number; py: number },
  to: { px: number; py: number },
  bend = 0.18,
): string {
  const mx = (from.px + to.px) / 2;
  const my = (from.py + to.py) / 2;
  const dx = to.px - from.px;
  const dy = to.py - from.py;
  const cx = mx - dy * bend;
  const cy = my + dx * bend;
  return `M ${from.px} ${from.py} Q ${cx} ${cy} ${to.px} ${to.py}`;
}
