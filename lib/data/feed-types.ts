/*
  The community, as a feed.

  What was here was a forum — a title, a body, tags. This is media first and
  words second, which is a different product even though it shares a table.

  Two things worth stating up front, because they shape everything below.

  ONE. A feed on a product with fourteen-year-olds on it is not the same object
  as a feed on a product for adults. Blocking, reporting and a visibility switch
  are in the first version rather than the second. The owner has chosen public
  as the default; the machinery for changing that is here regardless, because
  retrofitting it to a table full of live posts is the expensive version.

  TWO. Uploaded match footage cannot be a feed post. It lives in a private
  bucket, a signed URL expires mid-scroll, and there is no transcoding to make
  a 4GB file into something anyone would wait for. So a post carries a photo, a
  YouTube embed, or a short video uploaded deliberately for posting — and the
  composer says which, rather than failing at the end of an upload.

  Client-safe: shapes and pure functions.
*/

export type MediaKind = "photo" | "video" | "youtube";
export type Visibility = "public" | "followers";

export interface PostMedia {
  kind: MediaKind;
  /** Public bucket URL, or a YouTube id for `youtube`. */
  url: string;
  width: number | null;
  height: number | null;
}

export interface FeedAuthor {
  userId: string;
  name: string;
  handle: string | null;
  position: string | null;
  avatar: string | null;
}

export interface Post {
  id: string;
  author: FeedAuthor;
  caption: string;
  media: PostMedia | null;
  /** A clip from the player's own film room, when the post came from one. */
  clip: {
    title: string;
    start: number;
    tags: string[];
    sentiment: string | null;
    videoSource: string | null;
    videoExternalId: string | null;
  } | null;
  tags: string[];
  visibility: Visibility;
  createdAt: string;
  likes: number;
  comments: number;
  likedByMe: boolean;
  /** True when the signed-in reader wrote it. */
  mine: boolean;
}

export interface ProfileSummary {
  userId: string;
  name: string;
  handle: string | null;
  position: string | null;
  club: string | null;
  avatar: string | null;
  bio: string | null;
  posts: number;
  followers: number;
  following: number;
  /** Whether the signed-in reader follows them. */
  followedByMe: boolean;
  isMe: boolean;
}

// ---------------------------------------------------------------------------
// Composing
// ---------------------------------------------------------------------------

export const CAPTION_MAX = 600;
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 25 * 1024 * 1024;
/** Stored at this on the long edge. Enough for a full-width phone screen. */
export const PHOTO_PX = 1440;

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const VIDEO_TYPES = ["video/mp4", "video/webm"];

export function mediaIssue(file: { type: string; size: number }): string | null {
  const isPhoto = PHOTO_TYPES.includes(file.type);
  const isVideo = VIDEO_TYPES.includes(file.type);

  if (!isPhoto && !isVideo) {
    return "Post a photo (JPEG, PNG or WebP) or a short video (MP4 or WebM).";
  }
  // Photos are resized in the browser before they get here, so this only
  // catches something enormous chosen by mistake.
  if (isPhoto && file.size > PHOTO_MAX_BYTES) {
    return `That photo is ${(file.size / 1024 / 1024).toFixed(0)}MB. Try a smaller one.`;
  }
  if (isVideo && file.size > VIDEO_MAX_BYTES) {
    return (
      `That video is ${(file.size / 1024 / 1024).toFixed(0)}MB, and the limit is ` +
      `${VIDEO_MAX_BYTES / 1024 / 1024}MB. Full match footage belongs in the film room — ` +
      `post a short clip of the moment instead.`
    );
  }
  return null;
}

export function captionIssue(caption: string): string | null {
  if (caption.length > CAPTION_MAX) {
    return `${caption.length} characters, and the limit is ${CAPTION_MAX}.`;
  }
  return null;
}

/** A post needs to be something. Media, or words, or both. */
export function postIssue(input: { caption: string; hasMedia: boolean }): string | null {
  if (!input.hasMedia && !input.caption.trim()) {
    return "Add a photo, a clip, or something to say.";
  }
  return captionIssue(input.caption);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export const REPORT_REASONS: { value: string; label: string }[] = [
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "safeguarding", label: "Concern about a young player" },
  { value: "spam", label: "Spam" },
  { value: "not-football", label: "Nothing to do with football" },
  { value: "other", label: "Something else" },
];

/**
 * `@handle`, or a fallback that is never blank.
 *
 * A feed with unnamed authors in it looks broken, and a player who has not set
 * a handle yet is the common case on a new account rather than an edge one.
 */
export function displayHandle(author: Pick<FeedAuthor, "handle" | "name">): string {
  if (author.handle) return `@${author.handle}`;
  const fromName = author.name.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return fromName ? `@${fromName}` : "@player";
}

/** "1.2k" rather than "1247" — a follower count is a glance, not a figure. */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * The aspect ratio to reserve before the media loads.
 *
 * Without this every image landing shoves the rest of the feed down the page,
 * which on a phone means tapping the wrong post. Falls back to 4:5 — Instagram's
 * portrait shape, and the one most phone photos of football arrive in.
 */
export function aspectOf(media: PostMedia | null): string {
  if (!media) return "1 / 1";
  if (media.kind === "youtube") return "16 / 9";
  if (!media.width || !media.height) return "4 / 5";
  // Very tall images are cropped rather than allowed to fill a whole screen.
  const ratio = media.width / media.height;
  if (ratio < 0.6) return "4 / 5";
  if (ratio > 2) return "16 / 9";
  return `${media.width} / ${media.height}`;
}

/** The YouTube id from anything a player is likely to paste. */
export function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}
