/*
  MIDO PUBLISH — the template vocabulary. Client-safe: keys, formats
  and the exact shapes templates render. If a field is not in one of
  these interfaces, no artifact can show it.
*/

export type PublishTemplate = "match" | "training" | "development" | "season";

export const PUBLISH_TEMPLATES: { key: PublishTemplate; label: string; needs: string }[] = [
  { key: "match", label: "Match performance", needs: "a logged match" },
  { key: "training", label: "Training complete", needs: "a logged session" },
  { key: "development", label: "Development progress", needs: "an active goal" },
  { key: "season", label: "Season snapshot", needs: "logged matches" },
];

export type PublishFormat = "square" | "story" | "landscape";

export const PUBLISH_FORMATS: { key: PublishFormat; label: string; width: number; height: number }[] = [
  { key: "square", label: "Square · 1080", width: 1080, height: 1080 },
  { key: "story", label: "Story · 1080×1920", width: 1080, height: 1920 },
  { key: "landscape", label: "Card · 1200×630", width: 1200, height: 630 },
];

export function formatDims(key: PublishFormat) {
  return PUBLISH_FORMATS.find((f) => f.key === key) ?? PUBLISH_FORMATS[0]!;
}

export interface PublishIdentity {
  name: string;
  position: string;
  club: string;
  squadNumber: number | null;
}

export interface MatchCardData {
  identity: PublishIdentity;
  opponent: string;
  competition: string;
  date: string;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  minutes: number;
  goals: number;
  assists: number;
  rating: number | null;
}

export interface TrainingCardData {
  identity: PublishIdentity;
  title: string;
  kind: string;
  durationMin: number | null;
  rpe: number | null;
  objective: string | null;
  blocks: { name: string; work: string }[];
}

export interface DevelopmentCardData {
  identity: PublishIdentity;
  goals: { title: string; progress: number; evidence: number }[];
}

export interface SeasonCardData {
  identity: PublishIdentity;
  matches: number;
  record: { W: number; D: number; L: number };
  minutes: number;
  goals: number;
  assists: number;
}
