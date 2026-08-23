import type { SessionKind } from "@/lib/types";

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
