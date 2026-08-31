/*
  Telestration shapes — the schema, shared by the canvas that draws
  them, the action that stores them and the tests that pin them.

  Client-safe: no server imports.

  EVERY COORDINATE IS 0..1, never a pixel. The same annotation is
  drawn on a laptop and read on a phone, and a circle recorded at
  1280px wide that redraws at 390px has to land on the same blade of
  grass. Normalising at the point of capture is the only place this
  can be got right once; doing it at render time means every reader
  needs to know what size the author's screen was.
*/

export type AnnotationColor = "signal" | "positive" | "review" | "correction" | "white";

/** Drawn in the product's own palette rather than raw hex, so a mark
 *  means the same thing here as a clip sentiment does. */
export const ANNOTATION_COLORS: { key: AnnotationColor; label: string; css: string }[] = [
  { key: "correction", label: "Correction", css: "var(--correction)" },
  { key: "positive", label: "Good", css: "var(--positive)" },
  { key: "review", label: "Look at", css: "var(--review)" },
  { key: "signal", label: "Signal", css: "var(--signal-bright)" },
  { key: "white", label: "Plain", css: "#f4f3f8" },
];

export type ToolKind = "pen" | "arrow" | "line" | "ellipse" | "marker" | "text" | "eraser";

export const TOOLS: { key: ToolKind; label: string; hint: string }[] = [
  { key: "arrow", label: "Arrow", hint: "A run, a pass, where somebody should have gone" },
  { key: "line", label: "Line", hint: "A passing lane, a defensive line, an offside line" },
  { key: "ellipse", label: "Circle", hint: "Space, a player, an area" },
  { key: "marker", label: "Marker", hint: "Tap a player — a ring at their feet" },
  { key: "text", label: "Text", hint: "A word on the frame — SCAN, HOLD, ARRIVE LATE" },
  { key: "pen", label: "Pen", hint: "Anything the others cannot say" },
  { key: "eraser", label: "Eraser", hint: "Tap a mark to remove it" },
];

interface Base {
  c: AnnotationColor;
  /** Stroke width as a fraction of the frame's smaller side, so it scales too. */
  w: number;
}

export type Shape =
  /** Freehand. `pts` is flattened [x,y,x,y,…] to keep the JSON small. */
  | (Base & { t: "pen"; pts: number[] })
  | (Base & { t: "arrow"; x1: number; y1: number; x2: number; y2: number })
  /** An arrow without a head — a lane, a defensive line, an offside line. */
  | (Base & { t: "line"; x1: number; y1: number; x2: number; y2: number })
  | (Base & { t: "ellipse"; x: number; y: number; rx: number; ry: number })
  /** A player marker — the flat ring at a player's feet every broadcast uses. */
  | (Base & { t: "marker"; x: number; y: number })
  /** A word on the frame. Short, loud, football: SCAN. HOLD. ARRIVE LATE. */
  | (Base & { t: "text"; x: number; y: number; s: string });

export interface Annotation {
  id: string;
  videoId: string;
  atSeconds: number;
  shapes: Shape[];
  note: string | null;
  createdAt: string;
}

export const MAX_SHAPES = 40;
export const NOTE_MAX = 280;
export const DEFAULT_WIDTH = 0.004;
/** A frame label is a cue, not a sentence. */
export const TEXT_MAX = 24;

const isFraction = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= -0.5 && v <= 1.5;

/*
  Slightly outside 0..1 is allowed on purpose. A coach circling a
  player at the touchline naturally overshoots the frame edge, and
  clamping mid-drag makes the shape fight the cursor. The canvas clips
  what falls outside; the data keeps what was drawn.
*/

const isColor = (v: unknown): v is AnnotationColor =>
  typeof v === "string" && ANNOTATION_COLORS.some((c) => c.key === v);

/**
 * Is this really a shape?
 *
 * Runs before anything is stored, because `shapes` is a jsonb column
 * and Postgres will happily accept whatever shape of JSON it is
 * handed. A malformed entry would not fail on write — it would fail
 * on the canvas, months later, on somebody else's screen.
 */
