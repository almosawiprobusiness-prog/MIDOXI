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

export type ToolKind = "pen" | "arrow" | "ellipse";

export const TOOLS: { key: ToolKind; label: string; hint: string }[] = [
  { key: "arrow", label: "Arrow", hint: "A run, a pass, where somebody should have gone" },
  { key: "ellipse", label: "Circle", hint: "Space, a player, an area" },
  { key: "pen", label: "Pen", hint: "Anything the other two cannot say" },
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
  | (Base & { t: "ellipse"; x: number; y: number; rx: number; ry: number });

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
  if (s.t === "arrow") {
    return [s.x1, s.y1, s.x2, s.y2].every(isFraction);
  }
  if (s.t === "ellipse") {
    if (![s.x, s.y].every(isFraction)) return false;
    // A radius must be positive; a zero-radius ellipse is an invisible row.
    return typeof s.rx === "number" && typeof s.ry === "number" && s.rx > 0 && s.ry > 0;
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
