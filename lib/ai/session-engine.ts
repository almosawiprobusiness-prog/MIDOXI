import "server-only";
import { generateJson, aiAvailable, aiStatus, modelFor } from "./anthropic";
import { SESSION_DRAFT, SESSION_ADAPT } from "./prompts";
import { sessionPayloadSchema, validateAi, type SessionPayload } from "./schemas";
import {
  adaptGuard,
  adaptMeta,
  deterministicAdapt,
  validateAdaptation,
  type AdaptDirective,
} from "@/lib/intelligence/session-adapt";
import { checkFeature } from "@/lib/billing/membership";
import { refusalReason } from "@/lib/billing/gate-copy";
import { consumeFeature, releaseFeature, logAiUsage } from "@/lib/billing/meter";
import { withinAiBudget } from "@/lib/billing/budget";
import { buildPlayerContext } from "@/lib/intelligence/build-context";
import {
  composeSessionPlan,
  validateBlocks,
  sanitizeBrief,
  briefPromptBlock,
  MIN_BLOCKS,
  type SessionBrief,
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

export interface DraftSessionResult {
  proposal: SessionProposal;
  context: PlayerContext;
}

/**
 * The metered draft. Always returns a usable session: on any gate
 * failure or model error the deterministic composition is returned
 * with an honest note. A consumed unit is refunded when the failure
 * was not the player's fault.
 */
export async function draftSession(rawBrief?: SessionBrief): Promise<DraftSessionResult> {
  const context = await buildPlayerContext();
  const brief = sanitizeBrief(rawBrief);
  /*
    A focus the record cannot back is dropped before anything is built
    around it — the key came from a link, and links outlive the
    evidence windows they point into.
  */
  if (brief.focusKey && !validSourceKeys(context).has(brief.focusKey)) delete brief.focusKey;
  const base = composeSessionPlan(context, brief);

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

  const briefBlock = briefPromptBlock(brief);
  const started = Date.now();
  const res = await generateJson<SessionPayload>({
    tier: SESSION_DRAFT.tier,
    system: SESSION_DRAFT.system,
    prompt: `${contextPromptBlock(context)}
${briefBlock ? `\n${briefBlock}\n` : ""}
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
    tier: SESSION_DRAFT.tier,
    model: modelFor(SESSION_DRAFT.tier),
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

  /*
    Shape gate before the sanity gates: json_schema enforcement plus
    JSON.parse have already run, so a payload failing Zod here is wrong
    in a way worth refusing outright — treated exactly like a model
    failure, and refunded like one.
  */
  const payload = validateAi(sessionPayloadSchema, res.data);
  if (!payload) {
    await releaseFeature("ai_interactions");
    return {
      proposal: { ...base, note: "MIDO's draft came back malformed — the composed session is shown instead." },
      context,
    };
  }

  const blocks = validateBlocks(payload.blocks ?? [], context);
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
      title: (payload.title || base.title).slice(0, 120),
      kind: SESSION_KINDS.includes(payload.kind as SessionKind) ? (payload.kind as SessionKind) : "individual",
      durationMin: Math.min(120, Math.max(20, Math.round(payload.durationMin || base.durationMin))),
      objective: (payload.objective || base.objective).slice(0, 300),
      blocks,
      source: "mido",
      note: null,
    },
    context,
  };
}

/**
 * Adapt a drafted session without losing what it is for. Safety gate
 * first (deterministic, free, unarguable), then the cheapest path that
 * honours the directive: code alone where code is honest, the metered
 * model otherwise. The adapted session keeps the original objective by
 * construction and may only cite what the original cited.
 */
export async function adaptSession(
  original: SessionProposal,
  directive: AdaptDirective,
): Promise<DraftSessionResult> {
  const context = await buildPlayerContext();
  const meta = adaptMeta(directive);
  if (!meta) return { proposal: { ...original, note: "MIDO does not know that adaptation." }, context };

  const refusal = adaptGuard(directive, context);
  if (refusal) return { proposal: { ...original, note: refusal }, context };

  const codeOnly = deterministicAdapt(original, directive);

  const gate = await checkFeature("ai_interactions");
  const aiReachable = gate.allowed && aiAvailable() && (await withinAiBudget());
  if (!aiReachable) {
    if (codeOnly) return { proposal: codeOnly, context };
    return {
      proposal: {
        ...original,
        note: gate.allowed
          ? "This adaptation needs MIDO's writing model, which is unavailable right now — the session stands as drafted."
          : refusalReason(gate, "ai_interactions", "player"),
      },
      context,
    };
  }

  if (!(await consumeFeature("ai_interactions"))) return { proposal: original, context };

  const started = Date.now();
  const res = await generateJson<SessionPayload>({
    tier: SESSION_ADAPT.tier,
    system: SESSION_ADAPT.system,
    prompt: `THE CURRENT SESSION (adapt this, do not replace it):
${JSON.stringify({ title: original.title, kind: original.kind, durationMin: original.durationMin, objective: original.objective, blocks: original.blocks })}

DIRECTIVE: ${meta.label}. ${meta.instruction}

${contextPromptBlock(context)}

Rewrite the session under the directive. Keep every sourceKey exactly as given.`,
    schema: SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 2500,
    cacheSystem: false,
  });

  await logAiUsage({
    feature: "ai_interactions",
    tier: SESSION_ADAPT.tier,
    model: modelFor(SESSION_ADAPT.tier),
    inputTokens: res.ok ? res.usage.input : 0,
    outputTokens: res.ok ? res.usage.output : 0,
    cacheReadTokens: res.ok ? res.usage.cacheRead : 0,
    cacheWriteTokens: res.ok ? res.usage.cacheWrite : 0,
    latencyMs: Date.now() - started,
    status: res.ok ? "ok" : "error",
  });

  if (!res.ok) {
    await releaseFeature("ai_interactions");
    if (codeOnly) return { proposal: codeOnly, context };
    return { proposal: { ...original, note: "MIDO could not adapt the session just now — it stands as drafted." }, context };
  }

  const payload = validateAi(sessionPayloadSchema, res.data);
  const blocks = payload ? validateBlocks(payload.blocks ?? [], context) : [];
  const adapted = payload
    ? {
        durationMin: Math.min(120, Math.max(20, Math.round(payload.durationMin || original.durationMin))),
        blocks,
      }
    : null;
  const broken = !payload
    ? "malformed"
    : validateAdaptation(original, adapted!, directive);

  if (!payload || broken) {
    /*
      The model ran and answered; what it answered failed the contract.
      Same rule as a draft that could not be tied to the record: not
      refunded, and the original survives untouched.
    */
    if (codeOnly) return { proposal: codeOnly, context };
    return {
      proposal: { ...original, note: "MIDO's adaptation did not hold the session's shape — it stands as drafted." },
      context,
    };
  }

  return {
    proposal: {
      title: (payload.title || original.title).slice(0, 120),
      // The place directives are the only ones that move the kind.
      kind: directive === "gym" ? "gym" : directive === "pitch" ? "individual" : original.kind,
      durationMin: adapted!.durationMin,
      // Preserved by construction — the model's echo is not trusted.
      objective: original.objective,
      blocks,
      source: "mido",
      note: null,
    },
    context,
  };
}
