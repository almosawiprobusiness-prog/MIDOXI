import type { DevelopmentCategory, DevelopmentGoal } from "@/lib/types";

export type EvidenceKind = "match" | "film" | "insight" | "training" | "coach";

export interface GoalInput {
  category: DevelopmentCategory;
  title: string;
  why?: string;
  status: DevelopmentGoal["status"];
  progress: number;
}

export interface EvidenceInput {
  kind: EvidenceKind;
  note: string;
  /** Curated concept slug this evidence is an example of, when the player said so. */
  concept?: string | null;
  /** Second in the source footage, when the evidence points at film. */
  atSeconds?: number | null;
  /** The row this evidence was filed from (analysis, capture), for filed-state checks. */
  refId?: string | null;
  /** 'self' = the player noticed it; 'mido' = MIDO proposed, player accepted. */
  source?: "self" | "mido" | null;
}

export interface EvidenceEntry {
  id: string;
  goalId: string;
  kind: EvidenceKind;
  note: string;
  createdAt: string;
  concept?: string | null;
  refId?: string | null;
}

/**
 * A concept that keeps appearing in the evidence record.
 *
 * The arithmetic behind "the fourth time this shows up": counted from
 * filed rows, never generated — a thread of two is a pattern the player
 * confirmed twice, which is why the grouping lives here under test
 * rather than in a prompt.
 */
export interface ConceptThread {
  concept: string;
  count: number;
  /** Goals this concept's evidence is filed under, most recent first. */
  goalIds: string[];
  lastAt: string;
}

export function groupConceptThreads(
  rows: { concept?: string | null; goalId: string; createdAt: string }[],
  minCount = 2,
): ConceptThread[] {
  const byConcept = new Map<string, { count: number; goals: { goalId: string; at: string }[]; lastAt: string }>();
  for (const r of rows) {
    if (!r.concept) continue;
    const t = byConcept.get(r.concept) ?? { count: 0, goals: [], lastAt: r.createdAt };
    t.count += 1;
    t.goals.push({ goalId: r.goalId, at: r.createdAt });
    if (r.createdAt > t.lastAt) t.lastAt = r.createdAt;
    byConcept.set(r.concept, t);
  }
  return [...byConcept.entries()]
    .filter(([, t]) => t.count >= minCount)
    .map(([concept, t]) => ({
      concept,
      count: t.count,
      goalIds: [...new Set(t.goals.sort((a, b) => b.at.localeCompare(a.at)).map((g) => g.goalId))],
      lastAt: t.lastAt,
    }))
    .sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt));
}

export interface GoalDetail {
  goal: DevelopmentGoal;
  evidence: EvidenceEntry[];
}

/** The four stages of the development loop, in order. */
export const LOOP_STAGES: { kind: EvidenceKind; label: string; verb: string }[] = [
  { kind: "match", label: "Match", verb: "It showed up in a match" },
  { kind: "film", label: "Film", verb: "I found it on film" },
  { kind: "insight", label: "Insight", verb: "I took a principle from study" },
  { kind: "training", label: "Training", verb: "I trained it" },
];

/** Coach feedback is evidence too, but sits outside the self-driven loop. */
export const EVIDENCE_KINDS: { kind: EvidenceKind; label: string; color: string }[] = [
  { kind: "match", label: "Match", color: "var(--signal-bright)" },
  { kind: "film", label: "Film", color: "#c58bff" },
  { kind: "insight", label: "Insight", color: "var(--info)" },
  { kind: "training", label: "Training", color: "var(--positive)" },
  { kind: "coach", label: "Coach", color: "var(--review)" },
];

export const CATEGORIES: DevelopmentCategory[] = [
  "technical",
  "tactical",
  "physical",
  "mental",
  "positional",
];

export const STATUSES: DevelopmentGoal["status"][] = ["active", "monitoring", "achieved"];

export function evidenceMeta(kind: EvidenceKind) {
  return EVIDENCE_KINDS.find((e) => e.kind === kind) ?? EVIDENCE_KINDS[0];
}
