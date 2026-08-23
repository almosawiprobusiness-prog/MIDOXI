import "server-only";
import { generateJson, aiAvailable, aiStatus } from "./anthropic";
import { checkFeature } from "@/lib/billing/membership";
import { refusalReason } from "@/lib/billing/gate-copy";
import { listMemory } from "@/lib/data/memory";
import { memoryPromptBlock } from "@/lib/data/memory-types";
import { consumeFeature, logAiUsage } from "@/lib/billing/meter";
import { withinAiBudget } from "@/lib/billing/budget";
import { concept, conceptsBySlugs } from "@/lib/knowledge/concepts";
import { person } from "@/lib/knowledge/people";
import { relevantConcepts } from "@/lib/knowledge/graph";
import { positionGroup, POSITION_GROUP_LABEL } from "@/lib/knowledge/types";
import { roleDef } from "@/lib/roles/roles";
import type { FootballConcept, FootballPerson } from "@/lib/knowledge/types";
import type {
  ApplyPlan,
  MatchStudy,
  QuizQuestion,
  RenderedModule,
  StudyPoint,
  StudyView,
  StudyViewer,
  TrainingPlan,
} from "@/lib/knowledge/study-types";
import type { DevelopmentCategory } from "@/lib/types";

/*
  ============================================================
  THE STUDY ENGINE
  ------------------------------------------------------------
  Study -> Understand -> Train -> Apply -> Review.

  Composition happens in two layers:

  1. compose()  — deterministic, free, always available. Curated
     module bodies where they exist; otherwise modules built from
     the knowledge graph (real curated concept material, never
     invented claims about the person). This is what every user
     gets, including offline from Claude.

  2. enhance()  — the metered Claude pass. It personalises the
     study to the reader's role, position and development goals,
     and writes the modules that have no curated body. It is
     gated on membership, quota and the global budget, and it
     never runs on a page render.

  Provenance discipline: `verified` is only ever attached to the
  curated fact list. Anything a model writes is `analysis`, and
  the UI says so.
  ============================================================
*/

const AREA_TO_CATEGORY: Record<string, DevelopmentCategory> = {
  technical: "technical",
  tactical: "tactical",
  physical: "physical",
  mental: "mental",
};

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── layer 1: deterministic composition ───────────────────────

function moduleFromConcepts(
  key: string,
  title: string,
  brief: string,
  concepts: FootballConcept[],
  subject: FootballPerson,
): RenderedModule {
  const points: StudyPoint[] = concepts.slice(0, 4).map((c) => ({
    title: c.name,
    body: `${c.definition} ${c.why} On film it shows up as: ${c.looksLike[0].toLowerCase()}.`,
  }));

  return {
    key,
    title,
    provenance: "analysis",
    source: "graph",
    summary: `${brief} This module is built from the concepts ${subject.name}'s game is organised around, so you are learning football principles through a player who demonstrates them — not collecting facts about a career.`,
    points,
    watchFor: concepts.slice(0, 3).flatMap((c) => c.looksLike.slice(0, 1)),
    concepts: concepts.map((c) => c.slug),
  };
}

function composeModules(subject: FootballPerson): RenderedModule[] {
  return subject.modules.map((spec) => {
    const curated = subject.curated?.[spec.key];
    const concepts = conceptsBySlugs(spec.concepts);
    if (curated) {
      return {
        key: spec.key,
        title: spec.title,
        provenance: curated.provenance,
        source: "curated",
        summary: curated.summary,
        points: curated.points,
        watchFor: curated.watchFor,
        concepts: spec.concepts,
      };
    }
    return moduleFromConcepts(spec.key, spec.title, spec.brief, concepts, subject);
  });
}

function composeMatchStudy(subject: FootballPerson, concepts: FootballConcept[]): MatchStudy {
  const lead = concepts[0];
  const instruction = lead
    ? `For the next ten minutes of footage, ignore the ball. Watch only ${subject.name} and one thing: ${lead.name.toLowerCase()}. Note every time it happens, and what the nearest defender did in response.`
    : `For the next ten minutes of footage, ignore the ball. Watch only ${subject.name}, and note what they do when they are not involved in play.`;
  return {
    instruction,
    watch: concepts.slice(0, 4).flatMap((c) => c.looksLike.slice(0, 2)),
    source: "graph",
  };
}

