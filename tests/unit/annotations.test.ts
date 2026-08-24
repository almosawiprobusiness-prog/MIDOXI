import { describe, it, expect } from "vitest";
import {
  isShape,
  sanitizeShapes,
  noteIssue,
  colorCss,
  atLabel,
  MAX_SHAPES,
  NOTE_MAX,
  type Shape,
} from "../../lib/data/annotation-types";

/*
  Shapes are stored in a jsonb column, which accepts any JSON at all.
  Nothing in Postgres will refuse a malformed mark — it will be written
  happily and fail months later, on a canvas, on somebody else's screen.
  So the validation IS the schema, and these are the tests that hold it.
*/

const arrow: Shape = { t: "arrow", c: "correction", w: 0.004, x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.5 };
const circle: Shape = { t: "ellipse", c: "positive", w: 0.004, x: 0.5, y: 0.5, rx: 0.1, ry: 0.08 };
const pen: Shape = { t: "pen", c: "review", w: 0.004, pts: [0.1, 0.1, 0.2, 0.2, 0.3, 0.25] };

describe("what a shape is", () => {
  it("accepts the three the tools can draw", () => {
    expect(isShape(arrow)).toBe(true);
    expect(isShape(circle)).toBe(true);
    expect(isShape(pen)).toBe(true);
  });

  it("refuses anything that is not one of them", () => {
    expect(isShape(null)).toBe(false);
    expect(isShape("arrow")).toBe(false);
    expect(isShape({})).toBe(false);
    expect(isShape({ ...arrow, t: "rectangle" })).toBe(false);
  });

  it("refuses a colour the palette does not have", () => {
    // A raw hex would render, which is exactly why it has to be refused
    // here: the point of the token is that a mark means the same thing
    // as the clip sentiment of the same name.
    expect(isShape({ ...arrow, c: "#ff0000" })).toBe(false);
    expect(isShape({ ...arrow, c: "purple" })).toBe(false);
  });

  it("refuses coordinates that are not finite numbers", () => {
    expect(isShape({ ...arrow, x1: NaN })).toBe(false);
    expect(isShape({ ...arrow, y2: Infinity })).toBe(false);
    expect(isShape({ ...arrow, x2: "0.5" })).toBe(false);
  });

  it("refuses a stroke width that would paint over the whole frame", () => {
    expect(isShape({ ...arrow, w: 0 })).toBe(false);
    expect(isShape({ ...arrow, w: -1 })).toBe(false);
    expect(isShape({ ...arrow, w: 5 })).toBe(false);
  });

  it("refuses an invisible circle", () => {
    expect(isShape({ ...circle, rx: 0 })).toBe(false);
    expect(isShape({ ...circle, ry: -0.1 })).toBe(false);
  });

  it("refuses a pen stroke that is not whole x,y pairs", () => {
    expect(isShape({ ...pen, pts: [0.1, 0.1, 0.2] })).toBe(false);
    expect(isShape({ ...pen, pts: [0.1] })).toBe(false);
    expect(isShape({ ...pen, pts: "0.1,0.1" })).toBe(false);
  });

  it("refuses a single-point stroke, which paints nothing", () => {
    // One point is a moveTo with no lineTo. Canvas strokes an empty
    // path as nothing at all, so this would be an invisible row.
    expect(isShape({ ...pen, pts: [0.1, 0.1] })).toBe(false);
    expect(isShape({ ...pen, pts: [0.1, 0.1, 0.2, 0.2] })).toBe(true);
  });
});

describe("drawing past the edge of the frame", () => {
  /*
    Circling a player at the touchline means overshooting the picture.
    Clamping mid-drag makes the shape fight the cursor, so slightly
    outside 0..1 is kept — but only slightly, so a coordinate that is
    plainly wrong is still caught.
  */
  it("keeps a mark that runs just off the picture", () => {
    expect(isShape({ ...arrow, x1: -0.2, y2: 1.1 })).toBe(true);
  });

  it("still refuses one nowhere near it", () => {
    expect(isShape({ ...arrow, x1: -50 })).toBe(false);
    expect(isShape({ ...arrow, y2: 12 })).toBe(false);
  });
});

describe("sanitizeShapes", () => {
  it("keeps the good and drops the bad, without throwing", () => {
    const got = sanitizeShapes([arrow, { t: "rectangle" }, circle, null, "pen", pen]);
    expect(got).toEqual([arrow, circle, pen]);
  });

  it("returns an empty list for anything that is not a list", () => {
    expect(sanitizeShapes(null)).toEqual([]);
    expect(sanitizeShapes(undefined)).toEqual([]);
    expect(sanitizeShapes({ shapes: [arrow] })).toEqual([]);
    expect(sanitizeShapes("[]")).toEqual([]);
  });

  it("caps how much can be sent in one drawing", () => {
    const many = Array.from({ length: MAX_SHAPES + 25 }, () => arrow);
    expect(sanitizeShapes(many)).toHaveLength(MAX_SHAPES);
  });
});

describe("the note", () => {
  it("accepts an ordinary one", () => {
    expect(noteIssue("Step in earlier — the space is behind him")).toBeNull();
    expect(noteIssue("")).toBeNull();
  });

  it("refuses one past the limit, and says what the limit is", () => {
    const issue = noteIssue("x".repeat(NOTE_MAX + 1));
    expect(issue).toContain(String(NOTE_MAX));
  });

  it("accepts one exactly at the limit", () => {
    expect(noteIssue("x".repeat(NOTE_MAX))).toBeNull();
  });
});

describe("colours", () => {
  it("resolves every palette key to something paintable", () => {
    for (const key of ["signal", "positive", "review", "correction", "white"] as const) {
      expect(colorCss(key)).toBeTruthy();
    }
  });

  it("falls back rather than returning nothing for an unknown key", () => {
    // @ts-expect-error deliberately outside the union — this is the
    // shape a stored row could take if it were written before a
    // colour was renamed.
    expect(colorCss("chartreuse")).toBe("#f4f3f8");
  });
});

describe("atLabel", () => {
  it("writes mm:ss the way the rest of the film room does", () => {
    expect(atLabel(0)).toBe("0:00");
    expect(atLabel(9)).toBe("0:09");
    expect(atLabel(65)).toBe("1:05");
    expect(atLabel(600)).toBe("10:00");
  });

  it("rounds down rather than showing a fraction of a second", () => {
    expect(atLabel(65.94)).toBe("1:05");
  });

  it("never shows a negative time", () => {
    expect(atLabel(-4)).toBe("0:00");
  });

  it("keeps counting in minutes past an hour rather than silently wrapping", () => {
    // A full match is 90 minutes. Showing 30:00 for 90:00 would be a
    // wrong timestamp on the one file type this tool exists for.
    expect(atLabel(5400)).toBe("90:00");
  });
});
