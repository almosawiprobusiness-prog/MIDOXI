import type { DevelopmentCategory, SessionKind } from "@/lib/types";
import type { RoleId } from "@/lib/roles/roles";
import type { FootballConcept, PositionGroup, Provenance, VerifiedFact, PersonKind } from "./types";

/*
  The shapes a study renders from. Client-safe: types only, so both the server
  engine and the UI components can speak the same language.
*/

export interface StudyPoint {
  title: string;
  body: string;
}

/** Where a rendered block came from — drives the provenance label in the UI. */
export type BlockSource = "curated" | "graph" | "ai" | "user";

export interface RenderedModule {
  key: string;
  title: string;
  provenance: Provenance;
  source: BlockSource;
  summary: string;
  points: StudyPoint[];
  watchFor?: string[];
  /** Concepts this module teaches — links into the knowledge graph. */
  concepts: string[];
}

export interface MatchStudy {
  /** The single instruction that makes watching football into studying it. */
  instruction: string;
  watch: string[];
  source: BlockSource;
}

export interface TrainingBlockPlan {
  name: string;
  detail: string;
  work: string;
}

export interface TrainingPlan {
  title: string;
  kind: SessionKind;
  durationMin: number;
  objective: string;
  blocks: TrainingBlockPlan[];
  source: BlockSource;
}

export interface ApplyPlan {
  summary: string;
  points: StudyPoint[];
  /** The development goal this study proposes writing into the user's account. */
  goal: { title: string; category: DevelopmentCategory; why: string };
  source: BlockSource;
}

export interface QuizQuestion {
  q: string;
  options: string[];
  /** Index into options. */
  answer: number;
  why: string;
}

export interface StudySubjectView {
  slug: string;
  name: string;
  kind: PersonKind | "concept";
  descriptor: string;
  premise: string;
  verified: VerifiedFact[];
}

export interface StudyViewer {
  role: RoleId;
  position: string;
  positionGroup: PositionGroup;
  positionLabel: string;
  /** How this study is being read: a position for players, a craft for staff. */
  lensLabel: string;
  goals: string[];
}

export interface StudyView {
  subject: StudySubjectView;
  viewer: StudyViewer;
  modules: RenderedModule[];
  matchStudy: MatchStudy;
  training: TrainingPlan;
  apply: ApplyPlan;
  quiz: QuizQuestion[];
  concepts: FootballConcept[];
  /** True when a Claude pass personalised this study. */
  enhanced: boolean;
  /** Honest note about why AI did not run, when it did not. */
  aiNote: string | null;
}

/** How a provenance tag is presented. Never blur these lines. */
export const PROVENANCE_META: Record<Provenance, { label: string; color: string; hint: string }> = {
  verified: {
    label: "Verified",
    color: "var(--info)",
    hint: "Stable public record, curated by hand — not generated.",
  },
  analysis: {
    label: "MIDO analysis",
    color: "var(--signal-bright)",
    hint: "Football interpretation. Useful, but it is a reading, not a fact.",
  },
  observation: {
    label: "Your observation",
    color: "var(--positive)",
    hint: "Your own notes and clips.",
  },
};
