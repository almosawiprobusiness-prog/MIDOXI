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

/*
  What a pasted link actually is.

  This exists because the film room used to treat every non-YouTube URL
  as a "Direct video", say so on screen, save it with status "ready", and
  then render a black player with a 0:00 timeline when it turned out to
  be a web page. A link to a match on a streaming site is the single most
  likely thing a footballer pastes here, and it is the one case that
  answered "Direct video" with complete confidence.

  A `<video>` element can only play a file it can fetch. Extensions the
  browser will actually decode, matching the upload picker's own accept
  list — anything else is a page, a player, or a stream this cannot open.
*/
const PLAYABLE_EXT = /\.(mp4|webm|mov|m4v|ogv)$/i;

/*
  HLS — the format most sports and analysis platforms actually stream.

  A `.m3u8` is a playlist, not a file, and no browser except Safari can
  play one from a plain `src`. It is listed separately from `direct`
  because it needs a different playback path (hls.js, loaded only when
  one of these turns up), not because it is any less real.
*/
const HLS_EXT = /\.m3u8$/i;

export function isHlsUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return HLS_EXT.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export type VideoUrlKind =
  | { kind: "youtube"; id: string }
  | { kind: "direct" }
  | { kind: "hls" }
  | { kind: "unsupported"; reason: string };

export function videoUrlKind(raw: string): VideoUrlKind {
  const url = raw.trim();
  if (!url) return { kind: "unsupported", reason: "Paste a link first." };

  const yt = youtubeId(url);
  if (yt) return { kind: "youtube", id: yt };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: "unsupported", reason: "That is not a valid web address." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { kind: "unsupported", reason: "Only http and https links work here." };
  }

  if (HLS_EXT.test(parsed.pathname)) return { kind: "hls" };
  if (PLAYABLE_EXT.test(parsed.pathname)) return { kind: "direct" };

  /*
    Named rather than lumped into "invalid", because the difference
    matters to the person pasting: their link is not broken, it is a page
    about a video rather than the video. Telling them that is what points
    them at the fix instead of leaving them retrying the same paste.
  */
  return {
    kind: "unsupported",
    reason: `${parsed.hostname} gives a page to watch on, not a video file MIDO can open.`,
  };
}

/**
 * What to do instead — said once, in one place, so the dialog and the
 * player cannot drift into giving different advice about the same link.
 */
export const LONG_FOOTAGE_ADVICE =
  "For a full match, upload it to YouTube as unlisted and paste that link. It stays private to anyone without the link, there is no length limit, and MIDO can play and analyse it.";

/*
  How large an uploaded file may be.

  ONE constant, because there are two enforcement points and they had
  already drifted: the dialog refused anything over 50 MB while the
  Supabase bucket refused anything over 48. A 49 MB file passed the
  check the person could see and failed at the one they could not, with
  a bare "Upload failed (413)".

  The bucket is the real ceiling — it is enforced server-side and cannot
  be talked out of it — so this number and the bucket's own
  `file_size_limit` have to agree. `npm run verify:storage` checks that
  they still do.

  50 MB is not a number chosen for product reasons — it is the ceiling
  the Supabase project itself enforces, measured rather than assumed:
  setting the bucket to 100, 200 or 500 MB is refused outright with a
  413, and only 50 is accepted. That is the free plan's global upload
  limit, above any per-bucket setting. Raising it means upgrading the
  Supabase plan; until then, writing a larger number here would just
  recreate the drift this constant exists to prevent.

  So direct upload is for short clips — well under a minute of 1080p.
  Anything longer goes to YouTube, which is what LONG_FOOTAGE_ADVICE
  says and why HLS and YouTube are first-class sources rather than
  fallbacks.
*/
export const UPLOAD_MAX_MB = 50;
export const UPLOAD_MAX_BYTES = UPLOAD_MAX_MB * 1024 * 1024;
