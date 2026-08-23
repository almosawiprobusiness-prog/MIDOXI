export type VideoSource = "upload" | "youtube" | "url";
export type ClipSentiment = "positive" | "review" | "correction";

export interface Video {
  id: string;
  title: string;
  source: VideoSource;
  url: string; // playable src (mp4/webm) or youtube watch/embed url
  externalId?: string; // youtube id
  thumbnailUrl?: string;
  durationSeconds?: number | null;
  matchId?: string | null;
  status: "uploading" | "processing" | "ready" | "failed";
  createdAt: string;
}

export interface VideoInput {
  title: string;
  source: VideoSource;
  url: string;
  externalId?: string;
  matchId?: string | null;
}

export interface FilmClip {
  id: string;
  videoId: string;
  matchId?: string | null;
  goalId?: string | null;
  title: string;
  startSeconds: number;
  endSeconds?: number | null;
  sentiment?: ClipSentiment | null;
  note: string;
  favorite: boolean;
  tags: string[];
  createdAt: string;
}

export interface ClipInput {
  videoId: string;
  title: string;
  startSeconds: number;
  endSeconds?: number | null;
  sentiment?: ClipSentiment | null;
  note?: string;
  tags: string[];
  goalId?: string | null;
  matchId?: string | null;
}

export interface VideoDetail {
  video: Video;
  clips: FilmClip[];
}

export interface ClipFilter {
  sentiment?: ClipSentiment;
  tag?: string;
  favorite?: boolean;
}

export interface Collection {
  id: string;
  name: string;
  clipCount: number;
  createdAt: string;
}

export interface CollectionDetail {
  collection: Collection;
  clips: FilmClip[];
}

export const SENTIMENTS: { key: ClipSentiment; label: string; color: string; wash: string }[] = [
  { key: "positive", label: "Positive", color: "var(--positive)", wash: "var(--positive-wash)" },
  { key: "review", label: "Review", color: "var(--review)", wash: "var(--review-wash)" },
  { key: "correction", label: "Correction", color: "var(--correction)", wash: "var(--correction-wash)" },
];

export const CLIP_TAGS = [
  "Finishing", "Pressing", "Build-up", "Movement", "Transition", "1v1",
  "First Touch", "Passing", "Positioning", "Decision Making", "Heading",
  "Defending", "Counterpress", "Set Piece", "Timing", "Final Third",
];

export function sentimentMeta(s: ClipSentiment | null | undefined) {
  return SENTIMENTS.find((x) => x.key === s) ?? null;
}

/** mm:ss from seconds. */
export function fmtTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Detect a YouTube id from a URL, else null. */
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