function composeTraining(subject: FootballPerson, concepts: FootballConcept[], viewer: StudyViewer): TrainingPlan {
  const lead = concepts[0];
  const blocks = concepts.slice(0, 4).map((c, i) => ({
    name: `${i + 1}. ${c.name}`,
    detail: c.trains[0] ?? c.looksLike[0],
    work: i === 0 ? "3 x 6 reps · 60s rest" : i === 3 ? "8 minutes, free play" : "4 x 4 reps · 45s rest",
  }));
  blocks.push({
    name: `${blocks.length + 1}. Transfer`,
    detail: `Finish with a small-sided game where the action only counts when it starts with ${
      lead ? lead.name.toLowerCase() : "the principle you have just trained"
    }.`,
    work: "12 minutes",
  });

  return {
    title: `${subject.name} session — ${lead ? lead.name.toLowerCase() : "principles"}`,
    kind: lead?.area === "physical" ? "speed" : lead?.area === "tactical" ? "tactical" : "technical",
    durationMin: 45,
    objective: `Turn the ${subject.name} study into repetitions a ${viewer.lensLabel.toLowerCase()} can use in the next session.`,
    blocks,
    source: "graph",
  };
}

function composeApply(subject: FootballPerson, concepts: FootballConcept[], viewer: StudyViewer): ApplyPlan {
  const lead = concepts[0];
  const points: StudyPoint[] = concepts.slice(0, 3).map((c) => ({
    title: c.name,
    body: `As a ${viewer.lensLabel.toLowerCase()}, the transferable part is the cue, not the highlight: "${
      c.cues[0]
    }". Take it into your next session and judge yourself on whether you did it, not on whether it worked.`,
  }));

  const goalTitle = lead ? sentenceCase(lead.name) : `${subject.name} principles`;
  return {
    summary: `You are not trying to become ${subject.name}. You are taking the parts of their game that answer a question your own game is asking${
      viewer.goals.length ? `, starting with ${viewer.goals[0].toLowerCase()}` : ""
    }.`,
    points,
    goal: {
      title: goalTitle,
      category: lead ? AREA_TO_CATEGORY[lead.area] ?? "tactical" : "tactical",
      why: lead
        ? `From the ${subject.name} study: ${lead.why}`
        : `From the ${subject.name} study.`,
    },
    source: "graph",
  };
}

/** Deterministic multiple choice built from curated concept definitions. */
function composeQuiz(concepts: FootballConcept[], pool: FootballConcept[]): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  for (const c of concepts.slice(0, 4)) {
    const distractors = pool
      .filter((p) => p.slug !== c.slug)
      .slice(0, 12)
      .filter((_, i) => i % 3 === 0)
      .slice(0, 3);
    if (distractors.length < 3) continue;
    const options = [c.definition, ...distractors.map((d) => d.definition)];
    // Rotate the answer position deterministically so it is not always first.
    const shift = questions.length % options.length;
    const rotated = [...options.slice(shift), ...options.slice(0, shift)];
    questions.push({
      q: `Which of these describes ${c.name.toLowerCase()}?`,
      options: rotated,
      answer: rotated.indexOf(c.definition),
      why: c.why,
    });
  }
  return questions;
}

export function composeStudy(subject: FootballPerson, viewer: StudyViewer): StudyView {
  const concepts = relevantConcepts(subject, viewer.positionGroup);
  const pool = subject.embodies
    .map((s) => concept(s))
    .filter((c): c is FootballConcept => Boolean(c))
    .concat(concepts);

  return {
    subject: {
      slug: subject.slug,
      name: subject.name,
      kind: subject.kind,
      descriptor: subject.descriptor,
      premise: subject.premise,
      verified: subject.verified,
    },
    viewer,
    modules: composeModules(subject),
    matchStudy: composeMatchStudy(subject, concepts),
    training: composeTraining(subject, concepts, viewer),
    apply: composeApply(subject, concepts, viewer),
    quiz: composeQuiz(concepts, pool),
    concepts,
    enhanced: false,
    aiNote: null,
  };
}

// ── layer 2: the metered Claude pass ─────────────────────────

