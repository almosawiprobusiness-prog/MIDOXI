import { describe, it, expect } from "vitest";
import {
  CACHE_READ_MULTIPLIER,
  CACHE_WRITE_MULTIPLIER,
  TIER_COST_PER_MTOK,
  addUsage,
  cacheSaving,
  estimateCostUsd as cost,
} from "../../lib/ai/pricing";

/*
  The global AI budget ceiling reads the number this arithmetic produces, so
  getting it wrong does not merely misreport — an over-estimate switches Claude
  off early for every user, and an under-estimate blows through the cap.
*/

describe("cache pricing", () => {
  it("prices a cache read far below a fresh input token", () => {
    expect(CACHE_READ_MULTIPLIER).toBeLessThan(0.5);
    expect(CACHE_READ_MULTIPLIER).toBeGreaterThan(0);
  });

  it("prices a cache write above a fresh input token", () => {
    // Otherwise caching would be free money, and the first call would be
    // mispriced in the cheap direction.
    expect(CACHE_WRITE_MULTIPLIER).toBeGreaterThan(1);
  });

  it("makes a cached call dramatically cheaper than the same call uncached", () => {
    // 8k of system prompt, 500 of request, 400 of answer — the shape of every
    // engine call in this product.
    const uncached = cost({ tier: "standard", inputTokens: 8500, outputTokens: 400 });
    const cached = cost({
      tier: "standard",
      inputTokens: 500,
      outputTokens: 400,
      cacheReadTokens: 8000,
    });
    expect(cached).toBeLessThan(uncached / 2);
  });

  it("charges the first call more than the uncached one, which is why caching only pays on repeats", () => {
    const uncached = cost({ tier: "standard", inputTokens: 8500, outputTokens: 400 });
    const firstCall = cost({
      tier: "standard",
      inputTokens: 500,
      outputTokens: 400,
      cacheWriteTokens: 8000,
    });
    expect(firstCall).toBeGreaterThan(uncached);
  });

  it("counts nothing when nothing was spent", () => {
    expect(cost({ tier: "deep" })).toBe(0);
  });

  it("reports the saving as a real fraction, and zero when nothing was cached", () => {
    expect(cacheSaving("standard", { input: 500, output: 400, cacheRead: 0, cacheWrite: 0 })).toBe(0);
    const saved = cacheSaving("standard", {
      input: 500,
      output: 400,
      cacheRead: 8000,
      cacheWrite: 0,
    });
    expect(saved).toBeGreaterThan(0.5);
    expect(saved).toBeLessThan(1);
  });
});

describe("summing a multi-call operation", () => {
  it("adds every part, so a cheap first call is never lost", () => {
    const total = addUsage(
      { input: 300, output: 80, cacheRead: 0, cacheWrite: 0 },
      { input: 500, output: 400, cacheRead: 8000, cacheWrite: 0 },
    );
    expect(total).toEqual({ input: 800, output: 480, cacheRead: 8000, cacheWrite: 0 });
  });

  it("ignores the calls that never happened", () => {
    expect(addUsage(null, undefined)).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    });
  });
});

describe("the tier ladder", () => {
  it("never makes a cheaper tier cost more than a dearer one", () => {
    expect(TIER_COST_PER_MTOK.fast).toBeLessThan(TIER_COST_PER_MTOK.standard);
    expect(TIER_COST_PER_MTOK.standard).toBeLessThan(TIER_COST_PER_MTOK.deep);
  });

  it("has a rate for every tier, so no call can be silently free", () => {
    for (const tier of ["fast", "standard", "deep"] as const) {
      expect(TIER_COST_PER_MTOK[tier], tier).toBeGreaterThan(0);
    }
  });
});
