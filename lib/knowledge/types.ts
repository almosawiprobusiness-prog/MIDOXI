/*
  ============================================================
  MIDO XI — FOOTBALL KNOWLEDGE GRAPH (types)
  ------------------------------------------------------------
  Nodes are people, concepts and positions. Edges are typed and
  directional. The graph is curated in code rather than
  generated, so relationships stay stable, reviewable and
  citable — MIDO traverses and explains it, it does not invent
  it.

  Client-safe: pure data and pure functions, no server imports.
  ============================================================
*/

/** The four development areas the whole product organises around. */
export type ConceptArea = "technical" | "tactical" | "physical" | "mental";

/** Phase of play a concept belongs to. */
export type Phase = "in-possession" | "out-of-possession" | "transition" | "set-piece" | "all";

export type EdgeKind =
  | "embodies" // person -> concept
  | "requires" // concept -> concept (you cannot do A without B)
  | "counters" // concept -> concept (A is the answer to B)
  | "partOf" // concept -> concept (A is a component of B)
  | "relatesTo"; // loose association

export interface KnowledgeEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  /** Why this edge exists — shown when MIDO explains a connection. */
  note?: string;
}

export interface FootballConcept {
  slug: string;
  name: string;
  area: ConceptArea;
  phase: Phase;
  /** One sentence: what it actually is. */
  definition: string;
  /** Why a footballer should care. */
  why: string;
  /** How it shows up on the pitch — observable, not abstract. */
  looksLike: string[];
  /** Coaching cues a player can hold in their head during a session. */
  cues: string[];
  /** How you train it. */
  trains: string[];
  /** Positions this matters most for (position group codes). */
  positions: PositionGroup[];
}

export type PositionGroup = "GK" | "CB" | "FB" | "DM" | "CM" | "AM" | "W" | "CF";

/** Normalises the many position strings a user might have to a group. */
export function positionGroup(position: string | null | undefined): PositionGroup {
  const p = (position ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!p) return "CF";
  if (p.startsWith("gk")) return "GK";
  if (p.includes("cb") || p === "rcb" || p === "lcb") return "CB";
  if (["rb", "lb", "rwb", "lwb", "fb", "wb"].some((k) => p.startsWith(k))) return "FB";
  if (p === "6" || p.startsWith("dm") || p.startsWith("cdm")) return "DM";
  if (p === "8" || p.startsWith("cm")) return "CM";
  if (p === "10" || p.startsWith("am") || p.startsWith("cam")) return "AM";
  if (["rw", "lw", "rm", "lm", "w"].some((k) => p.startsWith(k))) return "W";
  if (["cf", "st", "fw", "9"].some((k) => p.startsWith(k))) return "CF";
  return "CF";
}

export const POSITION_GROUP_LABEL: Record<PositionGroup, string> = {
  GK: "Goalkeeper",
  CB: "Centre-back",
  FB: "Full-back / wing-back",
  DM: "Defensive midfielder",
  CM: "Central midfielder",
  AM: "Attacking midfielder",
  W: "Winger",
  CF: "Centre-forward",
};

/**
 * Provenance is the truth model (spec 31). Every block a study renders carries
 * one, and the UI renders each differently. `verified` is reserved for stable
 * public record held in this curated catalogue — never for model output.
 */
export type Provenance = "verified" | "analysis" | "observation";

/** A fact we are willing to state as fact. */
export interface VerifiedFact {
  label: string;
  value: string;
}

export interface StudyModuleSpec {
  key: string;
  title: string;
  /** What this module is for — also used as the AI generation brief. */
  brief: string;
  /** Concepts this module teaches, by slug. */
  concepts: string[];
}

export type PersonKind = "player" | "coach";

export interface FootballPerson {
  slug: string;
  name: string;
  kind: PersonKind;
  /** Short descriptor shown in catalogues: "Centre-forward · England". */
  descriptor: string;
  /** Editorial one-liner: why studying this person teaches you football. */
  premise: string;
  /** Stable public record. Curated by hand, never model-generated. */
  verified: VerifiedFact[];
  /** Position group this person is most instructive for. */
  positions: PositionGroup[];
  /** Concepts this person embodies — the spine of the study. */
  embodies: string[];
  /** The modules this study is built from. */
  modules: StudyModuleSpec[];
  /** Hand-authored module bodies, where they exist. */
  curated?: Record<string, CuratedModule>;
}

/** A fully hand-authored module — the quality baseline for generated ones. */
export interface CuratedModule {
  provenance: Provenance;
  /** Lead paragraph. */
  summary: string;
  /** The teaching points. */
  points: { title: string; body: string }[];
  /** Optional: what to look for on film. */
  watchFor?: string[];
}
