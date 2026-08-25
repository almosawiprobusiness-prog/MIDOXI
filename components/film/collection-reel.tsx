"use client";

import { useEffect, useRef, useState } from "react";
import {
  Play, Pause, ChevronLeft, ChevronRight, X, TriangleAlert, PenLine, Film,
} from "lucide-react";
import { clipEnd, sentimentMeta, fmtTime, type ReelItem } from "@/lib/data/film-types";
import { atLabel, type Annotation } from "@/lib/data/annotation-types";
import { videoElementPlayer, type FilmPlayer } from "./film-player";
import { useFilmPlayer } from "./use-film-player";
import { YouTubeStage } from "./youtube-stage";
import { Telestration } from "./telestration";

/*
  A collection played end to end, across whatever footage it came from.

  The single-video reel could assume one source and never let go of it.
  This cannot: a collection is a THEME — every pressing correction this
  month — so its clips come from different matches, and consecutive
  clips can be an upload and a YouTube link.

  That is the whole difficulty, and it shows up in three places:

    · The player itself changes. A <video> and a YouTube iframe are
      different elements, so moving between them is a remount, not a
      property change. Both are keyed on the video so React does that
      swap rather than trying to reuse one as the other.

    · Playback cannot start until the new source says it is ready, and
      "ready" arrives asynchronously and differently for each. So the
      position to start at is PARKED in `pendingStart` and claimed by
      whichever ready handler fires.

    · Starting playback can be refused. A fresh element that was not
      created by a click is exactly what autoplay policy blocks, and a
      reel that silently stops is the worst outcome — so a refusal is
      caught and shown as a button rather than a stall.

  This is a presentation surface only. No composer, no pen: everything
  here is about showing work that already exists to somebody else.
*/

