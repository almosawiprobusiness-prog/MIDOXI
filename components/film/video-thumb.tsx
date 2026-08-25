import { Film, Play } from "lucide-react";
import { fmtTime, type Video } from "@/lib/data/film-types";

/*
  A card that shows the actual football, not a grey rectangle.

  The film room used to give YouTube videos a thumbnail and everything
  else a gradient with a play triangle on it — so a library of ten
  matches looked like ten identical placeholders, and finding the one
  you wanted meant reading titles.

  Two sources, two ways of getting a real frame, neither of which needs
  a capture pipeline or a stored image:

    YouTube  serves thumbnails at a public URL, keyed by video id.

    Anything else  gets a <video> with a MEDIA FRAGMENT — `#t=8` tells
    the browser to load the header and paint the frame at eight
    seconds. `preload="metadata"` means it fetches a range of the file,
    not the file. The picture on the card is genuinely from the match.

  Never the frame at 0:00, which on real footage is a black frame, a
  countdown or somebody's thumb over the lens.
*/

/**
 * Which second to show.
 *
 * A fraction of the way in rather than a fixed offset, so a 90-minute
 * match and a 20-second clip both land somewhere with football in it.
 * Falls back to eight seconds when the length is not known, which is
 * past the black frames and before anything has usually happened.
 */
export function posterTime(durationSeconds: number | null | undefined): number {
  if (!durationSeconds || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return 8;
  // Capped: a tenth of a long match is minutes in, and the browser
  // would have to fetch that far through the file to paint it.
  return Math.min(30, Math.max(1, durationSeconds * 0.1));
}

/**
 * A clip's own frame.
 *
 * Same trick, different second: a clip card shows the moment the clip
 * is ABOUT rather than a poster from the video it was cut from. On a
 * collection of twelve clips from three matches, the difference is
 * between twelve pictures of the same three kick-offs and twelve
 * pictures of the twelve things somebody marked.
 *
 * YouTube cannot do this — its thumbnail API serves a handful of fixed
 * frames, none of which is the one you want — so those fall back to the
 * video's thumbnail and are honest about it.
 */
export function ClipThumb({
  video,
  atSeconds,
  className = "",
}: {
  video: Video;
  atSeconds: number;
  className?: string;
}) {
  return (
    <VideoThumb
      video={{ ...video, durationSeconds: null }}
      className={className}
      atOverride={Math.max(0, atSeconds)}
      compact
    />
  );
}

export function VideoThumb({
  video,
  className = "",
  atOverride,
  compact = false,
}: {
  video: Video;
  className?: string;
  /** Show this exact second instead of a computed poster frame. */
  atOverride?: number;
  /** Smaller chrome, for a card in a list rather than a library tile. */
  compact?: boolean;
}) {
  const isYouTube = video.source === "youtube" && Boolean(video.externalId);
  const ytThumb = isYouTube ? `https://img.youtube.com/vi/${video.externalId}/mqdefault.jpg` : null;
  // Only a real URL can be asked for a frame. An upload whose signed
  // link did not come back still has a storage path here.
  const framable = !isYouTube && Boolean(video.url) && video.url.startsWith("http");

  return (
    <div
      className={`relative flex aspect-video items-center justify-center overflow-hidden bg-gradient-to-br from-ink-800 to-ink-925 ${className}`}
    >
      {ytThumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ytThumb}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : framable ? (
        <video
          src={`${video.url}#t=${atOverride ?? posterTime(video.durationSeconds)}`}
          preload="metadata"
          muted
          playsInline
          // Not a player: it exists to paint one frame, and a card that
          // could be scrubbed by accident would be a trap.
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : null}

      {/* A wash, so white kit and floodlights never bleach the label. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

      <span
        className={`relative grid place-items-center rounded-full bg-black/50 text-text-hi backdrop-blur-sm transition-colors group-hover:bg-signal group-hover:text-white ${
          compact ? "size-8" : "size-12"
        }`}
      >
        <Play className={compact ? "size-3.5" : "size-5"} fill="currentColor" />
      </span>

      {/* A list card is small; the source badge would crowd it. */}
      <span className={compact ? "hidden" : "absolute right-2 top-2"}>
        {isYouTube ? (
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-text-dim">
            YT
          </span>
        ) : (
          <Film className="size-4 text-text-dim" />
        )}
      </span>

      {video.durationSeconds ? (
        <span className="data-mono absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-text">
          {fmtTime(video.durationSeconds)}
        </span>
      ) : null}
    </div>
  );
}
