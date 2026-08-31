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
  /** Known length in seconds — from the YouTube API at add time, or the browser for uploads. */
  durationSeconds?: number | null;
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

/*
  The reel — clips played end to end, the way a session is presented.

  These two live here rather than in the player because they decide what
  a reel IS, and both have a wrong answer that looks fine until somebody
  presents from it.
*/

/**
 * How long a clip with no marked end runs for.
 *
 * "Mark out" is optional, and most clips are cut without it — you see
 * the thing, you mark it, you move on. Played back that would run to
 * the end of the match, so the reel gives it a tail instead. Eight
 * seconds is about one phase of play: enough to see the pass land and
 * what happened next, short enough that a reel of twenty stays
 * watchable.
 */
export const REEL_TAIL_SECONDS = 8;

/** Where a clip stops in a reel — its marked end, or a sensible tail. */
export function clipEnd(clip: Pick<FilmClip, "startSeconds" | "endSeconds">): number {
  const { startSeconds, endSeconds } = clip;
  /*
    A `null` end and an end at or before the start are the same
    problem: there is no usable range. The second happens for real —
    mark out, then scrub back and mark in later — and treating it as a
    zero-length clip makes the reel skip straight past it.
  */
  if (endSeconds == null || !Number.isFinite(endSeconds) || endSeconds <= startSeconds) {
    return startSeconds + REEL_TAIL_SECONDS;
  }
  return endSeconds;
}

/**
 * Reel order: up the tape, earliest first.
 *
 * Clips are listed newest-first everywhere else, which is right for a
 * library and wrong for a reel — presenting a match backwards is not a
 * thing anybody wants. Sorted by where they happen, not when they were
 * cut.
 */
export function reelOrder(clips: FilmClip[]): FilmClip[] {
  return [...clips].sort((a, b) => a.startSeconds - b.startSeconds);
}

/**
 * One item in a collection reel: a clip, plus what it takes to play it.
 *
 * A collection spans videos, so the source travels WITH the clip rather
 * than being a property of the page. Uploaded footage carries a signed
 * URL that expires, which is why this is built per request and never
 * cached.
 */
export interface ReelItem {
  clip: FilmClip;
  video: {
    id: string;
    title: string;
    source: VideoSource;
    /** Playable URL: signed for uploads, the link for everything else. */
    url: string;
    /** YouTube id, when that is the source. */
    externalId?: string;
  };
}

/**
 * The order a collection plays in: match by match, up each tape.
 *
 * Sorting purely by timestamp — what a single-video reel does — is
 * meaningless here, because 12:30 in one match has nothing to do with
 * 12:30 in another; it would interleave four games at random.
 *
 * So clips are GROUPED by video, oldest match first, and run in order
 * within each. That reads as a narrative rather than a shuffle, and it
 * also minimises source swaps: every clip from one video plays before
 * the player has to load another. On a reel mixing an upload and a
 * YouTube link, a swap is a fresh load and a visible gap, so having
 * three instead of twelve is the difference between a session and a
 * slideshow.
 *
 * @param videoOrder video ids, in the order their videos should play.
 *                   Anything not listed sorts last, alphabetically, so
 *                   a clip whose video has gone missing still appears
 *                   rather than vanishing.
 */
