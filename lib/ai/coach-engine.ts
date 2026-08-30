import "server-only";
import { generateJson, aiAvailable, aiStatus, modelFor } from "./anthropic";
import { checkFeature } from "@/lib/billing/membership";
import { refusalReason } from "@/lib/billing/gate-copy";
import { consumeFeature, logAiUsage } from "@/lib/billing/meter";
import { withinAiBudget } from "@/lib/billing/budget";
import { roleDef } from "@/lib/roles/roles";
import type {
  SessionBlockInput,
  SessionPhase,
  OppositionReport,
  MatchPlan,
} from "@/lib/data/coach-types";
import { observationCount } from "@/lib/data/coach-types";
import {
  composeSession,
  composeMatchPlan,
  matchConcepts,
  observations,
  type SessionContext,
  type DraftedSession,
} from "@/lib/data/coach-compose";

export { composeSession, composeMatchPlan };
export type { SessionContext, DraftedSession };

/*
  ============================================================
  COACH ENGINE
  ------------------------------------------------------------
  Two jobs, both bound by the same rule: the coach stays in
  control, and MIDO never invents football that was not either
  recorded by the coach or held in the curated knowledge graph.

  1. draftSession()   — turns an objective into a structured
     session. The deterministic path builds it from the concept
     graph (real curated coaching material); the metered Claude
     path writes a sharper, context-aware version.

  2. draftMatchPlan() — turns an opposition report into a match
     plan. It reads ONLY what the coach recorded. With nothing
     recorded it refuses rather than inventing a scouting report.
  ============================================================
*/

// ── shared gating ────────────────────────────────────────────

export type AiGate =
  | { ok: true }
  | { ok: false; reason: string };

async function gate(feature: "ai_interactions" | "deep_analyses"): Promise<AiGate> {
  const entitlement = await checkFeature(feature);
  if (!entitlement.allowed) {
    return {
      ok: false,
      reason: refusalReason(entitlement, "ai_interactions", "coach"),
    };
  }
  if (!aiAvailable()) {
    return {
      ok: false,
      reason:
        aiStatus().reason === "no_credits"
          ? "MIDO's writing model is unavailable right now — this is the library version."
          : "MIDO's writing model is disabled — this is the library version.",
    };
  }
  if (!(await withinAiBudget())) {
    return { ok: false, reason: "AI generation is paused this month — this is the library version." };
  }
  return { ok: true };
}

// ── 1. session drafting ──────────────────────────────────────

const SESSION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    objective: { type: "string" },
    blocks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          phase: {
            type: "string",
            enum: [
              "warmup",
              "technical",
              "tactical",
              "possession",
              "conditioned-game",
              "match-scenario",
              "set-piece",
              "cooldown",
            ],
          },
          name: { type: "string" },
          durationMin: { type: "number" },
          organisation: { type: "string" },
          coachingPoints: { type: "array", items: { type: "string" } },
          progression: { type: "string" },
          regression: { type: "string" },
        },
        required: ["phase", "name", "durationMin", "organisation", "coachingPoints"],
      },
    },
  },
  required: ["title", "objective", "blocks"],
} as const;

/** The metered draft. Falls back to `composeSession` with an honest note. */
export async function draftSession(ctx: SessionContext): Promise<DraftedSession> {
  const base = composeSession(ctx);

  const g = await gate("ai_interactions");
  if (!g.ok) return { ...base, note: g.reason };
  if (!(await consumeFeature("ai_interactions"))) return base;

  const started = Date.now();
  const concepts = matchConcepts(ctx.objective, 4);

  const res = await generateJson<{
    title: string;
    objective: string;
    blocks: SessionBlockInput[];
  }>({
    tier: "standard",
    system: `${roleDef("coach").aiPersona}

You are drafting one training session for this coach to deliver.

RULES:
- Work only from the objective, the context and the curated concepts you are given.
- Structure the session as a coaching arc: warm-up, then progressively more game-like.
- Every block needs a real organisation: area size, player numbers, rules, service.
- Coaching points are short imperatives a coach can shout, not paragraphs.
- Durations must sum to roughly the session length given.
- No invented statistics, no references to specific real matches or players.
- The coach remains in control: this is a draft they will edit.
- If the club's written methodology is provided, the session must answer to it. Those principles outrank generic best practice; reference them in the coaching points.`,
    prompt: JSON.stringify({
      objective: ctx.objective,
      durationMin: ctx.durationMin,
      playersCount: ctx.playersCount,
      pitch: ctx.pitch,
      squadDevelopmentFocus: ctx.squadFocus,
      clubMethodology: ctx.methodology ?? [],
      curatedConcepts: concepts.map((c) => ({
        name: c.name,
        definition: c.definition,
        why: c.why,
        cues: c.cues,
        trains: c.trains,
      })),
    }),
    schema: SESSION_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 2200,
  });

  await logAiUsage({
    feature: "ai_interactions",
    tier: "standard",
    model: modelFor("standard"),
    inputTokens: res.ok ? res.usage.input : 0,
    outputTokens: res.ok ? res.usage.output : 0,
    cacheReadTokens: res.ok ? res.usage.cacheRead : 0,
    cacheWriteTokens: res.ok ? res.usage.cacheWrite : 0,
    latencyMs: Date.now() - started,
    status: res.ok ? "ok" : "error",
  });

  if (!res.ok || !res.data.blocks?.length) {
    return { ...base, note: "MIDO could not draft this session — the library version is shown instead." };
  }

  const blocks: SessionBlockInput[] = res.data.blocks.slice(0, 8).map((b) => ({
    phase: (b.phase as SessionPhase) ?? "technical",
    name: b.name?.slice(0, 120) ?? "Block",
    durationMin: Math.min(45, Math.max(3, Math.round(Number(b.durationMin) || 10))),
    organisation: b.organisation ?? "",
    coachingPoints: (b.coachingPoints ?? []).slice(0, 5),
    progression: b.progression ?? "",
    regression: b.regression ?? "",
  }));

  return {
    title: res.data.title?.slice(0, 120) || base.title,
    objective: res.data.objective || ctx.objective,
    blocks,
    source: "mido",
    note: null,
    methodologyApplied: (ctx.methodology ?? []).length,
  };
}

