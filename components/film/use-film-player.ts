"use client";

import { useEffect, useRef, useState } from "react";
import { videoElementPlayer, noopPlayer, type FilmPlayer } from "./film-player";

/*
  One playhead, however many rooms use it.

  `FilmPlayer` unified the VERBS — play, pause, seek, setRate — but every
  surface kept its own copy of the STATE around them: where the playhead
  is, how long the tape is, whether it is running, and the handlers that
  keep those true. Three copies of the same twenty lines.

  That is not a tidiness complaint. The stale-duration bug was fixed in
  the film studio and then found again, untouched, in Study Mode —
  because the fix was applied where it was found rather than where it
  lived. A fourth surface would have inherited it too.

  So the state lives here once, with the fix in it, and a caller gets
  handlers to spread onto whichever element it renders.
*/

export interface FilmPlayerState {
  /** Attach to the <video> element. Unused on YouTube. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Whoever is behind the glass right now. Safe before one exists. */
  player: () => FilmPlayer;
  current: number;
  duration: number;
  playing: boolean;
  setCurrent: (t: number) => void;
  setDuration: (d: number) => void;
  /**
   * Only for a caller that swaps sources mid-run. A freshly mounted
   * element fires no `pause`, so without this it would inherit the
   * previous source's state and show a Pause button over a stopped
   * video.
   */
  setPlaying: (v: boolean) => void;
  seek: (t: number) => void;
  togglePlay: () => void;
  /** Spread onto a <video>. */
  videoHandlers: {
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
    onDurationChange: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
    onTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
    onPlay: () => void;
    onPause: () => void;
  };
  /** Pass to <YouTubeStage>, minus onUnavailable which is the caller's. */
  youtubeHandlers: {
    onReady: (p: FilmPlayer) => void;
    onTime: (t: number) => void;
    onDuration: (d: number) => void;
    onPlayingChange: (v: boolean) => void;
  };
}

export function useFilmPlayer({
  isYouTube,
  sourceUrl,
  seededDuration,
  onTime,
  onPlayingChange,
  clampSeek = true,
}: {
  isYouTube: boolean;
  /** Only used to re-run setup when the source changes. */
  sourceUrl?: string;
  /** What the database thinks the length is. Often wrong — see below. */
  seededDuration?: number | null;
  /** Runs after the playhead is recorded. Where loops and reels live. */
  onTime?: (t: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  /**
   * Hold seeks inside the known duration. A collection reel turns this
   * off: it seeks into a source that has not loaded yet, where the
   * duration on hand still belongs to the previous clip's video.
   */
  clampSeek?: boolean;
}): FilmPlayerState {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytPlayer = useRef<FilmPlayer | null>(null);

  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(seededDuration ?? 0);
  const [playing, setPlaying] = useState(false);

  /*
    Chosen from what is on screen NOW, never from whichever handle was
    stored last — a stale one would seek footage that is no longer
    mounted, which is exactly what a collection reel does on every
    source swap.
  */
  const player = (): FilmPlayer =>
    isYouTube ? (ytPlayer.current ?? noopPlayer) : videoElementPlayer(videoRef);

  /*
    THE BUG THIS HOOK EXISTS TO KILL.

    `onLoadedMetadata` is not enough on its own. With preload="metadata"
    the browser can finish reading the header BEFORE React hydrates and
    attaches that handler, and the event is gone by the time anyone is
    listening — so the seeded duration stands forever.

    That is not cosmetic. Seeking clamps to `duration`, so a stale one
    walls off everything past it. Measured twice, in two different
    rooms: a 60.1s video with the bar pinned at 15 and a seek to 0:45
    landing on 0:15. Three quarters of the film unreachable.

    So the value is PULLED rather than waited for.
  */
  useEffect(() => {
    if (isYouTube) return;
    const el = videoRef.current;
    if (!el) return;
    if (el.readyState >= 1 && Number.isFinite(el.duration) && el.duration > 0) {
      setDuration(el.duration);
    }
  }, [isYouTube, sourceUrl]);

  const takeDuration = (d: number) => {
    if (Number.isFinite(d) && d > 0) setDuration(d);
  };

  const handleTime = (t: number) => {
    setCurrent(t);
    onTime?.(t);
  };

  const handlePlaying = (v: boolean) => {
    setPlaying(v);
    onPlayingChange?.(v);
  };

  const seek = (t: number) => {
    const target = clampSeek ? Math.max(0, Math.min(t, duration || t)) : Math.max(0, t);
    player().seek(target);
    /*
      Set optimistically as well as actually. A <video> reports back
      within a frame, but YouTube is polled every 100ms — long enough
      that a frame nudge felt like it had not registered, and long
      enough for a second click to compute its step from a stale
      position.
    */
    setCurrent(target);
  };

  const togglePlay = () => {
    if (playing) player().pause();
    else void player().play();
  };

  return {
    videoRef,
    player,
    current,
    duration,
    playing,
    setCurrent,
    setDuration,
    setPlaying,
    seek,
    togglePlay,
    videoHandlers: {
      onLoadedMetadata: (e) => takeDuration(e.currentTarget.duration),
      onDurationChange: (e) => takeDuration(e.currentTarget.duration),
      onTimeUpdate: (e) => handleTime(e.currentTarget.currentTime),
      onPlay: () => handlePlaying(true),
      onPause: () => handlePlaying(false),
    },
    youtubeHandlers: {
      onReady: (p) => {
        ytPlayer.current = p;
      },
      onTime: handleTime,
      onDuration: takeDuration,
      onPlayingChange: handlePlaying,
    },
  };
}