export function isShape(v: unknown): v is Shape {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  if (!isColor(s.c)) return false;
  if (typeof s.w !== "number" || !(s.w > 0) || s.w > 0.1) return false;

  if (s.t === "pen") {
    if (!Array.isArray(s.pts)) return false;
    // At least two points, and always in x,y pairs.
    if (s.pts.length < 4 || s.pts.length % 2 !== 0) return false;
    return s.pts.every(isFraction);
  }
  if (s.t === "arrow" || s.t === "line") {
    return [s.x1, s.y1, s.x2, s.y2].every(isFraction);
  }
  if (s.t === "ellipse") {
    if (![s.x, s.y].every(isFraction)) return false;
    // A radius must be positive; a zero-radius ellipse is an invisible row.
    return typeof s.rx === "number" && typeof s.ry === "number" && s.rx > 0 && s.ry > 0;
  }
  if (s.t === "marker") {
    return [s.x, s.y].every(isFraction);
  }
  if (s.t === "text") {
    if (![s.x, s.y].every(isFraction)) return false;
    // Empty text is an invisible row; over-long text is a caption, not a cue.
    return typeof s.s === "string" && s.s.trim().length > 0 && s.s.length <= TEXT_MAX;
  }
  return false;
}

/** Keep only what is genuinely drawable, capped. Never throws. */
export function sanitizeShapes(input: unknown): Shape[] {
  if (!Array.isArray(input)) return [];
  return input.filter(isShape).slice(0, MAX_SHAPES);
}

export function noteIssue(v: string): string | null {
  if (v.length > NOTE_MAX) return `Keep the note under ${NOTE_MAX} characters.`;
  return null;
}

/**
 * Which shape is under a point — the eraser's question.
 *
 * Returns the index of the TOPMOST hit (last drawn wins, matching what
 * the eye sees on the canvas) or -1. Tolerance is a fraction of the
 * frame, generous on purpose: an eraser that demands pixel accuracy on
 * a phone removes nothing but patience.
 */
export function shapeAt(shapes: Shape[], x: number, y: number, tolerance = 0.03): number {
  const segDist = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  };

  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (s.t === "pen") {
      for (let p = 0; p + 3 < s.pts.length; p += 2) {
        if (segDist(x, y, s.pts[p], s.pts[p + 1], s.pts[p + 2], s.pts[p + 3]) < tolerance) return i;
      }
    } else if (s.t === "arrow" || s.t === "line") {
      if (segDist(x, y, s.x1, s.y1, s.x2, s.y2) < tolerance) return i;
    } else if (s.t === "ellipse") {
      // Near the RING, not anywhere inside — a big circle around the box
      // should not swallow every tap within it.
      const nx = (x - s.x) / Math.max(s.rx, 0.001);
      const ny = (y - s.y) / Math.max(s.ry, 0.001);
      const r = Math.hypot(nx, ny);
      if (Math.abs(r - 1) * Math.min(s.rx, s.ry) < tolerance) return i;
    } else if (s.t === "marker") {
      if (Math.hypot(x - s.x, y - s.y) < Math.max(tolerance, 0.035)) return i;
    } else if (s.t === "text") {
      // A loose box around the label's anchor.
      if (Math.abs(x - s.x) < 0.12 && Math.abs(y - s.y) < 0.05) return i;
    }
  }
  return -1;
}

export function colorCss(c: AnnotationColor): string {
  return ANNOTATION_COLORS.find((x) => x.key === c)?.css ?? "#f4f3f8";
}

/** mm:ss, matching how the film room writes every other timestamp. */
export function atLabel(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * A filename for an exported board that somebody can find again.
 *
 * The timestamp is in it because the common case is four boards from
 * one match, and `board.png`, `board (1).png`, `board (2).png` is how
 * they become indistinguishable the moment they reach a Downloads
 * folder. Lives here rather than with the canvas code so it stays pure
 * — it is the one part of exporting that can be tested without a DOM.
 */
export function boardFilename(title: string, atSeconds: number): string {
  const slug = title
    /*
      Accents are folded to their base letter rather than thrown away.
      NFD splits "í" into "i" plus a combining mark, which the strip
      below then removes — so "TJ Baník Kalinovo vs. FTC Fiľakovo"
      becomes "tj-banik-kalinovo-vs-ftc-filakovo" and not the
      "tj-ban-k-...-fi-akovo" you get from treating every accented
      letter as punctuation. This matters here: half the fixtures this
      is ever pointed at are Slovak.
    */
    .normalize("NFD")
    // \p{M} is every combining mark — exactly what NFD just split off.
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    // A slug trimmed mid-word can end on the separator again.
    .replace(/-+$/, "");
  const stamp = atLabel(atSeconds).replace(":", "-");
  return `${slug || "film"}-${stamp}.png`;
}