// ── 2. match plan drafting ───────────────────────────────────

export type MatchPlanResult =
  | { ok: true; plan: MatchPlan; source: "mido" | "library"; note: string | null }
  | { ok: false; error: string };

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          points: { type: "array", items: { type: "string" } },
        },
        required: ["title", "points"],
      },
    },
  },
  required: ["headline", "sections"],
} as const;

/**
 * The metered match plan. Refuses outright when nothing has been recorded —
 * a scouting report MIDO invented would be worse than no plan at all.
 */
export async function draftMatchPlan(r: OppositionReport): Promise<MatchPlanResult> {
  if (observationCount(r) === 0) {
    return {
      ok: false,
      error:
        "Nothing has been recorded about this opponent yet. MIDO will not invent a scouting report — add what you have seen, then build the plan.",
    };
  }

  const base = composeMatchPlan(r);

  const g = await gate("ai_interactions");
  if (!g.ok) return { ok: true, plan: base, source: "library", note: g.reason };
  if (!(await consumeFeature("ai_interactions"))) {
    return { ok: true, plan: base, source: "library", note: null };
  }

  const started = Date.now();
  const res = await generateJson<{ headline: string; sections: MatchPlan["sections"] }>({
    tier: "standard",
    system: `${roleDef("coach").aiPersona}

You are turning a coach's own scouting notes into a match plan.

RULES — these are absolute:
- Use ONLY the observations provided. Every point must trace back to one of them.
- If the notes do not cover a moment of the game, leave that moment out. Do not fill gaps.
- Never state statistics, results, or anything about players not named in the notes.
- Write instructions a team can act on: who does what, where, and when.
- Sections should follow the moments of a match (without the ball, with the ball, transition, set pieces, individuals) — but only those the notes support.`,
    prompt: JSON.stringify({
      opponent: r.opponent,
      formation: r.formation || "unknown",
      venue: r.home === null ? "unknown" : r.home ? "home" : "away",
      observations: observations(r),
      coachNotes: r.notes || null,
    }),
    schema: PLAN_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 1600,
  });

  await logAiUsage({
    feature: "ai_interactions",
    tier: "standard",
    model: modelFor("standard"),
    inputTokens: res.ok ? res.usage.input : 0,
    outputTokens: res.ok ? res.usage.output : 0,
    cacheReadTokens: res.ok ? res.usage.cacheRead : 0,
    cacheWriteTokens: res.ok ? res.usage.cacheWrite : 0,
    latencyMs: Date.now() - started,
    status: res.ok ? "ok" : "error",
  });

  if (!res.ok || !res.data.sections?.length) {
    return {
      ok: true,
      plan: base,
      source: "library",
      note: "MIDO could not draft the plan just now — this version is your own observations, restructured.",
    };
  }

  return {
    ok: true,
    plan: {
      headline: res.data.headline || base.headline,
      sections: res.data.sections.slice(0, 6).map((s) => ({
        title: s.title,
        points: (s.points ?? []).slice(0, 6),
      })),
      basedOn: base.basedOn,
      generatedAt: new Date().toISOString(),
    },
    source: "mido",
    note: null,
  };
}
