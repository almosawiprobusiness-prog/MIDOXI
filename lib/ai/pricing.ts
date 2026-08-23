/*
  What an AI call costs. Pure arithmetic, deliberately client-safe.

  This used to live inside the `server-only` Claude client, which meant the one
  calculation the global budget ceiling depends on could not be tested. It is
  its own module now: no SDK, no environment, no I/O — just rates and a sum.

  Getting this wrong does not merely misreport. `withinAiBudget()` compares the
  running total against the configured ceiling, so an over-estimate switches
  Claude off early for every user, and an under-estimate spends past the cap.
*/

export type AiTier = "fast" | "standard" | "deep" | "video";

/**
 * Approx blended $/1M tokens (input+output midpoint) — for usage estimates.
 *
 * `video` is a different model family on a different price list. The number
 * here was 0.5, chosen on the reasoning that a video read is "almost entirely
 * input tokens" and that sitting above the published input rate was therefore
 * conservative.
 *
 * Then a real read was measured: 8,867 input and 1,892 output for ninety
 * seconds of film. Input is 82% of the tokens — but Flash output is roughly
 * eight times the price of input, so output is 64% of the BILL. The honest
 * blend is about $0.69/Mtok, and 0.5 was under-estimating by 27%.
 *
 * Under-estimating is the direction that matters. `withinAiBudget()` reads this
 * number, and a ceiling that under-counts spends past the limit it exists to
 * enforce; one that over-counts merely switches video reading off early, which
 * is visible and recoverable. So this now sits deliberately above the measured
 * blend rather than below it.
 *
 * Recheck against the provider's price list when the model changes — the rates
 * behind this are Flash paid-tier, and model pricing moves.
 */
export const TIER_COST_PER_MTOK: Record<AiTier, number> = {
  fast: 3,
  standard: 9,
  deep: 15,
  video: 1,
};

/**
 * A cache read costs roughly a tenth of a fresh input token; writing the cache
 * costs slightly more than a fresh one. That asymmetry is the whole economics
 * of caching: it loses money on a prompt used once and saves an order of
 * magnitude on a prompt used repeatedly — which is every system prompt here.
 */
export const CACHE_READ_MULTIPLIER = 0.1;
export const CACHE_WRITE_MULTIPLIER = 1.25;

/** Token counts for one call, cache reads and writes separated out. */
export interface AiUsage {
  input: number;
  output: number;
  /** Read from the prompt cache — an order of magnitude cheaper than `input`. */
  cacheRead: number;
  /** Written to the prompt cache — paid once, then read cheaply for the TTL. */
  cacheWrite: number;
}

export const NO_USAGE: AiUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

/** Sum the usage of every call an operation made, so nothing goes unpriced. */
export function addUsage(...parts: (AiUsage | null | undefined)[]): AiUsage {
  const total: AiUsage = { ...NO_USAGE };
  for (const p of parts) {
    if (!p) continue;
    total.input += p.input;
    total.output += p.output;
    total.cacheRead += p.cacheRead;
    total.cacheWrite += p.cacheWrite;
  }
  return total;
}

export function estimateCostUsd(input: {
  tier: AiTier;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}): number {
  const rate = TIER_COST_PER_MTOK[input.tier];
  const billable =
    (input.inputTokens ?? 0) +
    (input.outputTokens ?? 0) +
    (input.cacheReadTokens ?? 0) * CACHE_READ_MULTIPLIER +
    (input.cacheWriteTokens ?? 0) * CACHE_WRITE_MULTIPLIER;
  return (billable / 1_000_000) * rate;
}

/**
 * How much a call saved by hitting the cache, as a fraction of what it would
 * have cost with no cache at all. Used to report the saving honestly rather
 * than claiming a flat headline number.
 */
export function cacheSaving(tier: AiTier, usage: AiUsage): number {
  if (usage.cacheRead === 0) return 0;
  const withCache = estimateCostUsd({
    tier,
    inputTokens: usage.input,
    outputTokens: usage.output,
    cacheReadTokens: usage.cacheRead,
    cacheWriteTokens: usage.cacheWrite,
  });
  const without = estimateCostUsd({
    tier,
    inputTokens: usage.input + usage.cacheRead + usage.cacheWrite,
    outputTokens: usage.output,
  });
  if (without <= 0) return 0;
  return Math.max(0, 1 - withCache / without);
}
