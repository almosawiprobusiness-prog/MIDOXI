import { describe, it, expect } from "vitest";
import {
  MAX_FRAMES,
  SAMPLE_RATES,
  TRACKING_GAP,
  frameCount,
  frameTimestamps,
  maxRangeSeconds,
} from "../../lib/video/provider";

/*
  Frame sampling decides both the cost of an analysis and whether the model is
  looking at the right moments, so the arithmetic is pinned here.
*/

describe("frame sampling", () => {
  it("never exceeds the frame budget, however long the range", () => {
    expect(frameCount(0, 600, 2)).toBe(MAX_FRAMES);
    expect(frameTimestamps(0, 600, 2)).toHaveLength(MAX_FRAMES);
  });

  it("samples at the requested rate inside the budget", () => {
    expect(frameCount(10, 18, 1)).toBe(9);
    expect(frameCount(10, 14, 0.5)).toBe(3);
  });

  it("always returns at least one frame", () => {
    expect(frameCount(12, 12, 1)).toBe(1);
    expect(frameTimestamps(12, 12, 1)).toEqual([12]);
  });

  it("spreads timestamps evenly across the range, inclusive of both ends", () => {
    const stamps = frameTimestamps(10, 20, 0.5);
    expect(stamps[0]).toBe(10);
    expect(stamps[stamps.length - 1]).toBe(20);
    const gaps = stamps.slice(1).map((t, i) => Number((t - stamps[i]).toFixed(2)));
    expect(new Set(gaps).size).toBe(1);
  });

  it("keeps every timestamp inside the range", () => {
    for (const fps of SAMPLE_RATES.map((r) => r.fps)) {
      for (const stamp of frameTimestamps(30, 45, fps)) {
        expect(stamp, `fps ${fps}`).toBeGreaterThanOrEqual(30);
        expect(stamp, `fps ${fps}`).toBeLessThanOrEqual(45);
      }
    }
  });

  it("tells the UI how long a range may be at each rate", () => {
    expect(maxRangeSeconds(1)).toBe(MAX_FRAMES);
    expect(maxRangeSeconds(2)).toBe(MAX_FRAMES / 2);
    // Whatever rate is chosen, the budget holds.
    for (const r of SAMPLE_RATES) {
      expect(frameCount(0, maxRangeSeconds(r.fps), r.fps)).toBeLessThanOrEqual(MAX_FRAMES);
    }
  });
});

describe("provider honesty", () => {
  it("states what tracking would add and that it needs a vendor", () => {
    expect(TRACKING_GAP.needs.toLowerCase()).toContain("vendor");
    expect(TRACKING_GAP.capabilities).toContain("tracking");
    // Frame reading is never described as measurement.
    expect(TRACKING_GAP.describes.toLowerCase()).toContain("measurement");
  });
});
