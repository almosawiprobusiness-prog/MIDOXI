import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env, features } from "@/lib/env";

/*
  MIDO XI — Claude provider.

  A thin, resilient wrapper over the Anthropic SDK. Three things matter here:

  1. Router. Study tasks vary in difficulty; we pick the cheapest model that
     does the job. `fast` (Haiku) drafts search intents, `standard` (Sonnet)
     ranks and explains, `deep` (Opus) is reserved for heavier analysis.

  2. Structured output. Every call returns validated JSON via output_config.
     Callers get typed data or a typed failure — never a raw string to parse.

  3. Circuit breaker. If the account has no credits (or the key is bad), the
     first failure trips a breaker and later calls short-circuit for a cooldown
     instead of hammering a dead endpoint. The Study Engine degrades to its
     heuristic path when this trips, so the product never hard-crashes on AI.

  4. Prompt caching. Every engine here has a long, stable system prompt — the
     persona, the curated football vocabulary, the rules about what may and may
     not be claimed. It is identical on every call and it dwarfs the per-request
     payload, which makes it exactly what a cache breakpoint is for. Callers
     that pass a `system` opt in by default; the saving shows up in
     `usage.cacheRead` and is priced accordingly.
*/

/*
  Rates, usage shapes and the cost sum live in ./pricing — pure arithmetic that
  the budget ceiling depends on, kept out of this server-only module so it can
  be tested. Re-exported here so callers have one import.
*/
export {
  TIER_COST_PER_MTOK,
  CACHE_READ_MULTIPLIER,
  CACHE_WRITE_MULTIPLIER,
  estimateCostUsd,
  addUsage,
  cacheSaving,
  NO_USAGE,
  type AiTier,
  type AiUsage,
} from "./pricing";
import type { AiTier, AiUsage } from "./pricing";

/*
  The tiers Claude actually serves.

  `AiTier` also carries "video", which is a different model family on a
  different price list — Claude does not read video, so there is no model to
  put in the table below. Naming the subset here means adding a tier for
  another provider cannot silently leave a hole in this map.
*/
export type ClaudeTier = Exclude<AiTier, "video" | "video_deep">;

const MODELS: Record<ClaudeTier, string> = {
  fast: "claude-haiku-4-5-20251001",
  standard: "claude-sonnet-5",
  deep: "claude-opus-5",
};

/**
 * The model a tier resolves to — for `logAiUsage({ model })`, so spend
 * can be attributed to a model version after this table changes. The
 * table itself stays private: callers choose tiers, never models.
 */
export function modelFor(tier: ClaudeTier): string {
  return MODELS[tier];
}

export type AiFailReason = "disabled" | "no_credits" | "rate_limited" | "error";

export type AiResult<T> =
  | { ok: true; data: T; tier: ClaudeTier; usage: AiUsage }
  | { ok: false; reason: AiFailReason };

// ---- circuit breaker (module-scoped, survives across requests in a warm lambda) ----
type Breaker = { trippedUntil: number; reason: AiFailReason };
const g = globalThis as unknown as { __midoAiBreaker?: Breaker };
const breaker: Breaker = (g.__midoAiBreaker ??= { trippedUntil: 0, reason: "error" });

const COOLDOWN_MS = 5 * 60 * 1000; // 5 min after a credit/auth failure

function trip(reason: AiFailReason) {
  breaker.trippedUntil = Date.now() + COOLDOWN_MS;
  breaker.reason = reason;
}

/** True when Claude calls are worth attempting right now. */
export function aiAvailable(): boolean {
  if (!features.ai) return false;
  if (Date.now() < breaker.trippedUntil) return false;
  return true;
}

/** Why AI is currently unavailable, for honest UI copy. */
export function aiStatus(): { available: boolean; reason: AiFailReason | null } {
  if (!features.ai) return { available: false, reason: "disabled" };
  if (Date.now() < breaker.trippedUntil) return { available: false, reason: breaker.reason };
  return { available: true, reason: null };
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: env.anthropicKey });
  return _client;
}

