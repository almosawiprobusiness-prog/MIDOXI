import "server-only";
import { generateJson, aiAvailable, aiStatus, modelFor } from "./anthropic";
import { BOARD_DRAFT, BOARD_EXPLAIN, BOARD_TO_DRILL } from "./prompts";
import { validateAi } from "./schemas";
import {
  AI_BOARD_JSON_SCHEMA,
  AI_DRILL_JSON_SCHEMA,
  AI_EXPLANATION_JSON_SCHEMA,
  aiBoardSchema,
  aiDrillSchema,
  aiExplanationSchema,
  documentFromAi,
  type AiDrillPayload,
  type AiExplanationPayload,
} from "./board-schema";
import { checkFeature } from "@/lib/billing/membership";
import { refusalReason } from "@/lib/billing/gate-copy";
import { consumeFeature, releaseFeature, logAiUsage } from "@/lib/billing/meter";
import { withinAiBudget } from "@/lib/billing/budget";
import { describeBoard } from "@/lib/tactics/describe";
import { countDocument, isDrawnOn } from "@/lib/tactics/document";
import {
  composeBoard,
  composeDrill,
  composeExplanation,
  type BoardExplanation,
  type BoardLike,
  type DraftedBoard,
  type DraftedDrill,
} from "@/lib/tactics/compose";
import type { RoleId } from "@/lib/roles/roles";

/*
  ============================================================
  BOARD ENGINE — MIDO as a first-class user of the board.
  ------------------------------------------------------------
  §7 of the brief asks for board "tools". This codebase has no
  agentic tool loop: `generateJson` is one metered,
  schema-constrained call, and every engine here is a named
  operation that gates, spends, falls back and refunds. So the
  tools are built in that shape rather than beside it —
  `explainBoard`, `draftBoard`, `boardToDrill` are the same kind
  of object as `draftSession`, and inherit the same properties:

    · entitlement + budget checked before a token is spent
    · a DETERMINISTIC path that works on the free tier
    · an honest note when the AI path was not taken
    · a refund when the failure was not the user's fault

  A model-driven loop would have discarded all four to gain
  nothing this feature needs.

  THE HONESTY RULE THAT MATTERS MOST HERE. A drawn board is a
  coach's work; a generated one is a draft. Everything produced
  here is stamped `origin.source = "mido"` by the caller and
  stays fully editable — §42 forbids a generated board that
  cannot be changed, and a board presented as the coach's own
  would be worse than either.
  ============================================================
*/

/*
  The deterministic path lives in `lib/tactics/compose.ts` — pure, and
  therefore testable without a server runtime, which is the same split
  `coach-compose` and `coach-engine` already use. Re-exported here so a
  caller has one import site for "MIDO and the board".
*/
export { composeBoard, composeDrill, composeExplanation };
export type { BoardExplanation, DraftedBoard, DraftedDrill };

// ── shared gating ────────────────────────────────────────────

type Gate = { ok: true } | { ok: false; reason: string };

async function gate(role: RoleId): Promise<Gate> {
  const entitlement = await checkFeature("ai_interactions");
  if (!entitlement.allowed) {
    return { ok: false, reason: refusalReason(entitlement, "ai_interactions", role) };
  }
  if (!aiAvailable()) {
    return {
      ok: false,
      reason:
        aiStatus().reason === "no_credits"
          ? "MIDO's writing model is unavailable right now."
          : "MIDO's writing model is disabled right now.",
    };
  }
  if (!(await withinAiBudget())) {
    return { ok: false, reason: "AI generation is paused this month." };
  }
  return { ok: true };
}

/** The board as the model reads it — one definition, used by all three. */
function boardContext(board: BoardLike) {
  return describeBoard({
    title: board.title,
    phase: board.phase,
    formation: board.formation,
    notes: board.notes,
    tags: board.tags,
    doc: board.doc,
  });
}

async function meter(
  name: string,
  started: number,
  res: { ok: boolean; usage?: { input: number; output: number; cacheRead: number; cacheWrite: number } },
) {
  await logAiUsage({
    feature: "ai_interactions",
    tier: "standard",
    model: modelFor("standard"),
    inputTokens: res.ok ? (res.usage?.input ?? 0) : 0,
    outputTokens: res.ok ? (res.usage?.output ?? 0) : 0,
    cacheReadTokens: res.ok ? (res.usage?.cacheRead ?? 0) : 0,
    cacheWriteTokens: res.ok ? (res.usage?.cacheWrite ?? 0) : 0,
    latencyMs: Date.now() - started,
    status: res.ok ? "ok" : "error",
  });
}

// ── 1. explain a board ───────────────────────────────────────

/**
 * Read a board and say what it is doing.
 *
 * `perspective` is what makes this useful in Player OS: the same board,
 * answered as "what is my job here as the number 9". The board does not
 * change; the reading does (§10).
 */
