import "server-only";
import { generateJson, aiAvailable, aiStatus, modelFor } from "./anthropic";
import { checkFeature } from "@/lib/billing/membership";
import { refusalReason } from "@/lib/billing/gate-copy";
import { consumeFeature, logAiUsage } from "@/lib/billing/meter";
import { withinAiBudget } from "@/lib/billing/budget";
import { matchQualities, test as testMeta } from "@/lib/knowledge/physical";
import { roleDef } from "@/lib/roles/roles";
import { composeProgram, type ComposedProgram, type ProgramContext } from "@/lib/data/trainer-compose";
import type { ExerciseSlot, SessionIntent, Assessment } from "@/lib/data/trainer-types";

/*
  ============================================================
  TRAINER ENGINE
  ------------------------------------------------------------
  Turns an objective into a multi-week block.

  The deterministic path (lib/data/trainer-compose.ts) always
  runs first, so a trainer with no Pro plan and no Claude still
  gets a real, waved, criteria-driven program built from the
  curated physical library.

  The metered path rewrites it with the athlete's own context:
  their objective, their limitations, and the test numbers the
  trainer has actually recorded. It is forbidden from inventing
  numbers — no target times, no normative claims, no "elite is
  X" — because those would be fabrication dressed as coaching.
  ============================================================
*/

export interface AthleteContext {
  name: string;
  position: string;
  objective: string;
  limitations: string;
  /** Only what the trainer has actually recorded. */
  assessments: Assessment[];
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    sessions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          week: { type: "number" },
          day: { type: "number" },
          title: { type: "string" },
          focus: { type: "string" },
          intent: { type: "string", enum: ["build", "hold", "deload", "test"] },
          exercises: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                prescription: { type: "string" },
                cue: { type: "string" },
                slot: {
                  type: "string",
                  enum: ["prep", "primary", "secondary", "accessory", "conditioning", "recovery"],
                },
              },
              required: ["name", "prescription", "slot"],
            },
          },
        },
        required: ["week", "day", "title", "intent", "exercises"],
      },
    },
  },
  required: ["sessions"],
} as const;

const SYSTEM = `${roleDef("trainer").aiPersona}

You are writing one multi-week training block for one athlete.

HARD RULES — these are not style preferences:
- NEVER invent test results, target times, normative standards or percentile claims. You are given the numbers the trainer actually recorded; if a number is not there, program without it and say what would need testing.
- Respect the recorded limitations absolutely. If a limitation rules an exercise out, do not program it.
- Every session needs real prescriptions: sets, reps, load or distance, and rest.
- Wave the block: build weeks, a deload roughly every fourth week, and a retest at the end. A block with no deload and no retest is a list, not a program.
- Cues are short and shoutable, not paragraphs.
- Tie the physical work back to the athlete's football objective — that is why they are in the gym.`;

/**
 * The metered draft. Always returns a usable block: on any gate failure or
 * model error it returns the deterministic composition with an honest note.
 */
export async function draftProgram(
  ctx: ProgramContext,
  athlete: AthleteContext | null,
): Promise<ComposedProgram> {
  const base = composeProgram(ctx);

  const entitlement = await checkFeature("ai_interactions");
  if (!entitlement.allowed) {
    return {
      ...base,
      note: refusalReason(entitlement, "ai_interactions", "trainer"),
    };
  }
  if (!aiAvailable()) {
    return {
      ...base,
      note:
        aiStatus().reason === "no_credits"
          ? "MIDO's writing model is unavailable right now — this is the library block."
          : "MIDO's writing model is disabled — this is the library block.",
    };
  }
  if (!(await withinAiBudget())) {
    return { ...base, note: "AI generation is paused this month — this is the library block." };
  }
  if (!(await consumeFeature("ai_interactions"))) return base;

  const started = Date.now();
  const qualities = matchQualities(ctx.objective, 3);

  const res = await generateJson<{
    sessions: {
      week: number;
      day: number;
      title: string;
      focus?: string;
      intent: SessionIntent;
      exercises: { name: string; prescription: string; cue?: string; slot: ExerciseSlot }[];
    }[];
  }>({
    tier: "standard",
    system: SYSTEM,
    prompt: JSON.stringify({
      objective: ctx.objective,
      weeks: ctx.weeks,
      sessionsPerWeek: ctx.sessionsPerWeek,
      athlete: athlete
        ? {
            position: athlete.position || ctx.position,
            footballObjective: athlete.objective,
            limitations: athlete.limitations || ctx.limitations,
            recordedAssessments: athlete.assessments.slice(0, 20).map((a) => ({
              test: testMeta(a.test)?.label ?? a.test,
              value: a.value,
              unit: a.unit,
              testedOn: a.testedOn,
            })),
          }
        : { position: ctx.position, limitations: ctx.limitations, recordedAssessments: [] },
      curatedLibrary: qualities.map((q) => ({
        quality: q.name,
        why: q.why,
        exercises: q.exercises,
        progression: q.progression,
        regression: q.regression,
        weeklyDose: q.weeklyDose,
      })),
    }),
    schema: SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 4000,
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

  if (!res.ok || !res.data.sessions?.length) {
    return { ...base, note: "MIDO could not draft this block — the library version is shown instead." };
  }

  const sessions = res.data.sessions
    .slice(0, ctx.weeks * ctx.sessionsPerWeek)
    .filter((s) => Array.isArray(s.exercises) && s.exercises.length > 0)
    .map((s) => ({
      week: Math.min(ctx.weeks, Math.max(1, Math.round(s.week))),
      day: Math.min(ctx.sessionsPerWeek, Math.max(1, Math.round(s.day))),
      title: (s.title ?? "Session").slice(0, 120),
      focus: (s.focus ?? "").slice(0, 300),
      intent: s.intent ?? "build",
      exercises: s.exercises.slice(0, 8).map((e) => ({
        name: (e.name ?? "").slice(0, 120),
        prescription: (e.prescription ?? "").slice(0, 160),
        cue: (e.cue ?? "").slice(0, 160),
        slot: e.slot ?? "primary",
      })),
    }));

  if (!sessions.length) {
    return { ...base, note: "MIDO returned an empty block — the library version is shown instead." };
  }

  return {
    qualities: base.qualities,
    sessions,
    source: "mido",
    note: null,
  };
}
