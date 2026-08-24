"use client";

import { useEffect, useRef } from "react";
import type { FilmPlayer } from "./film-player";

/*
  A YouTube embed the film room can actually drive.

  A plain <iframe src="youtube.com/embed/..."> plays and nothing more —
  the page cannot ask it where the playhead is or move it, which is why
  clipping, the timeline and the pen were all switched off for YouTube
  footage. The IFrame Player API is the same iframe with a message
  channel attached, and that channel is enough for every one of them.

  This matters more than it sounds. A match runs fifty minutes and this
  project's storage caps one file at 50MB, so full games could never be
  uploaded — they could only be linked. Which meant the tools worked on
  exactly the footage nobody has, and not on the footage everybody has.

  Only the frame reader stays off, and for a reason no API can fix: it
  works by drawing the video onto a canvas and reading the pixels back,
  and pixels belonging to another origin cannot be read out of an iframe
  by anyone, ever. The video reading is unaffected — it hands the URL
  straight to the model and never touches the picture.
*/

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setPlaybackRate(rate: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement | string,
    opts: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YTPlayer }) => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** The only two states the transport needs to tell apart. */
const PLAYING = 1;
const BUFFERING = 3;

/*
  Error codes worth telling apart. 101 and 150 are the same thing — the
  uploader disabled embedding — and they are the case that actually
  happens with league footage, so they get their own sentence rather
  than a generic failure. Guessing "the link is broken" when the link is
  fine sends somebody to fix the wrong thing.
*/
function errorMessage(code: number): string {
  if (code === 101 || code === 150)
    return "This video's owner does not allow it to be played outside YouTube.";
  if (code === 100) return "That video is private, deleted, or does not exist.";
  if (code === 2) return "That YouTube link is malformed.";
  return "YouTube could not play this video.";
}

/*
  The API script, loaded once for the whole app however many players
  appear. It announces itself through a single global callback, so a
  second loader would overwrite the first one's — hence the module-level
  promise rather than per-component loading.
*/
let apiPromise: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    /*
      A timeout as well as an error handler, for the same reason the
      <video> path needs one: a request that is blocked rather than
      refused never fires `error`, it just never finishes. Without this
      a corporate filter or an extension produces a permanent spinner
      instead of a sentence explaining what happened.
    */
    const timer = setTimeout(
      () => reject(new Error("YouTube's player did not load.")),
      12_000,
    );
    const done = (err: Error | null, api?: YTNamespace) => {
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(api!);
    };

    /*
      Chained, not replaced. Another script on the page may already own
      this global, and clobbering it would silently break whatever was
      waiting on it.
    */
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) done(null, window.YT);
      else done(new Error("YouTube's player loaded incompletely."));
    };

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    tag.onerror = () => done(new Error("YouTube's player could not be reached."));
    document.head.appendChild(tag);
  });

  // A failure must not be cached, or a retry can never succeed.
  apiPromise.catch(() => {
    apiPromise = null;
  });

  return apiPromise;
}