export async function explainBoard(
  board: BoardLike,
  opts: { role: RoleId; perspective?: string | null } = { role: "coach" },
): Promise<BoardExplanation> {
  const base = composeExplanation(board);

  if (!isDrawnOn(board.doc) && countDocument(board.doc).ours === 0) {
    return { ...base, note: "There is nothing on this board yet." };
  }

  const g = await gate(opts.role);
  if (!g.ok) return { ...base, note: g.reason };
  if (!(await consumeFeature("ai_interactions"))) return base;

  const started = Date.now();
  const res = await generateJson<AiExplanationPayload>({
    tier: BOARD_EXPLAIN.tier,
    system: BOARD_EXPLAIN.system,
    prompt: `${boardContext(board)}

${
  opts.perspective
    ? `Explain this board from the perspective of the ${opts.perspective}. Answer to that player, in the second person, about their job only.`
    : `Explain what this board is trying to accomplish, to a ${opts.role}.`
}`,
    schema: AI_EXPLANATION_JSON_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 1200,
    // The board changes every call; the persona does not. Cache the persona.
    cacheSystem: true,
  });
  await meter(BOARD_EXPLAIN.name, started, res);

  if (!res.ok) {
    // Model unreachable — not the user's fault, so the unit is refunded.
    await releaseFeature("ai_interactions");
    return { ...base, note: "MIDO could not read this board just now — this is what is on it." };
  }

  const payload = validateAi(aiExplanationSchema, res.data);
  if (!payload) {
    await releaseFeature("ai_interactions");
    return { ...base, note: "MIDO's reading came back malformed — this is what is on it." };
  }

  return {
    headline: payload.headline,
    points: payload.points,
    watchFor: payload.watchFor ?? [],
    composed: false,
    note: null,
  };
}

// ── 2. draw a board ──────────────────────────────────────────

export async function draftBoard(
  request: string,
  opts: { role: RoleId; formation?: string; context?: string | null } = { role: "coach" },
): Promise<DraftedBoard> {
  const base = composeBoard({ title: request, formation: opts.formation });

  const g = await gate(opts.role);
  if (!g.ok) {
    return { ...base, note: `${g.reason} This is the starting shape — draw the idea on it.` };
  }
  if (!(await consumeFeature("ai_interactions"))) return base;

  const started = Date.now();
  const res = await generateJson({
    tier: BOARD_DRAFT.tier,
    system: BOARD_DRAFT.system,
    prompt: `Draw a tactical board for this request:

"${request}"
${opts.formation ? `\nStart from a ${opts.formation}.` : ""}${opts.context ? `\n\nCONTEXT FROM THE USER'S RECORD:\n${opts.context}` : ""}

Draw only what teaches the idea.`,
    schema: AI_BOARD_JSON_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 4000,
    cacheSystem: true,
  });
  await meter(BOARD_DRAFT.name, started, res);

  if (!res.ok) {
    await releaseFeature("ai_interactions");
    return {
      ...base,
      note: "MIDO could not draw this just now — this is the starting shape instead.",
    };
  }

  const payload = validateAi(aiBoardSchema, res.data);
  if (!payload) {
    await releaseFeature("ai_interactions");
    return { ...base, note: "MIDO's board came back malformed — this is the starting shape instead." };
  }

  const doc = documentFromAi(payload);

  /*
    A board with nobody on it is not a board. The model ran and answered,
    so this is not refunded — the same rule `draftSession` applies to a
    draft that could not be tied to the record — but it is not shown as a
    result either.
  */
  if (countDocument(doc).ours === 0) {
    return { ...base, note: "MIDO's board came back empty — this is the starting shape instead." };
  }

  return {
    title: payload.title,
    objective: payload.objective,
    phase: payload.phase,
    formation: payload.formation || base.formation,
    tags: payload.tags ?? [],
    doc,
    composed: false,
    note: null,
  };
}

// ── 3. turn a board into a drill ─────────────────────────────

export async function boardToDrill(
  board: BoardLike,
  opts: { role: RoleId; adaptation?: string | null } = { role: "coach" },
): Promise<DraftedDrill> {
  const base = composeDrill(board);

  const g = await gate(opts.role);
  if (!g.ok) return { ...base, note: g.reason };
  if (!(await consumeFeature("ai_interactions"))) return base;

  const started = Date.now();
  const res = await generateJson<AiDrillPayload>({
    tier: BOARD_TO_DRILL.tier,
    system: BOARD_TO_DRILL.system,
    prompt: `${boardContext(board)}

Turn this board into one training block.${
      opts.adaptation ? `\n\nAdapt it: ${opts.adaptation}` : ""
    }`,
    schema: AI_DRILL_JSON_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 1500,
    cacheSystem: true,
  });
  await meter(BOARD_TO_DRILL.name, started, res);

  if (!res.ok) {
    await releaseFeature("ai_interactions");
    return { ...base, note: "MIDO could not write the drill just now — this is the setup as drawn." };
  }

  const payload = validateAi(aiDrillSchema, res.data);
  if (!payload) {
    await releaseFeature("ai_interactions");
    return { ...base, note: "MIDO's drill came back malformed — this is the setup as drawn." };
  }

  return {
    name: payload.name,
    phase: payload.phase,
    durationMin: payload.durationMin,
    organisation: payload.organisation,
    coachingPoints: payload.coachingPoints,
    progression: payload.progression ?? "",
    regression: payload.regression ?? "",
    composed: false,
    note: null,
  };
}
