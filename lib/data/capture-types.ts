/*
  The capture contract, in one dependency-free file.

  Everything here is pure and client-safe on purpose: the Next.js API
  routes validate against it, the Player OS renders with it, and the
  Chrome extension bundles it directly — so the three surfaces cannot
  drift apart on what a capture is. Anything needing a database or
  "server-only" belongs in lib/data/captures.ts, not here.
*/

export type CaptureCategory =
  | "movement"
  | "finishing"
  | "receiving"
  | "scanning"
  | "passing"
  | "creation"
  | "pressing"
  | "defending"
  | "positioning"
  | "transitions"
  | "set_pieces"
  | "goalkeeping"
  | "tactical"
  | "mentality"
  | "other";

export const CAPTURE_CATEGORIES: { value: CaptureCategory; label: string }[] = [
  { value: "movement", label: "Movement" },
  { value: "finishing", label: "Finishing" },
  { value: "receiving", label: "Receiving" },
  { value: "scanning", label: "Scanning" },
  { value: "passing", label: "Passing" },
  { value: "creation", label: "Creation" },
  { value: "pressing", label: "Pressing" },
  { value: "defending", label: "Defending" },
  { value: "positioning", label: "Positioning" },
  { value: "transitions", label: "Transitions" },
  { value: "set_pieces", label: "Set pieces" },
  { value: "goalkeeping", label: "Goalkeeping" },
  { value: "tactical", label: "Tactical" },
  { value: "mentality", label: "Mentality" },
  { value: "other", label: "Other" },
];

export function isCaptureCategory(v: unknown): v is CaptureCategory {
  return typeof v === "string" && CAPTURE_CATEGORIES.some((c) => c.value === v);
}

export function captureCategoryLabel(v: CaptureCategory): string {
  return CAPTURE_CATEGORIES.find((c) => c.value === v)?.label ?? "Other";
}

/*
  Limits. Mirrored by the check constraints in migration 0035 — the
  database enforces them last, this file explains them first. An
  observation is a noticing, not an essay; 1000 characters is roughly
  three spoken sentences past the point a note stops being quick.
*/
export const OBSERVATION_MAX_CHARS = 1000;
export const TITLE_MAX_CHARS = 300;
export const CHANNEL_MAX_CHARS = 200;
export const URL_MAX_CHARS = 500;
export const CLIENT_KEY_MAX_CHARS = 64;
/** 12 hours. Longer than any football broadcast; shorter than nonsense. */
export const TIMESTAMP_MAX_SECONDS = 43200;

/** The wire shape the extension sends and the API validates. */
export interface CaptureInput {
  videoId: string;
  sourceUrl: string;
  videoTitle: string;
  channelName?: string | null;
  thumbnailUrl?: string | null;
  timestampSeconds: number;
  observation: string;
  category?: CaptureCategory | null;
  goalId?: string | null;
  clientKey?: string | null;
}

/** A saved capture, as the Player OS reads it. */
export interface StudyCapture {
  id: string;
  videoId: string;
  sourceUrl: string;
  videoTitle: string;
  channelName: string | null;
  thumbnailUrl: string | null;
  timestampSeconds: number;
  observation: string;
  category: CaptureCategory | null;
  goalId: string | null;
  studyId: string | null;
  origin: "chrome_extension" | "web";
  createdAt: string;
}

/** A YouTube video id: exactly 11 URL-safe characters. */
export function isYoutubeVideoId(v: unknown): v is string {
  return typeof v === "string" && /^[\w-]{11}$/.test(v);
}

/**
 * The id inside any of YouTube's URL shapes — watch, shorts, youtu.be,
 * embed, live — or null when the URL is not a YouTube video at all.
 * Same pattern family as lib/data/film-types.ts's youtubeId, widened to
 * cover /live/ which the film room never meets but a browser will.
 */
export function youtubeIdFromUrl(url: string): string | null {
  if (typeof url !== "string") return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m ? m[1] : null;
}

/** The canonical shareable URL for a moment: watch page + &t= seconds. */
export function timestampedYoutubeUrl(videoId: string, seconds: number): string {
  const t = Math.max(0, Math.floor(seconds));
  return t > 0
    ? `https://www.youtube.com/watch?v=${videoId}&t=${t}s`
    : `https://www.youtube.com/watch?v=${videoId}`;
}

/** 2057 → "34:17"; 7317 → "2:01:57". Display only — storage is numeric. */
export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

export type CaptureIssue = { field: string; message: string };

/**
 * Is this capture well-formed? Returns the FIRST problem, or null.
 *
 * Shared by the extension (before it sends) and the API route (before
 * it trusts). The extension using it is a courtesy; the server using it
 * is the contract — nothing the client asserts is believed, including
 * that the URL and the video id agree with each other.
 */
export function captureIssue(input: CaptureInput): CaptureIssue | null {
  if (!isYoutubeVideoId(input.videoId)) {
    return { field: "videoId", message: "Not a YouTube video id." };
  }

  if (typeof input.sourceUrl !== "string" || input.sourceUrl.length > URL_MAX_CHARS) {
    return { field: "sourceUrl", message: "Source URL is missing or too long." };
  }
  const urlId = youtubeIdFromUrl(input.sourceUrl);
  if (!urlId || urlId !== input.videoId) {
    return { field: "sourceUrl", message: "URL and video id do not match." };
  }

  const title = typeof input.videoTitle === "string" ? input.videoTitle.trim() : "";
  if (!title || title.length > TITLE_MAX_CHARS) {
    return { field: "videoTitle", message: "Video title is missing or too long." };
  }

  if (input.channelName != null) {
    if (typeof input.channelName !== "string" || input.channelName.length > CHANNEL_MAX_CHARS) {
      return { field: "channelName", message: "Channel name is too long." };
    }
  }

  if (input.thumbnailUrl != null && input.thumbnailUrl !== "") {
    if (
      typeof input.thumbnailUrl !== "string" ||
      input.thumbnailUrl.length > URL_MAX_CHARS ||
      !/^https:\/\/(i\.ytimg\.com|img\.youtube\.com)\//.test(input.thumbnailUrl)
    ) {
      return { field: "thumbnailUrl", message: "Thumbnail must be a YouTube image URL." };
    }
  }

  const t = input.timestampSeconds;
  if (typeof t !== "number" || !Number.isFinite(t) || t < 0 || t > TIMESTAMP_MAX_SECONDS) {
    return { field: "timestampSeconds", message: "Timestamp is out of bounds." };
  }

  const obs = typeof input.observation === "string" ? input.observation.trim() : "";
  if (!obs) return { field: "observation", message: "Write what you noticed." };
  if (obs.length > OBSERVATION_MAX_CHARS) {
    return { field: "observation", message: `Keep it under ${OBSERVATION_MAX_CHARS} characters.` };
  }

  if (input.category != null && !isCaptureCategory(input.category)) {
    return { field: "category", message: "Unknown category." };
  }

  if (input.goalId != null && input.goalId !== "") {
    // Shape only — uuid in production, short ids ("g1") in demo mode.
    // OWNERSHIP is the real check, done against the database by the
    // server; no id format can stand in for that.
    if (typeof input.goalId !== "string" || !/^[\w-]{1,64}$/.test(input.goalId)) {
      return { field: "goalId", message: "Not a goal id." };
    }
  }

  if (input.clientKey != null && input.clientKey !== "") {
    if (typeof input.clientKey !== "string" || input.clientKey.length > CLIENT_KEY_MAX_CHARS) {
      return { field: "clientKey", message: "Client key is too long." };
    }
  }

  return null;
}