function classify(err: unknown): AiFailReason {
  const status = (err as { status?: number })?.status;
  const msg = String((err as { message?: string })?.message ?? err).toLowerCase();
  if (status === 429) return "rate_limited";
  if (msg.includes("credit balance") || msg.includes("too low")) return "no_credits";
  if (status === 401 || status === 403 || status === 400) return "no_credits";
  return "error";
}

/** A still frame handed to the model, already base64 encoded. */
export interface ImageInput {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  /** Base64 payload, without the data: URI prefix. */
  data: string;
}

/**
 * Ask Claude for a JSON object matching `schema`. Returns typed data or a
 * typed failure. Never throws.
 *
 * Optional `images` are sent before the prompt text, which is the order the
 * model reads best when the prompt refers to "the frames above".
 */
export async function generateJson<T>(opts: {
  tier: ClaudeTier;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  images?: ImageInput[];
  /**
   * Cache the system prompt. On by default, because every engine's system
   * prompt is long, identical between calls and far larger than the request
   * itself. Turn it off only for a system prompt that genuinely changes each
   * time, where a cache write would be paid and never read.
   */
  cacheSystem?: boolean;
}): Promise<AiResult<T>> {
  if (!aiAvailable()) return { ok: false, reason: aiStatus().reason ?? "disabled" };

  const model = MODELS[opts.tier];

  /*
    `effort` and `format` are two fields of ONE output_config object. Setting
    them from two places and spreading one over the other silently drops the
    schema, which costs the structured-output guarantee on exactly the two tiers
    that do the hard work. They are built together here for that reason.
  */
  const outputConfig: Record<string, unknown> = {
    format: { type: "json_schema", schema: opts.schema },
  };
  // Haiku rejects `effort`; Sonnet and Opus get light adaptive thinking.
  if (opts.tier !== "fast") outputConfig.effort = "low";
  const thinking = opts.tier === "fast" ? undefined : { type: "adaptive" as const };

  /*
    The cache breakpoint goes on the system block: it is the stable half of the
    request, so a hit turns the persona and the football vocabulary into a tenth
    of their token cost. A 1h TTL suits a product where a coach drafts several
    sessions in a sitting and then leaves it alone for a day.
  */
  const cacheSystem = opts.cacheSystem ?? true;
  const system = cacheSystem
    ? [
        {
          type: "text" as const,
          text: opts.system,
          cache_control: { type: "ephemeral" as const, ttl: "1h" as const },
        },
      ]
    : opts.system;

  try {
    const res = await client().messages.create({
      model,
      max_tokens: opts.maxTokens ?? 1500,
      system,
      messages: [
        {
          role: "user",
          content: opts.images?.length
            ? [
                ...opts.images.map((img) => ({
                  type: "image" as const,
                  source: { type: "base64" as const, media_type: img.mediaType, data: img.data },
                })),
                { type: "text" as const, text: opts.prompt },
              ]
            : opts.prompt,
        },
      ],
      output_config: outputConfig,
      ...(thinking ? { thinking } : {}),
    } as Anthropic.MessageCreateParamsNonStreaming);

    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!text) return { ok: false, reason: "error" };

    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch {
      // salvage a JSON object if the model wrapped it in prose
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return { ok: false, reason: "error" };
      data = JSON.parse(m[0]) as T;
    }

    const u = res.usage as typeof res.usage & {
      cache_read_input_tokens?: number | null;
      cache_creation_input_tokens?: number | null;
    };
    return {
      ok: true,
      data,
      tier: opts.tier,
      usage: {
        input: u.input_tokens,
        output: u.output_tokens,
        cacheRead: u.cache_read_input_tokens ?? 0,
        cacheWrite: u.cache_creation_input_tokens ?? 0,
      },
    };
  } catch (err) {
    const reason = classify(err);
    if (reason === "no_credits" || reason === "rate_limited") trip(reason);
    return { ok: false, reason };
  }
}