export function YouTubeStage({
  externalId,
  onReady,
  onTime,
  onDuration,
  onPlayingChange,
  onUnavailable,
}: {
  externalId: string;
  onReady: (player: FilmPlayer) => void;
  onTime: (seconds: number) => void;
  onDuration: (seconds: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onUnavailable: (reason: string) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  /*
    The callbacks live in a ref so the effect below depends only on the
    video id. Passed as dependencies they would be new functions on
    every render of the studio — and every render would tear down the
    player and build a new one, which on a video means it restarts.
  */
  const cb = useRef({ onReady, onTime, onDuration, onPlayingChange, onUnavailable });

  // Kept current in an effect rather than assigned during render:
  // writing a ref while rendering is not safe under concurrent React,
  // and this runs before the player effect below on mount.
  useEffect(() => {
    cb.current = { onReady, onTime, onDuration, onPlayingChange, onUnavailable };
  });

  useEffect(() => {
    let cancelled = false;
    let player: YTPlayer | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    /*
      Two pieces of bookkeeping that exist for one YouTube behaviour.

      `seekTo` does not just seek. Its own documentation says the player
      "remains paused if it was paused, otherwise it will play" — and a
      player that has never been started is not *paused*, it is
      UNSTARTED. So the first scrub of a match starts the match playing,
      which was measured here: a seek to 0:75 left the tape running and
      the clock at 1:58 seconds later.

      That is wrong for a film room, where scrubbing is how you FIND the
      moment you want to look at. So a seek made while stopped pauses
      again straight after, and — because the resume arrives
      asynchronously and can land after that pause — any PLAYING state
      inside a short window after such a seek is caught and undone.

      The window is deliberately short and only ever opened by a seek
      that happened while stopped, so it can never fight a real play.
    */
    let isPlaying = false;
    let suppressPlayUntil = 0;
    // Set in onReady. No state change can arrive before that, and it is
    // how handlers other than onReady reach the player.
    let api: YTPlayer | null = null;

    loadApi()
      .then((YT) => {
        if (cancelled || !mountRef.current) return;

        player = new YT.Player(mountRef.current, {
          videoId: externalId,
          width: "100%",
          height: "100%",
          playerVars: {
            playsinline: 1,
            // No "more videos from other channels" panel at the end of
            // a match. Analysis is not a browsing session.
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              const p = e.target;
              api = p;

              cb.current.onReady({
                play: () => {
                  suppressPlayUntil = 0;
                  p.playVideo();
                },
                pause: () => {
                  suppressPlayUntil = 0;
                  p.pauseVideo();
                },
                seek: (seconds) => {
                  // `true` lets it seek past what is buffered, which is
                  // the whole point when somebody jumps to 40:00 of a
                  // match they have not watched yet.
                  p.seekTo(Math.max(0, seconds), true);
                  // Scrubbing must not start the tape. See above.
                  if (!isPlaying) {
                    suppressPlayUntil = Date.now() + 600;
                    p.pauseVideo();
                  }
                },
                setRate: (rate) => p.setPlaybackRate(rate),
              });

              /*
                YouTube has no timeupdate event, so the playhead is
                polled. 100ms is under the 0.1s frame nudge — the
                smallest movement the transport can make — so nothing
                the user does goes unreported, and it is cheap: a
                property read on an object already in memory.
              */
              let lastTime = -1;
              let lastDuration = -1;
              poll = setInterval(() => {
                if (cancelled) return;
                const t = p.getCurrentTime();
                if (typeof t === "number" && Math.abs(t - lastTime) > 0.02) {
                  lastTime = t;
                  cb.current.onTime(t);
                }
                // Duration is often 0 until the video is cued, so it is
                // watched rather than read once at ready.
                const d = p.getDuration();
                if (typeof d === "number" && d > 0 && d !== lastDuration) {
                  lastDuration = d;
                  cb.current.onDuration(d);
                }
              }, 100);
            },
            onStateChange: (e) => {
              if (cancelled) return;

              /*
                BUFFERING is ignored entirely. It arrives constantly
                while scrubbing a match, and treating it as "stopped"
                would make the play button flicker on every seek.
              */
              if (e.data === BUFFERING) return;

              if (e.data === PLAYING) {
                // The resume a scrub asked for without meaning to.
                if (Date.now() < suppressPlayUntil) {
                  api?.pauseVideo();
                  return;
                }
                isPlaying = true;
                cb.current.onPlayingChange(true);
                return;
              }

              isPlaying = false;
              cb.current.onPlayingChange(false);
            },
            onError: (e) => {
              if (!cancelled) cb.current.onUnavailable(errorMessage(e.data));
            },
          },
        });
      })
      .catch((err: Error) => {
        if (!cancelled) cb.current.onUnavailable(err.message);
      });

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      // Guarded: destroy() throws if the iframe has already gone, which
      // happens when React unmounts the subtree before this runs.
      try {
        player?.destroy();
      } catch {
        /* already gone */
      }
    };
  }, [externalId]);

  return (
    <div className="relative aspect-video w-full [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:size-full">
      <div ref={mountRef} className="size-full" />
    </div>
  );
}
