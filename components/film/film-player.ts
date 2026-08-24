/*
  One transport, two very different players underneath.

  The film room drives an ordinary <video> for uploads and direct links,
  and a YouTube iframe for everything else. Those have nothing in common
  at the API level — one is a DOM element with properties you assign, the
  other is a sandboxed frame you post messages to — and the clip
  composer, the transport and the pen should not have to know which one
  they are talking to.

  So they talk to this instead. Four verbs is the whole surface, because
  four verbs is all the film room ever asked of the <video> element:
  play, pause, go to a time, change the speed. Everything else — where
  the playhead is, how long the tape is, whether it is running — flows
  the other way, as state, and is owned by the studio.
*/
export interface FilmPlayer {
  play(): void;
  pause(): void;
  /** Absolute position in seconds. */
  seek(seconds: number): void;
  setRate(rate: number): void;
}

/**
 * The <video> element as a FilmPlayer.
 *
 * Deliberately reads `ref.current` on every call rather than closing
 * over the element: React swaps the node when the source changes, and a
 * captured reference would go on driving a detached one.
 */
export function videoElementPlayer(
  ref: { current: HTMLVideoElement | null },
): FilmPlayer {
  return {
    play: () => void ref.current?.play(),
    pause: () => ref.current?.pause(),
    seek: (seconds) => {
      const el = ref.current;
      if (el) el.currentTime = seconds;
    },
    setRate: (rate) => {
      const el = ref.current;
      if (el) el.playbackRate = rate;
    },
  };
}