interface EnhancePayload {
  modules: { key: string; summary: string; points: { title: string; body: string }[]; watchFor: string[] }[];
  matchStudy: { instruction: string; watch: string[] };
  training: { title: string; objective: string; durationMin: number; blocks: { name: string; detail: string; work: string }[] };
  apply: { summary: string; points: { title: string; body: string }[]; goalTitle: string; goalWhy: string };
}

const ENHANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    modules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string" },
          summary: { type: "string" },
          points: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { title: { type: "string" }, body: { type: "string" } },
              required: ["title", "body"],
            },
          },
          watchFor: { type: "array", items: { type: "string" } },
        },
        required: ["key", "summary", "points"],
      },
    },
    matchStudy: {
      type: "object",
      additionalProperties: false,
      properties: { instruction: { type: "string" }, watch: { type: "array", items: { type: "string" } } },
      required: ["instruction", "watch"],
    },
    training: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        objective: { type: "string" },
        durationMin: { type: "number" },
        blocks: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { name: { type: "string" }, detail: { type: "string" }, work: { type: "string" } },
            required: ["name", "detail", "work"],
          },
        },
      },
      required: ["title", "objective", "durationMin", "blocks"],
    },
    apply: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        points: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { title: { type: "string" }, body: { type: "string" } },
            required: ["title", "body"],
          },
        },
        goalTitle: { type: "string" },
        goalWhy: { type: "string" },
      },
      required: ["summary", "points", "goalTitle", "goalWhy"],
    },
  },
  required: ["modules", "matchStudy", "training", "apply"],
} as const;

const SYSTEM = `You are MIDO, the football intelligence inside MIDO XI.

You are writing a personalised study of a football person for one specific reader.

HARD RULES — these are not style preferences:
- NEVER state statistics, match results, transfer fees, dates or records. The product shows verified facts from its own curated catalogue; your job is football interpretation only.
- NEVER invent events, quotes or specific incidents from matches.
- Write about PRINCIPLES the subject demonstrates, and how the reader can use them.
- Everything you write is labelled "MIDO analysis" in the interface. Write as a serious coach would: concrete, specific, no motivational filler, no hype adjectives.
- Address the reader in the second person. Connect every module back to their position and their development priorities.
- Each point body: 2-3 sentences. Each summary: 2-3 sentences.

You will be given the concepts this study is built on, with definitions. Stay inside them.`;

export interface EnhanceResult {
  view: StudyView;
  enhanced: boolean;
  note: string | null;
}

/**
 * Personalise a composed study with Claude. Gated on Pro entitlement, remaining
 * quota, Claude reachability and the global monthly budget. On any failure the
 * composed study is returned untouched, with an honest note.
 */
