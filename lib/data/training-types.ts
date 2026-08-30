import type { SessionKind } from "@/lib/types";

/**
 * One block of a planned session. Written by the session engine when a
 * player accepts a generated session; `source` is the human label of
 * the piece of their record the block exists because of ("Film: late
 * scanning"), already resolved — the raw context key does not outlive
 * the proposal.
 */
export interface PlanBlock {
  name: string;
  detail: string;
  work: string;
  source: string;
}

export interface TrainingInput {
  kind: SessionKind;
  title: string;
  scheduledAt: string; // ISO datetime-local
  durationMin?: number | null;
  objective?: string;
  rpe?: number | null;
  physicalFeel?: number | null;
  technicalFeel?: number | null;
  improved?: string;
  feltOff?: string;
  /** The accepted plan, when this session came from the session engine. */
  plan?: PlanBlock[];
  /**
   * Film concepts the plan trained, for the TRAINING_LOGGED payload —
   * this is what lets reports say "trained what the film showed".
   */
  concepts?: string[];
}

export interface TrainingEntry extends TrainingInput {
  id: string;
}

export const TRAINING_KINDS: { kind: SessionKind; label: string; color: string }[] = [
  { kind: "team", label: "Team", color: "var(--info)" },
  { kind: "individual", label: "Individual", color: "var(--signal-bright)" },
  { kind: "technical", label: "Technical", color: "#c58bff" },
  { kind: "tactical", label: "Tactical", color: "var(--review)" },
  { kind: "gym", label: "Gym", color: "var(--text-dim)" },
  { kind: "conditioning", label: "Conditioning", color: "var(--correction)" },
  { kind: "speed", label: "Speed", color: "#f0a" },
  { kind: "mobility", label: "Mobility", color: "var(--positive)" },
  { kind: "recovery", label: "Recovery", color: "var(--positive)" },
  { kind: "film", label: "Film", color: "#c58bff" },
];

export function trainingMeta(kind: SessionKind) {
  return TRAINING_KINDS.find((k) => k.kind === kind) ?? TRAINING_KINDS[0];
}
