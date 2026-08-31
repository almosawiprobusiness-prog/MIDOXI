import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isShape,
  sanitizeShapes,
  shapeAt,
  TEXT_MAX,
  type Shape,
} from "@/lib/data/annotation-types";
import { POST_KINDS, kindLabel } from "@/lib/data/feed-types";
import {
  PUBLISH_ACCENTS,
  PUBLISH_INK,
  PUBLISH_HI,
  PUBLISH_DIM,
  PUBLISH_SIGNAL,
  accentValue,
} from "@/lib/publish/palette";
import { PUBLISH_FORMATS, formatDims } from "@/lib/publish/types";

/*
  The social refinement pass — the pieces that carry a contract.

  Shapes because they live in a jsonb column and a malformed one fails
  months later on somebody else's canvas; the palette because it is a
  deliberate copy of globals.css and copies drift; the accent list
  because an arbitrary query value must never paint a card.
*/

const base = { c: "correction" as const, w: 0.004 };

describe("new annotation shapes", () => {
  it("accepts a line", () => {
    expect(isShape({ ...base, t: "line", x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.5 })).toBe(true);
  });

  it("accepts a player marker", () => {
    expect(isShape({ ...base, t: "marker", x: 0.4, y: 0.8 })).toBe(true);
  });

  it("accepts a text cue and refuses an empty or over-long one", () => {
    expect(isShape({ ...base, t: "text", x: 0.5, y: 0.5, s: "ARRIVE LATE" })).toBe(true);
    expect(isShape({ ...base, t: "text", x: 0.5, y: 0.5, s: "   " })).toBe(false);
    expect(isShape({ ...base, t: "text", x: 0.5, y: 0.5, s: "x".repeat(TEXT_MAX + 1) })).toBe(false);
  });

  it("sanitize keeps the new kinds", () => {
    const shapes = [
      { ...base, t: "marker", x: 0.2, y: 0.2 },
      { ...base, t: "text", x: 0.5, y: 0.5, s: "SCAN" },
      { ...base, t: "line", x1: 0, y1: 0, x2: 1, y2: 1 },
      { t: "nonsense" },
    ];
    expect(sanitizeShapes(shapes)).toHaveLength(3);
  });
});

describe("eraser hit-testing", () => {
  const shapes: Shape[] = [
    { ...base, t: "line", x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5 },
    { ...base, t: "marker", x: 0.5, y: 0.8 },
    { ...base, t: "text", x: 0.5, y: 0.2, s: "SCAN" },
  ];

  it("finds a line by a point near it", () => {
    expect(shapeAt(shapes, 0.5, 0.51)).toBe(0);
  });

  it("finds the marker and the cue", () => {
    expect(shapeAt(shapes, 0.51, 0.81)).toBe(1);
    expect(shapeAt(shapes, 0.52, 0.22)).toBe(2);
  });

  it("returns -1 in open space", () => {
    expect(shapeAt(shapes, 0.05, 0.05)).toBe(-1);
  });

  it("prefers the topmost (last-drawn) shape", () => {
    const stacked: Shape[] = [
      { ...base, t: "marker", x: 0.5, y: 0.5 },
      { ...base, t: "marker", x: 0.5, y: 0.5 },
    ];
    expect(shapeAt(stacked, 0.5, 0.5)).toBe(1);
  });

  it("does not treat the inside of a big circle as the circle", () => {
    const circle: Shape[] = [{ ...base, t: "ellipse", x: 0.5, y: 0.5, rx: 0.4, ry: 0.4 }];
    expect(shapeAt(circle, 0.5, 0.5)).toBe(-1); // dead center, far from the ring
    expect(shapeAt(circle, 0.9, 0.5)).toBe(0); // on the ring
  });
});

describe("post kinds", () => {
  it("has the six kinds in the filter row's order", () => {
    expect(POST_KINDS.map((k) => k.value)).toEqual([
      "training",
      "match",
      "film",
      "study",
      "development",
      "milestone",
    ]);
  });

  it("labels a kind and shrugs at null", () => {
    expect(kindLabel("film")).toBe("Film");
    expect(kindLabel(null)).toBeNull();
  });
});

describe("publish palette", () => {
  it("mirrors globals.css — the copy this file exists to police", () => {
    const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf-8");
    expect(css).toContain(`--ink-950: ${PUBLISH_INK}`);
    expect(css).toContain(`--text-hi: ${PUBLISH_HI}`);
    expect(css).toContain(`--text-dim: ${PUBLISH_DIM}`);
    expect(css).toContain(`--signal: ${PUBLISH_SIGNAL}`);
  });

  it("resolves unknown accents to the MIDO signal, never to raw input", () => {
    expect(accentValue("signal")).toBe(PUBLISH_SIGNAL);
    expect(accentValue("#ff0000")).toBe(PUBLISH_SIGNAL);
    expect(accentValue(null)).toBe(PUBLISH_SIGNAL);
    expect(accentValue("javascript:alert(1)")).toBe(PUBLISH_SIGNAL);
  });

  it("every accent is a hex colour", () => {
    for (const a of PUBLISH_ACCENTS) expect(a.value).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("publish formats", () => {
  it("leads with portrait 1080×1350", () => {
    expect(PUBLISH_FORMATS[0]).toMatchObject({ key: "portrait", width: 1080, height: 1350 });
  });

  it("still serves the other three", () => {
    expect(formatDims("square")).toMatchObject({ width: 1080, height: 1080 });
    expect(formatDims("story")).toMatchObject({ width: 1080, height: 1920 });
    expect(formatDims("landscape")).toMatchObject({ width: 1200, height: 630 });
  });
});
