import "server-only";
import { generateJson, aiAvailable, aiStatus } from "./anthropic";
import { checkFeature } from "@/lib/billing/membership";
import { refusalReason } from "@/lib/billing/gate-copy";
import { consumeFeature, releaseFeature, logAiUsage } from "@/lib/billing/meter";
import { withinAiBudget } from "@/lib/billing/budget";
import { buildPlayerContext } from "@/lib/intelligence/build-context";
import {
  composeSessionPlan,
  validateBlocks,
  MIN_BLOCKS,
  type SessionBlock,
  type SessionProposal,
} from "@/lib/intelligence/session-plan";
import { contextPromptBlock, validSourceKeys, type PlayerContext } from "@/lib/intelligence/context";
import type { SessionKind } from "@/lib/types";

/*
  ============================================================
  SESSION ENGINE — the STUDY → AI TRAINING arrow.
  ------------------------------------------------------------
  Drill apps sell the same week to everyone. This engine derives
  a session from the player's own record — the context selector's
  bounded block — and every block must cite the piece of the
  record it exists because of. Blocks with citations the record
  cannot back are dropped in code (session-plan.ts), never argued
  with in the prompt.

  Two layers, same discipline as the study and trainer engines:

  1. composeSessionPlan() — deterministic, free, always available.
  2. draftSession()       — the metered Claude pass, gated on
     membership, budget and reachability, refunded via
     releaseFeature when the failure is not the player's fault.
  ============================================================
*/

const SESSION_KINDS: SessionKind[] = [
  "individual",
  "technical",
  "tactical",
  "gym",
  "conditioning",
  "speed",
  "mobility",
  "recovery",
];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    kind: { type: "string", enum: SESSION_KINDS },
    durationMin: { type: "number" },
    objective: { type: "string" },
    blocks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          detail: { type: "string" },
          work: { type: "string" },
          sourceKey: { type: "string" },
          why: { type: "string" },
        },
        required: ["name", "detail", "work", "sourceKey", "why"],
      },
    },
  },
  required: ["title", "kind", "durationMin", "objective", "blocks"],
} as const;

const SYSTEM = `You are MIDO, the football intelligence inside MIDO XI.

You are writing ONE individual training session for one player, derived from their actual record.

HARD RULES — these are not style preferences:
- You will be given the player's record as lines tagged with keys like [goal:...], [film:...], [readiness], [rhythm], plus optionally their standing memory. Every block you write MUST set "sourceKey" to one of those exact keys — the single piece of the record that block exists because of. A block you cannot tie to the record does not belong in the session.
- NEVER invent statistics, test results, events or observations. If the record does not show it, do not claim it.
- If readiness is below 40, the session stays submaximal: no maximal sprinting, no heavy loading, and say so in the block that adapts.
- Respect the memory absolutely — if it says a drill did not work or an area is constrained, do not program it.
- "why" is one sentence in the player's terms, citing the record in plain words ("your film showed this three times"), never hype.
- Real prescriptions: sets, reps, minutes, rest. 3-6 blocks, 30-75 minutes total.
- The objective names what this session moves forward, not a slogan.`;

export interface DraftSessionResult {
  proposal: SessionProposal;
  context: PlayerContext;
}

interface Payload {
  title: string;
  kind: SessionKind;
  durationMin: number;
  objective: string;
  blocks: SessionBlock[];
}

/**
 * The metered draft. Always returns a usable session: on any gate
 * failure or model error the deterministic composition is returned
 * with an honest note. A consumed unit is refunded when the failure
 * was not the player's fault.
 */
export async function draftSession(): Promise<DraftSessionResult> {
  const context = await buildPlayerContext();
  const base = composeSessionPlan(context);

  const gate = await checkFeature("ai_interactions");
  if (!gate.allowed) {
    return { proposal: { ...base, note: refusalReason(gate, "ai_interactions", "player") }, context };
  }
  if (!aiAvailable()) {
    return {
      proposal: {
        ...base,
        note:
          aiStatus().reason === "no_credits"
            ? "MIDO's writing model is unavailable right now — this is the composed session."
            : "MIDO's writing model is disabled — this is the composed session.",
      },
      context,
    };
  }
  if (!(await withinAiBudget())) {
    return {
      proposal: { ...base, note: "AI generation is paused this month — this is the composed session." },
      context,
    };
  }
  if (!(await consumeFeature("ai_interactions"))) return { proposal: base, context };

  const started = Date.now();
  const res = await generateJson<Payload>({
    tier: "standard",
    system: SYSTEM,
    prompt: `${contextPromptBlock(context)}

Valid sourceKey values, and nothing else: ${[...validSourceKeys(context)].join(", ")}

Write the session.`,
    schema: SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 2500,
    // The record changes between calls; caching it would pay a write
    // that is never read. The stable persona is small next to it.
    cacheSystem: false,
  });

  await logAiUsage({
    feature: "ai_interactions",
    tier: "standard",
    inputTokens: res.ok ? res.usage.input : 0,
    outputTokens: res.ok ? res.usage.output : 0,
    cacheReadTokens: res.ok ? res.usage.cacheRead : 0,
    cacheWriteTokens: res.ok ? res.usage.cacheWrite : 0,
    latencyMs: Date.now() - started,
    status: res.ok ? "ok" : "error",
  });

  if (!res.ok) {
    // Model unreachable / rate limited / empty — not the player's fault.
    await releaseFeature("ai_interactions");
    return {
      proposal: { ...base, note: "MIDO could not draft this session just now — the composed session is shown instead." },
      context,
    };
  }

  const blocks = validateBlocks(res.data.blocks ?? [], context);
  if (blocks.length < MIN_BLOCKS) {
    /*
      The model answered but too little of it survived citation
      checking. The read RAN — this one is not refunded, the same
      rule as a film read that was merely useless.
    */
    return {
      proposal: { ...base, note: "MIDO's draft could not be tied to your record — the composed session is shown instead." },
      context,
    };
  }

  return {
    proposal: {
      title: (res.data.title || base.title).slice(0, 120),
      kind: SESSION_KINDS.includes(res.data.kind) ? res.data.kind : "individual",
      durationMin: Math.min(120, Math.max(20, Math.round(res.data.durationMin || base.durationMin))),
      objective: (res.data.objective || base.objective).slice(0, 300),
      blocks,
      source: "mido",
      note: null,
    },
    context,
  };
}
