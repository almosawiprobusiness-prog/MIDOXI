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
}

export interface EvidenceEntry {
  id: string;
  goalId: string;
  kind: EvidenceKind;
  note: string;
  createdAt: string;
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