export function collectionReelOrder<T extends { clip: FilmClip }>(
  items: T[],
  videoOrder: string[],
): T[] {
  const rank = new Map(videoOrder.map((id, i) => [id, i]));
  const rankOf = (id: string) => rank.get(id) ?? Number.MAX_SAFE_INTEGER;

  return [...items].sort((a, b) => {
    const ra = rankOf(a.clip.videoId);
    const rb = rankOf(b.clip.videoId);
    if (ra !== rb) return ra - rb;
    // Same video: up the tape.
    if (a.clip.startSeconds !== b.clip.startSeconds) {
      return a.clip.startSeconds - b.clip.startSeconds;
    }
    // Both unranked and at the same second — keep it deterministic.
    return a.clip.videoId.localeCompare(b.clip.videoId);
  });
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
  /**
   * A web page about a video rather than a video file — a sport.video
   * match page, a Veo link, a club stream. Playable only by embedding
   * the page itself, which the server verifies (frame policy) before
   * anything is saved as ready.
   */
  | { kind: "page"; host: string }
  | { kind: "unsupported"; reason: string };

/**
 * The URL actually framed, for services whose watch page differs from
 * their embeddable player. Vimeo is the known case: vimeo.com/<id>
 * pages are cluttered (and historically frame-hostile) while
 * player.vimeo.com/video/<id> exists precisely to be embedded. Unknown
 * services pass through untouched — the frame-policy probe is the
 * judge of those, not a list.
 */
export function embedUrlFor(url: string): string {
  try {
    const u = new URL(url);
    const vimeo = u.hostname.replace(/^www\./, "") === "vimeo.com" && u.pathname.match(/^\/(\d+)(?:\/|$)/);
    if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  } catch {
    /* not a URL; the classifier already refused it */
  }
  return url;
}

/**
 * A URL that opens this embedded page AT a given second — for services
 * with a published deep-link time contract. Everyone else gets null:
 * a generic `#t=` guess is worse than honesty, because SPAs reuse
 * those params for their own routing (sport.video turns `t=` into its
 * highlight-share mode and plays a 20-second clip instead of the
 * match). Null means the stage says "scrub to the time shown" and the
 * player keeps its dignity.
 */
export function seekEmbedUrl(url: string, seconds: number): string | null {
  const s = Math.max(0, Math.floor(seconds));
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "player.vimeo.com") {
      u.hash = `t=${s}s`;
      return u.toString();
    }
    if (host === "dailymotion.com" || host === "geo.dailymotion.com") {
      u.searchParams.set("start", String(s));
      return u.toString();
    }
    if (host === "player.twitch.tv") {
      u.searchParams.set("t", `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m${s % 60}s`);
      return u.toString();
    }
  } catch {
    /* not a URL; the classifier already refused it */
  }
  return null;
}

/**
 * Does this response's frame policy forbid embedding the page?
 *
 * Returns the human reason when embedding is blocked, null when it is
 * allowed. Pure so the truth table is testable; the fetch lives in the
 * server action. Conservative on CSP: a `frame-ancestors` that names
 * specific origins blocks us just as surely as 'none', because MIDO XI
 * will never be on that list.
 */
export function frameBlocksEmbedding(
  xFrameOptions: string | null,
  contentSecurityPolicy: string | null,
): string | null {
  const xfo = (xFrameOptions ?? "").trim().toLowerCase();
  if (xfo.includes("deny") || xfo.includes("sameorigin")) {
    return "This site refuses to be shown inside another app (X-Frame-Options).";
  }

  const csp = contentSecurityPolicy ?? "";
  const m = csp.match(/frame-ancestors\s+([^;]+)/i);
  if (m) {
    const sources = m[1].trim().toLowerCase();
    if (!sources.split(/\s+/).includes("*")) {
      return "This site only allows specific apps to embed it (frame-ancestors).";
    }
  }

  return null;
}

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
    A page about a video rather than the video. This used to be refused
    outright; now it is its own lane — the page can be EMBEDDED in the
    film room when its frame policy allows it, which the server checks
    before saving. The classifier only names what the link is; whether
    it can actually be framed is a claim only a request can verify.
  */
  return { kind: "page", host: parsed.hostname };
}

/**
 * What to do instead — said once, in one place, so the dialog and the
 * player cannot drift into giving different advice about the same link.
 *
 * The split is measured, not guessed (2026-08-30): an unlisted link
 * PLAYS fine (the YouTube embed doesn't care) but the enterprise
 * video backend refuses to READ one — 403 "not owned by the user" —
 * while public videos read perfectly. So the advice says exactly
 * which half of the product each visibility buys, instead of
 * promising analysis it cannot deliver.
 */
export const LONG_FOOTAGE_ADVICE =
  "For a full match, upload it to YouTube as unlisted and paste that link — it stays private to anyone without the link, there is no length limit, and MIDO can play and clip it. For MIDO's video reading the video must be public; unlisted footage can still be read by uploading a short clip directly.";

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