export function CollectionReel({
  name,
  items,
  annotations,
  onExit,
}: {
  name: string;
  items: ReelItem[];
  annotations: Annotation[];
  onExit: () => void;
}) {
  const shownDrawings = useRef<Set<string>>(new Set());
  /**
   * Where to start once the newly-mounted source announces itself.
   *
   * Armed with the FIRST clip from the outset, not left null. Mounting
   * is a source change like any other — it just has no previous clip to
   * have caused it — and without this the reel opened, loaded the
   * footage, and sat on frame zero forever because nothing had asked it
   * to go anywhere.
   */
  const pendingStart = useRef<number | null>(items[0]?.clip.startSeconds ?? null);

  const [at, setAt] = useState(0);
  const [viewing, setViewing] = useState<Annotation | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const item = items[at];
  const isYouTube = item?.video.source === "youtube";

  /*
    The shared playhead, keyed to the CURRENT item.

    `clampSeek` is off here and nowhere else: every other surface seeks
    inside a video it already has, but this one seeks into a source that
    has not loaded yet — at that moment the duration on hand still
    belongs to the PREVIOUS clip's video, and clamping to it would drag
    the start of a long clip back to the end of a short one.
  */
  const {
    videoRef,
    player,
    current,
    setCurrent,
    playing,
    setPlaying,
    videoHandlers,
    youtubeHandlers,
  } = useFilmPlayer({
    isYouTube: Boolean(isYouTube),
    sourceUrl: item?.video.url,
    clampSeek: false,
    onTime: (t) => reelTick(t),
    onPlayingChange: (v) => {
      // A drawing belongs to one frame; once the tape moves it is over
      // the wrong one.
      if (v) setViewing(null);
    },
  });

  const startPlayback = async () => {
    try {
      await player().play();
      setNeedsGesture(false);
    } catch {
      // Refused, not broken. Say so with a button.
      setNeedsGesture(true);
    }
  };

  /** Claimed by whichever source finishes loading. */
  const claimPendingStart = (p: FilmPlayer) => {
    const start = pendingStart.current;
    if (start == null) return;
    pendingStart.current = null;
    p.seek(start);
    setCurrent(start);
    void startPlayback();
  };

  /**
   * Move to a clip.
   *
   * `rearm` follows the single-video reel: a person jumping wants to
   * see the drawings again, the reel advancing on its own does not —
   * clips overlap, and re-arming there stops twice on the same mark.
   */
  const goTo = (index: number, rearm = true) => {
    const next = items[index];
    if (!next) return;

    if (rearm) shownDrawings.current.clear();
    setViewing(null);
    setSourceError(null);
    setNeedsGesture(false);

    const sameVideo = item?.video.id === next.video.id;
    setAt(index);

    if (sameVideo) {
      // No remount — seek and carry on.
      player().seek(next.clip.startSeconds);
      setCurrent(next.clip.startSeconds);
      void startPlayback();
      return;
    }

    /*
      A different video: the element below is keyed on the video id, so
      React is about to unmount this source and mount another. Nothing
      can be driven until that happens, so the position waits here.

      No handle to clear any more — the hook picks its player from the
      CURRENT item, so a handle belonging to the outgoing source can
      never be reached once `at` has moved.
    */
    pendingStart.current = next.clip.startSeconds;
    setCurrent(next.clip.startSeconds);
    // The incoming element fires no `pause`, so this is said explicitly.
    setPlaying(false);
  };

  /*
    What the reel does each time the playhead moves.

    A hoisted `function`, not a `const`, purely so the hook above can
    reference it: function declarations are initialised before any code
    in the scope runs, so there is no dead zone to fall into. Recording
    the playhead is the hook's job now; this is only the reel's part.
  */
  function reelTick(t: number) {
    if (!item) return;
    const end = clipEnd(item.clip);

    /*
      Drawings before the end, so a mark made in a clip's last second is
      not stepped over. The reel PAUSES and waits — this is the moment
      the presenter is talking through, and nothing auto-resumes.
    */
    const due = annotations.find(
      (a) =>
        a.videoId === item.video.id &&
        !shownDrawings.current.has(a.id) &&
        a.atSeconds >= item.clip.startSeconds &&
        a.atSeconds <= Math.min(t, end),
    );
    if (due) {
      shownDrawings.current.add(due.id);
      player().pause();
      setViewing(due);
      return;
    }

    if (t >= end) {
      if (at + 1 < items.length) goTo(at + 1, false);
      else onExit();
    }
  }

  // Keyboard. Same verbs as the in-video reel, so one thing is learned.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === " ") {
        e.preventDefault();
        if (playing) player().pause();
        else void startPlayback();
      } else if (e.key === "n" || e.key === "N") {
        goTo(at + 1);
      } else if (e.key === "p" || e.key === "P") {
        goTo(at - 1);
      } else if (e.key === "Escape") {
        onExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, playing, items.length, isYouTube]);

  if (!item) {
    return (
      <div className="panel p-6 text-center">
        <p className="text-sm text-text-dim">There is nothing in this collection to play.</p>
        <button
          onClick={onExit}
          className="mt-3 h-9 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-text"
        >
          Back
        </button>
      </div>
    );
  }

  const sm = sentimentMeta(item.clip.sentiment);
  const end = clipEnd(item.clip);
  // Progress through THIS clip, not through the whole match behind it.
  const through = Math.max(
    0,
    Math.min(1, (current - item.clip.startSeconds) / Math.max(0.1, end - item.clip.startSeconds)),
  );

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-line bg-black">
        {sourceError ? (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-ink-900 px-6 text-center">
            <span className="grid size-11 place-items-center rounded-lg border border-correction/40 bg-correction/10 text-correction">
              <TriangleAlert className="size-5" />
            </span>
            <p className="text-sm font-medium text-text-hi">This clip&apos;s footage would not load.</p>
            <p className="max-w-md text-sm leading-relaxed text-text-dim">
              {item.video.title} could not be opened. The rest of the reel is unaffected — skip on
              when you are ready.
            </p>
          </div>
        ) : (
          <div className="relative">
            {/*
              Keyed on the video, so moving between matches remounts the
              player instead of trying to re-point one at the other.
            */}
            {isYouTube && item.video.externalId ? (
              <YouTubeStage
                key={`yt-${item.video.id}`}
                externalId={item.video.externalId}
                {...youtubeHandlers}
                // Composed, not replaced: the hook stores the handle,
                // then this claims the position waiting for it.
                onReady={(p) => {
                  youtubeHandlers.onReady(p);
                  claimPendingStart(p);
                }}
                onUnavailable={(reason) => setSourceError(reason)}
              />
            ) : (
              <video
                key={`v-${item.video.id}`}
                ref={videoRef}
                src={item.video.url}
                className="aspect-video w-full bg-black"
                playsInline
                preload="auto"
                {...videoHandlers}
                onError={() => setSourceError("unplayable")}
                // Composed with the hook's: it records the length, then
                // this claims the position waiting on this source.
                onLoadedMetadata={(e) => {
                  videoHandlers.onLoadedMetadata(e);
                  claimPendingStart(videoElementPlayer(videoRef));
                }}
              />
            )}

            {viewing && (
              <>
                <Telestration
                  shapes={viewing.shapes}
                  tool="arrow"
                  color="correction"
                  readOnly
                />
                <div className="absolute left-3 top-3 flex max-w-[80%] items-start gap-2 rounded-lg border border-line bg-ink-900/90 px-3 py-2 backdrop-blur">
                  <div className="min-w-0">
                    <span className="data-mono text-[11px] text-signal-bright">
                      {atLabel(viewing.atSeconds)}
                    </span>
                    {viewing.note && (
                      <p className="mt-0.5 text-xs leading-relaxed text-text">{viewing.note}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setViewing(null)}
                    aria-label="Close drawing"
                    className="shrink-0 text-text-faint transition-colors hover:text-text-hi"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Progress through this clip. */}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-850">
        <div
          className="h-full rounded-full bg-signal transition-[width] duration-200"
          style={{ width: `${through * 100}%` }}
        />
      </div>

      <div className="mt-3 rounded-lg border border-signal-line bg-ink-900 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Film className="size-4 text-signal-bright" />
          <span className="label-tech !text-text">{name}</span>
          <span className="data-mono text-xs text-text-dim">
            {at + 1} of {items.length}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => goTo(at - 1)}
              disabled={at === 0}
              title="Previous clip (P)"
              aria-label="Previous clip"
              className="grid size-8 place-items-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-text disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => (playing ? player().pause() : void startPlayback())}
              aria-label={playing ? "Pause" : "Play"}
              className="grid size-8 place-items-center rounded-lg bg-signal text-white transition-colors hover:bg-signal-deep"
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
            <button
              onClick={() => goTo(at + 1)}
              disabled={at + 1 >= items.length}
              title="Next clip (N)"
              aria-label="Next clip"
              className="grid size-8 place-items-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-text disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              onClick={onExit}
              className="ml-1 h-8 rounded-lg border border-line px-2.5 text-xs text-text-dim transition-colors hover:border-line-strong hover:text-text"
            >
              Exit
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="data-mono text-xs text-signal-bright">
            {fmtTime(item.clip.startSeconds)}
          </span>
          <span className="text-sm font-medium text-text-hi">{item.clip.title}</span>
          {sm && (
            <span className="chip" style={{ color: sm.color, borderColor: sm.color }}>
              {sm.label}
            </span>
          )}
          {/*
            Which match this came from. In a themed collection that is
            not obvious from the footage, and it is the first thing
            somebody watching asks.
          */}
          <span className="truncate text-xs text-text-faint">· {item.video.title}</span>
        </div>

        {item.clip.note && (
          <p className="mt-2 text-sm leading-relaxed text-text-dim">{item.clip.note}</p>
        )}

        {viewing && !playing && (
          <p className="mt-2 flex items-center gap-2 text-xs text-signal-bright">
            <PenLine className="size-3.5" />
            Stopped on a drawing — press play or space to carry on.
          </p>
        )}

        {needsGesture && !viewing && (
          <p className="mt-2 text-xs text-review">
            Your browser would not start this clip on its own. Press play to carry on.
          </p>
        )}

        <p className="data-mono mt-2.5 select-none text-[10px] text-text-faint">
          space play · N/P next &amp; previous · esc leave reel
        </p>
      </div>
    </div>
  );
}