export async function enhanceStudy(base: StudyView, subjectSlug: string): Promise<EnhanceResult> {
  const subject = person(subjectSlug);
  if (!subject) return { view: base, enhanced: false, note: null };

  const gate = await checkFeature("study_discoveries");
  if (!gate.allowed) {
    return {
      view: base,
      enhanced: false,
      note: refusalReason(gate, "study_discoveries", "player"),
    };
  }

  if (!aiAvailable()) {
    const reason = aiStatus().reason;
    return {
      view: base,
      enhanced: false,
      note:
        reason === "no_credits"
          ? "MIDO's writing model is unavailable right now. This is the curated study."
          : "MIDO's writing model is disabled. This is the curated study.",
    };
  }
  if (!(await withinAiBudget())) {
    return { view: base, enhanced: false, note: "AI generation is paused this month. This is the curated study." };
  }

  // Only generate the modules that have no curated body — never overwrite
  // hand-authored material.
  const toGenerate = base.modules.filter((m) => m.source !== "curated");
  const started = Date.now();

  const consumed = await consumeFeature("study_discoveries");
  if (!consumed) return { view: base, enhanced: false, note: null };

  // Standing facts about this player, in the cached system block. A study
  // that recommends a drill they have already told MIDO did not work is worse
  // than a generic one.
  const memory = memoryPromptBlock(await listMemory());

  const res = await generateJson<EnhancePayload>({
    tier: "standard",
    system: memory ? `${SYSTEM}

${memory}` : SYSTEM,
    prompt: JSON.stringify({
      subject: {
        name: subject.name,
        kind: subject.kind,
        descriptor: subject.descriptor,
        premise: subject.premise,
      },
      reader: {
        role: base.viewer.role,
        rolePersona: roleDef(base.viewer.role).aiPersona,
        position: base.viewer.position || base.viewer.positionLabel,
        developmentGoals: base.viewer.goals,
      },
      conceptsInPlay: base.concepts.map((c) => ({
        name: c.name,
        area: c.area,
        definition: c.definition,
        why: c.why,
        cues: c.cues,
        trains: c.trains,
      })),
      modulesToWrite: toGenerate.map((m) => ({
        key: m.key,
        title: m.title,
        concepts: m.concepts.map((s) => concept(s)?.name).filter(Boolean),
      })),
      alsoWrite: {
        matchStudy: "One instruction that makes the reader watch football differently for ten minutes, plus 4 specific things to look for.",
        training: "A session that turns this study into repetitions: title, objective, duration in minutes, and 4-6 blocks with a work prescription.",
        apply: "How THIS reader, in their position and with their goals, uses this. Plus one development goal title and the reason for it.",
      },
    }),
    schema: ENHANCE_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 3000,
  });

  await logAiUsage({
    feature: "study_discoveries",
    tier: "standard",
    inputTokens: res.ok ? res.usage.input : 0,
    outputTokens: res.ok ? res.usage.output : 0,
    cacheReadTokens: res.ok ? res.usage.cacheRead : 0,
    cacheWriteTokens: res.ok ? res.usage.cacheWrite : 0,
    latencyMs: Date.now() - started,
    status: res.ok ? "ok" : "error",
  });

  if (!res.ok) {
    return {
      view: base,
      enhanced: false,
      note: "MIDO could not personalise this study just now — the curated study is shown instead.",
    };
  }

  const data = res.data;
  const byKey = new Map((data.modules ?? []).map((m) => [m.key, m]));

  const modules: RenderedModule[] = base.modules.map((m) => {
    if (m.source === "curated") return m;
    const gen = byKey.get(m.key);
    if (!gen || !gen.points?.length) return m;
    return {
      ...m,
      source: "ai",
      provenance: "analysis",
      summary: gen.summary || m.summary,
      points: gen.points.slice(0, 5),
      watchFor: gen.watchFor?.length ? gen.watchFor.slice(0, 4) : m.watchFor,
    };
  });

  const view: StudyView = {
    ...base,
    modules,
    matchStudy: data.matchStudy?.instruction
      ? { instruction: data.matchStudy.instruction, watch: (data.matchStudy.watch ?? []).slice(0, 6), source: "ai" }
      : base.matchStudy,
    training: data.training?.blocks?.length
      ? {
          ...base.training,
          title: data.training.title || base.training.title,
          objective: data.training.objective || base.training.objective,
          durationMin: Math.min(120, Math.max(15, Math.round(data.training.durationMin || base.training.durationMin))),
          blocks: data.training.blocks.slice(0, 7),
          source: "ai",
        }
      : base.training,
    apply: data.apply?.points?.length
      ? {
          summary: data.apply.summary || base.apply.summary,
          points: data.apply.points.slice(0, 4),
          goal: {
            title: data.apply.goalTitle || base.apply.goal.title,
            category: base.apply.goal.category,
            why: data.apply.goalWhy || base.apply.goal.why,
          },
          source: "ai",
        }
      : base.apply,
    enhanced: true,
    aiNote: null,
  };

  return { view, enhanced: true, note: null };
}

/** Builds the viewer context a study is written for. */
const LENS_LABEL: Record<string, string> = {
  coach: "Coach",
  trainer: "Performance trainer",
  club: "Club",
};

export function makeViewer(input: {
  role: StudyViewer["role"];
  position: string;
  goals: string[];
}): StudyViewer {
  const group = positionGroup(input.position);
  const positionLabel = POSITION_GROUP_LABEL[group];
  return {
    role: input.role,
    position: input.position,
    positionGroup: group,
    positionLabel,
    lensLabel: LENS_LABEL[input.role] ?? positionLabel,
    goals: input.goals.slice(0, 5),
  };
}
