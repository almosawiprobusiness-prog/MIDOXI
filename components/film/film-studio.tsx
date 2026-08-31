"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Play, Pause, Rewind, FastForward, ChevronLeft, ChevronRight,
  Scissors, Star, Trash2, Loader2, Flag, Film, TriangleAlert, PenLine, X, Repeat, Download, ListVideo, Send, Sparkles,
} from "lucide-react";
import {
  createClip, deleteClip, toggleClipFavorite,
} from "@/app/app/film-room/actions";
import { createPost } from "@/app/app/community/feed-actions";
import {
  createAnnotation, removeAnnotation,
} from "@/app/app/film-room/annotation-actions";
import {
  SENTIMENTS, CLIP_TAGS, sentimentMeta, fmtTime, LONG_FOOTAGE_ADVICE, isHlsUrl,
  reelOrder, clipEnd,
  type Video, type FilmClip, type ClipSentiment, type ClipInput,
} from "@/lib/data/film-types";
import {
  NOTE_MAX, atLabel,
  type Annotation, type AnnotationColor, type Shape, type ToolKind,
} from "@/lib/data/annotation-types";
import { AddToCollection } from "./add-to-collection";
import { FilmReading } from "./film-reading";
import { Telestration, TelestrationTools } from "./telestration";
import { useFilmPlayer } from "./use-film-player";
import { YouTubeStage } from "./youtube-stage";
import { exportBoard, exportMidoFrame, boardFilename, saveBlob } from "./capture";
import type { ClipAnalysis } from "@/lib/data/analyses";

const SPEEDS = [0.5, 1, 1.5, 2];

export function FilmStudio({
  video,
  clips,
  goals,
  analyses = [],
  annotations = [],
}: {
  video: Video;
  clips: FilmClip[];
  goals: { id: string; title: string }[];
  analyses?: ClipAnalysis[];
  annotations?: Annotation[];
}) {
  const router = useRouter();
  const isYouTube = video.source === "youtube";

  /*
    Whichever player is behind the glass, addressed the same way — and
    the playhead around it, owned in one place rather than three.

    For an upload or a direct link this wraps the <video> element. For
    YouTube it is handed over by the embed once its message channel is
    open. Everything below — the transport, mark in/out, the pen, the
    reel — speaks only to this, which is why one set of controls drives
    both instead of YouTube getting a stripped-down page.
  */
  const {
    videoRef,
    player,
    current,
    duration,
    playing,
    seek,
    togglePlay,
    videoHandlers,
    youtubeHandlers,
  } = useFilmPlayer({
    isYouTube,
    sourceUrl: video.url,
    seededDuration: video.durationSeconds,
    onTime: (t) => tick(t),
    onPlayingChange: (v) => {
      // A drawing belongs to one frame. Once the footage is moving
      // again it is over the wrong one, so it goes.
      if (v) setViewing(null);
    },
  });
  /*
    Whether the player has given up on this source.

    An `error` handler alone is not enough, which was worth finding out
    by measurement rather than assuming: pointed at a page URL, Chrome
    sat at `networkState=2, readyState=0` for twenty seconds and never
    fired `error` at all. The request simply hangs. So the whole failure
    was a black rectangle and a 0:00 timeline — indistinguishable from
    footage that has not started, which is why somebody waits for it
    instead of fixing the link.

    Set by either route: the error event when it comes, or the timeout
    when nothing arrives at all.
  */
  const [unplayable, setUnplayable] = useState(false);
  /*
    YouTube says WHY it refused — embedding disabled, private, deleted —
    and that sentence is worth keeping. "Embedding is turned off for
    this video" and "your link is wrong" send somebody to fix two
    completely different things.
  */
  const [unplayableReason, setUnplayableReason] = useState<string | null>(null);
  const [rate, setRate] = useState(1);

  // clip composer
  const [markIn, setMarkIn] = useState<number | null>(null);
  const [markOut, setMarkOut] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [sentiment, setSentiment] = useState<ClipSentiment | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [goalId, setGoalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    Drawing on the frame.

    Two modes, never both: `drawing` puts a live canvas over a paused
    picture, `viewing` puts a saved one back over the frame it was made
    on. Keeping them as separate pieces of state rather than one
    "annotation mode" is what stops a saved drawing being edited by
    accident — the read-only overlay cannot receive a pointer at all.
  */
  const [drawing, setDrawing] = useState(false);
  const [shapes, setShapes] = useState<Shape[]>([]);
  /*
    What undo removed, so redo can put it back. Any NEW mark clears it —
    the branch that was undone and then drawn over no longer exists,
    which is how every drawing tool resolves that fork.
  */
  const [redoStack, setRedoStack] = useState<Shape[]>([]);
  const [tool, setTool] = useState<ToolKind>("arrow");
  const [penColor, setPenColor] = useState<AnnotationColor>("correction");
  /** The word the text tool stamps on the frame. */
  const [cueText, setCueText] = useState("");
  const [drawNote, setDrawNote] = useState("");
  const [drawBusy, setDrawBusy] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Annotation | null>(null);
  /** Posting the board to the community — its own lane, its own message. */
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState<string | null>(null);

  const changeShapes = (next: Shape[]) => {
    setShapes(next);
    setRedoStack([]);
  };
  const undoShape = () => {
    setShapes((s) => {
      if (s.length === 0) return s;
      setRedoStack((r) => [...r, s[s.length - 1]]);
      return s.slice(0, -1);
    });
  };
  const redoShape = () => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      setShapes((s) => [...s, r[r.length - 1]]);
      return r.slice(0, -1);
    });
  };

  // Saving a board to disk, and looping the marked range.
  const [saving, setSaving] = useState(false);
  /*
    Its own error rather than the composer's. An export can be started
    from the drawing bar OR from a saved row, and `drawError` only
    renders while drawing — so a failure from the list would have gone
    nowhere at all.
  */
  const [saveError, setSaveError] = useState<string | null>(null);
  const [looping, setLooping] = useState(false);

  /*
    The reel: clips played end to end, the way a session is presented.

    `reelAt` is an index rather than a clip, so the reel survives a
    refresh that reorders or renames what is in it. Null means not in a
    reel at all.
  */
  const [reelAt, setReelAt] = useState<number | null>(null);
  /*
    Which drawings this pass has already stopped on. A ref, not state:
    it is read and written inside the playhead handler and must not
    cause a render — a set that triggered one on every mark would
    re-enter the handler mid-pause.
  */
  const shownDrawings = useRef<Set<string>>(new Set());

  const isHls = !isYouTube && isHlsUrl(video.url);

  /*
    HLS, for the streams most sports platforms actually serve.

    A `.m3u8` is a playlist. Every browser except Safari needs it fed
    through Media Source Extensions, which is what hls.js does — so it is
    imported ONLY when one turns up, keeping it out of the bundle for the
    ordinary mp4 and YouTube cases.

    Modern Safari is deliberately left to play these natively: its own
    implementation handles them better than MSE does, and hls.js's own
    documentation says to prefer it where `ManagedMediaSource` exists.

    Note the `src` attribute is withheld for HLS below. Setting it would
    have the browser try to decode the playlist as a media file, fail,
    and trip the error handler before hls.js ever attached.
  */
  useEffect(() => {
    if (isYouTube || unplayable || !isHls) return;
    const el = videoRef.current;
    if (!el) return;

    if (el.canPlayType("application/vnd.apple.mpegurl") && "ManagedMediaSource" in window) {
      el.src = video.url;
      return;
    }

    let cancelled = false;
    let instance: { destroy: () => void } | null = null;

    import("hls.js")
      .then(({ default: Hls }) => {
        if (cancelled || !videoRef.current) return;
        if (!Hls.isSupported()) {
          setUnplayable(true);
          return;
        }
        const hls = new Hls();
        instance = hls;
        hls.loadSource(video.url);
        hls.attachMedia(videoRef.current);
        // Only `fatal` matters — hls.js recovers from the rest by itself,
        // and surfacing those would report a failure that did not happen.
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) setUnplayable(true);
        });
      })
      .catch(() => setUnplayable(true));

    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [isYouTube, isHls, unplayable, video.url, videoRef]);

  /*
    Give up waiting after this long with nothing at all.

    Fifteen seconds is past any reasonable wait for METADATA — which is
    a header read, not the footage — while still leaving room for a large
    file on a poor connection. `readyState === 0` is the guard that keeps
    it honest: if even one frame's worth of information has arrived the
    source is real and this never fires, however slow the rest of it is.
    And a retry is offered rather than the decision being final.
  */
  useEffect(() => {
    if (isYouTube || unplayable) return;
    const timer = setTimeout(() => {
      if (videoRef.current?.readyState === 0) setUnplayable(true);
    }, 15_000);
    return () => clearTimeout(timer);
  }, [isYouTube, unplayable, video.url, videoRef]);

  // `seek` and `togglePlay` come from the shared hook now.
  const nudge = (delta: number) => seek(current + delta);
  const setSpeed = (r: number) => {
    setRate(r);
    player().setRate(r);
  };

  const playClip = (c: FilmClip) => {
    seek(c.startSeconds);
    player().play();
  };

  // ── the reel ──

  /*
    Up the tape, earliest first — see `reelOrder`. Computed rather than
    stored so adding a clip mid-session lands in the right place
    without a reel needing to be rebuilt.
  */
  const reel = reelOrder(clips);
  const reelClip = reelAt == null ? null : (reel[reelAt] ?? null);

  /**
   * Move the reel to a clip.
   *
   * `rearm` decides whether drawings already shown will stop the reel
   * again, and the two callers want opposite things.
   *
   * A PERSON jumping — pressing next, or stepping back — is doing it to
   * look at something again, so everything is re-armed. The reel
   * ADVANCING on its own is not: clips routinely overlap (an unmarked
   * clip runs eight seconds, and two cut ten seconds apart share half
   * their length), so re-arming there would stop twice on the same
   * drawing in one pass and read as a bug.
   */
  const jumpToReelClip = (index: number, rearm = true) => {
    const clip = reel[index];
    if (!clip) return;
    if (rearm) shownDrawings.current.clear();
    setReelAt(index);
    setViewing(null);
    seek(clip.startSeconds);
    player().play();
  };

  const startReel = () => {
    if (reel.length === 0) return;
    // A loop and a reel both decide where playback goes next, and two
    // things deciding that is one too many.
    setLooping(false);
    setDrawing(false);
    jumpToReelClip(0);
  };

  const exitReel = () => {
    setReelAt(null);
    setViewing(null);
    shownDrawings.current.clear();
    player().pause();
  };

  /*
    The playhead moved.

    Both sources funnel through here — a <video> firing timeupdate and a
    YouTube embed polled every 100ms — which is also where the loop and
    the reel live. Deliberately NOT an effect watching `current`: that
    reacts to the new position by setting state again, which is a
    cascading render on every frame of playback. This is the event
    itself, handled once.
  */
  /*
    What the studio does each time the playhead moves — the loop and the
    reel. Recording the position is the hook's job now.

    A hoisted `function`, not a `const`, purely so the hook above can
    reference it: function declarations are initialised before any code
    in the scope runs, so there is no dead zone to fall into.
  */
  function tick(t: number) {
    if (looping && markIn != null && markOut != null && markOut > markIn && t >= markOut) {
      seek(markIn);
      return;
    }

    if (reelAt != null && reelClip) {
      const end = clipEnd(reelClip);

      /*
        Stop on a drawing before checking the end, so a mark made in
        the last second of a clip is not skipped over.

        The reel PAUSES and waits rather than flashing the drawing past
        — a drawing belongs to one frame, and this is the moment the
        presenter is talking over. Nothing auto-resumes: being cut off
        mid-sentence in front of a squad is worse than one more click.
      */
      const due = annotations.find(
        (a) =>
          !shownDrawings.current.has(a.id) &&
          a.atSeconds >= reelClip.startSeconds &&
          a.atSeconds <= Math.min(t, end),
      );
      if (due) {
        shownDrawings.current.add(due.id);
        player().pause();
        setViewing(due);
        return;
      }

      if (t >= end) {
        // Advancing on its own — drawings already shown this pass stay
        // shown. See the note on `jumpToReelClip`.
        if (reelAt + 1 < reel.length) jumpToReelClip(reelAt + 1, false);
        else exitReel();
      }
      return;
    }
  }

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const resetComposer = () => {
    setMarkIn(null); setMarkOut(null); setTitle(""); setSentiment(null);
    setTags([]); setNote(""); setGoalId("");
  };

  const save = async () => {
    if (!title.trim() || markIn == null) return;
    setBusy(true);
    setError(null);
    const input: ClipInput = {
      videoId: video.id,
      title: title.trim(),
      startSeconds: markIn,
      endSeconds: markOut,
      sentiment,
      note,
      tags,
      goalId: goalId || null,
      matchId: video.matchId ?? null,
    };
    const res = await createClip(input);
    setBusy(false);
    if (res.ok) {
      resetComposer();
      router.refresh();
    } else setError(res.error);
  };

  const removeClip = async (id: string) => {
    await deleteClip(id, video.id);
    router.refresh();
  };
  const favClip = async (id: string) => {
    await toggleClipFavorite(id, video.id);
    router.refresh();
  };

  // ── drawing ──

  const startDrawing = () => {
    // The freeze-frame. Nothing more elaborate is needed: a paused
    // player is already holding exactly the frame being drawn on —
    // which is as true of a YouTube embed as of a <video>.
    player().pause();
    setViewing(null);
    setShapes([]);
    setRedoStack([]);
    setDrawNote("");
    setDrawError(null);
    setPosted(null);
    setDrawing(true);
  };

  const stopDrawing = () => {
    setDrawing(false);
    setShapes([]);
    setRedoStack([]);
    setDrawNote("");
    setDrawError(null);
  };

  const saveDrawing = async () => {
    if (shapes.length === 0) return;
    setDrawBusy(true);
    setDrawError(null);
    // `current` rather than a time captured when drawing began: the frame
    // showing underneath is the frame this belongs to, including after a
    // nudge to find the exact one.
    const res = await createAnnotation({
      videoId: video.id,
      atSeconds: current,
      shapes,
      note: drawNote,
    });
    setDrawBusy(false);
    if (!res.ok) {
      setDrawError(res.error);
      return;
    }
    stopDrawing();
    router.refresh();
  };

  const showAnnotation = (a: Annotation) => {
    if (viewing?.id === a.id) {
      setViewing(null);
      return;
    }
    setDrawing(false);
    seek(a.atSeconds);
    player().pause();
    setViewing(a);
  };

  /*
    Keyboard.

    The difference between a video tool people tolerate and one they
    live in. Reviewing a match is hundreds of small movements — back a
    touch, forward a touch, mark, back again — and doing that with a
    mouse is what makes an hour of film feel like an hour of admin.

    Deliberately invisible: no new controls, and the keys are named in
    the tooltips of the buttons they mirror plus one muted line under
    the transport. Nothing here fires while a field has focus, or a
    coach typing "I noticed" into a clip note would mark in twice.
  */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        // Undo the last mark, matching every drawing tool ever made.
        if (drawing && e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (e.shiftKey) redoShape();
          else undoShape();
        }
        return;
      }
      if (e.altKey) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (!drawing) togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          nudge(e.shiftKey ? -5 : -0.1);
          break;
        case "ArrowRight":
          e.preventDefault();
          nudge(e.shiftKey ? 5 : 0.1);
          break;
        case "i":
        case "I":
          setMarkIn(current);
          break;
        case "o":
        case "O":
          setMarkOut(current);
          break;
        case "l":
        case "L":
          // Only meaningful once a range exists; silently ignored
          // otherwise rather than turning on an invisible mode.
          if (markIn != null && markOut != null && markOut > markIn) {
            setLooping((v) => !v);
          }
          break;
        case "d":
        case "D":
          if (!unplayable) (drawing ? stopDrawing : startDrawing)();
          break;
        case "Escape":
          if (drawing) stopDrawing();
          else if (reelAt != null) exitReel();
          else if (viewing) setViewing(null);
          break;
        // Reel navigation. Only bound while one is running, so N and P
        // stay free everywhere else.
        case "n":
        case "N":
          if (reelAt != null) jumpToReelClip(reelAt + 1);
          break;
        case "p":
        case "P":
          if (reelAt != null) jumpToReelClip(reelAt - 1);
          break;
        // Tools, while drawing. Free to add, and the order matches the bar.
        case "1":
          if (drawing) setTool("arrow");
          break;
        case "2":
          if (drawing) setTool("ellipse");
          break;
        case "3":
          if (drawing) setTool("pen");
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing, viewing, playing, current, duration, unplayable, markIn, markOut, reelAt]);

  /*
    Save the board.

    Exports whatever is on the glass right now — the frame plus the
    marks — as a PNG with a caption strip. This is how a drawing leaves
    the app: into a message to the player it is about.

    Refused on YouTube before anything is attempted, because the
    picture lives inside another origin's iframe and no page can read
    those pixels. Saying so up front beats a SecurityError.
  */
  const saveBoard = async (atSeconds: number, marks: Shape[], caption: string | null) => {
    if (isYouTube) {
      setSaveError(
        "A YouTube frame cannot be saved as an image — the picture belongs to YouTube's player, and this page cannot read it. Uploaded and direct-link footage saves fine.",
      );
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const blob = await exportBoard({
        videoUrl: video.url,
        title: video.title,
        atSeconds,
        shapes: marks,
        note: caption,
      });
      saveBlob(blob, boardFilename(video.title, atSeconds));
    } catch (e) {
      setSaveError(
        e instanceof DOMException && e.name === "SecurityError"
          ? "This film is served without the permissions needed to read its frames, so it cannot be saved as an image. Uploaded footage saves fine."
          : e instanceof Error
            ? e.message
            : "The image could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  /*
    The branded lane. Same frame, same marks, dressed as a MIDO artifact
    at the feed's native 1080×1350 — the version a player posts, where
    the clean export is the version a coach files.
  */
  const saveMidoFrame = async (atSeconds: number, marks: Shape[], caption: string | null) => {
    if (isYouTube) {
      setSaveError("A YouTube frame cannot be read out of the embed, so there is nothing to dress up.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const blob = await exportMidoFrame({
        videoUrl: video.url,
        title: video.title,
        atSeconds,
        shapes: marks,
        note: caption,
      });
      saveBlob(blob, boardFilename(video.title, atSeconds).replace(/\.png$/, "-mido.png"));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "The image could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  /*
    Frame → feed, in one step. The board (frame + marks + caption strip)
    becomes a community post with kind "film" — the exact content the
    community exists for: player thinking, visible.
  */
  const postBoard = async (atSeconds: number, marks: Shape[], caption: string | null) => {
    if (isYouTube) {
      setSaveError("A YouTube frame cannot be read out of the embed, so it cannot be posted as an image.");
      return;
    }
    setPosting(true);
    setSaveError(null);
    setPosted(null);
    try {
      const blob = await exportBoard({
        videoUrl: video.url,
        title: video.title,
        atSeconds,
        shapes: marks,
        note: caption,
      });
      const bmp = await createImageBitmap(blob);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error("The image could not be read back."));
        r.readAsDataURL(blob);
      });
      const res = await createPost({
        caption: caption?.trim() || "",
        media: dataUrl,
        mediaWidth: bmp.width,
        mediaHeight: bmp.height,
        kind: "film",
        tags: ["film"],
      });
      if (!res.ok) setSaveError(res.error);
      else setPosted("Posted to the community.");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "The post could not be created.");
    } finally {
      setPosting(false);
    }
  };

  const dropAnnotation = async (a: Annotation) => {
    if (viewing?.id === a.id) setViewing(null);
    await removeAnnotation(a.id, video.id);
    router.refresh();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      {/* ── Player + composer ── */}
      <div className="min-w-0">
        <div className="overflow-hidden rounded-xl border border-line bg-black">
          {unplayable ? (
            /*
              Says what happened and what to do about it. The link is
              shown because the usual cause is that it points at a page
              rather than a file, and seeing it back is what makes that
              obvious.
            */
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-ink-900 px-6 text-center">
              <span className="grid size-11 place-items-center rounded-lg border border-correction/40 bg-correction/10 text-correction">
                <TriangleAlert className="size-5" />
              </span>
              <p className="text-sm font-medium text-text-hi">This video would not load.</p>
              <p className="max-w-md text-sm leading-relaxed text-text-dim">
                {/*
                  YouTube's own reason when there is one. It knows things
                  this page cannot infer — that embedding is switched
                  off, that the video was deleted — and repeating its
                  answer beats guessing at a cause.
                */}
                {unplayableReason ??
                  "MIDO could not open the link saved for this video. That usually means it points at a page to watch on rather than at a video file."}
              </p>
              {video.url && (
                <code className="max-w-full truncate rounded border border-line bg-ink-850 px-2 py-1 text-[11px] text-text-faint">
                  {video.url}
                </code>
              )}
              {!unplayableReason && (
                <p className="max-w-md text-xs leading-relaxed text-text-faint">{LONG_FOOTAGE_ADVICE}</p>
              )}
              <button
                onClick={() => {
                  setUnplayableReason(null);
                  setUnplayable(false);
                }}
                className="mt-1 h-9 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-text"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="relative">
              {isYouTube && video.externalId ? (
                <YouTubeStage
                  externalId={video.externalId}
                  {...youtubeHandlers}
                  onUnavailable={(reason) => {
                    setUnplayableReason(reason);
                    setUnplayable(true);
                  }}
                />
              ) : (
                <video
                  ref={videoRef}
                  // Withheld for HLS: hls.js attaches the stream itself, and a
                  // playlist set as `src` would fail to decode before it could.
                  src={isHls ? undefined : video.url}
                  className="aspect-video w-full bg-black"
                  playsInline
                  preload="metadata"
                  {...videoHandlers}
                  onError={() => setUnplayable(true)}
                />
              )}

              {(drawing || viewing) && (
                <Telestration
                  shapes={drawing ? shapes : viewing!.shapes}
                  onChange={drawing ? changeShapes : undefined}
                  tool={tool}
                  color={penColor}
                  readOnly={!drawing}
                />
              )}

              {viewing && (
                <div className="absolute left-3 top-3 flex max-w-[80%] items-start gap-2 rounded-lg border border-line bg-ink-900/90 px-3 py-2 backdrop-blur">
                  <div className="min-w-0">
                    <span className="data-mono text-[11px] text-signal-bright">{atLabel(viewing.atSeconds)}</span>
                    {viewing.note && <p className="mt-0.5 text-xs leading-relaxed text-text">{viewing.note}</p>}
                  </div>
                  <button
                    onClick={() => setViewing(null)}
                    aria-label="Close drawing"
                    className="shrink-0 text-text-faint transition-colors hover:text-text-hi"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/*
          The reel bar. Replaces nothing — it sits above the transport,
          because a presenter still wants to scrub when somebody asks
          "can you go back to the throw-in".
        */}
        {reelClip && reelAt != null && (
          <div className="mt-3 rounded-lg border border-signal-line bg-ink-900 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <ListVideo className="size-4 text-signal-bright" />
              <span className="label-tech !text-text">Reel</span>
              <span className="data-mono text-xs text-text-dim">
                {reelAt + 1} of {reel.length}
              </span>
              <span className="truncate text-sm font-medium text-text-hi">{reelClip.title}</span>
              {(() => {
                const sm = sentimentMeta(reelClip.sentiment);
                return sm ? (
                  <span className="chip" style={{ color: sm.color, borderColor: sm.color }}>
                    {sm.label}
                  </span>
                ) : null;
              })()}

              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => jumpToReelClip(reelAt - 1)}
                  disabled={reelAt === 0}
                  title="Previous clip (P)"
                  aria-label="Previous clip"
                  className="grid size-8 place-items-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-text disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={togglePlay}
                  aria-label={playing ? "Pause reel" : "Continue reel"}
                  className="grid size-8 place-items-center rounded-lg bg-signal text-white transition-colors hover:bg-signal-deep"
                >
                  {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                </button>
                <button
                  onClick={() => jumpToReelClip(reelAt + 1)}
                  disabled={reelAt + 1 >= reel.length}
                  title="Next clip (N)"
                  aria-label="Next clip"
                  className="grid size-8 place-items-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-text disabled:opacity-40"
                >
                  <ChevronRight className="size-4" />
                </button>
                <button
                  onClick={exitReel}
                  className="ml-1 h-8 rounded-lg border border-line px-2.5 text-xs text-text-dim transition-colors hover:border-line-strong hover:text-text"
                >
                  Exit
                </button>
              </div>
            </div>

            {reelClip.note && (
              <p className="mt-2 text-sm leading-relaxed text-text-dim">{reelClip.note}</p>
            )}

            {/*
              Said out loud, because a reel that stops on its own looks
              broken if you do not know it is meant to.
            */}
            {viewing && !playing && (
              <p className="mt-2 flex items-center gap-2 text-xs text-signal-bright">
                <PenLine className="size-3.5" />
                Stopped on a drawing — press play or space to carry on.
              </p>
            )}
          </div>
        )}

        {/*
          One set of tools, both sources. These used to be fenced off
          behind `!isYouTube`, because the transport could only drive a
          <video> element. Now that the embed answers the same four
          verbs, there is nothing left to fence.
        */}
            {/* Transport */}
            <div className="mt-3 rounded-lg border border-line bg-ink-900 p-3">
              <div className="flex items-center gap-3">
                <span className="data-mono text-sm text-signal-bright">{fmtTime(current)}</span>

                {/*
                  The tape, with everything already found on it.

                  Ticks for clips and drawings turn the scrubber from a
                  position into a map: you can see that the second half
                  has three marks and the first has none without opening
                  anything. They are `pointer-events-none` so the bar
                  underneath still takes the drag.
                */}
                <div className="relative flex-1">
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.05}
                    value={current}
                    onChange={(e) => seek(Number(e.target.value))}
                    className="mido-range w-full"
                    aria-label="Seek"
                  />
                  {duration > 0 && (
                    <div className="pointer-events-none absolute inset-x-0 -bottom-1.5 h-1.5">
                      {clips.map((c) => {
                        const sm = sentimentMeta(c.sentiment);
                        return (
                          <span
                            key={`c-${c.id}`}
                            className="absolute top-0 h-1.5 w-[2px] rounded-full"
                            style={{
                              left: `${Math.min(100, (c.startSeconds / duration) * 100)}%`,
                              background: sm?.color ?? "var(--text-faint)",
                            }}
                          />
                        );
                      })}
                      {annotations.map((a) => (
                        <span
                          key={`a-${a.id}`}
                          className="absolute top-0 size-1.5 rounded-full"
                          style={{
                            left: `${Math.min(100, (a.atSeconds / duration) * 100)}%`,
                            background: "var(--signal-bright)",
                          }}
                        />
                      ))}
                      {/* The marked range, while one is being cut. */}
                      {markIn != null && markOut != null && markOut > markIn && (
                        <span
                          className="absolute top-0.5 h-[3px] rounded-full bg-signal/60"
                          style={{
                            left: `${(markIn / duration) * 100}%`,
                            width: `${Math.max(0.5, ((markOut - markIn) / duration) * 100)}%`,
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>

                <span className="data-mono text-sm text-text-dim">{fmtTime(duration)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Ctrl onClick={() => nudge(-5)} label="Back 5s"><Rewind className="size-4" /></Ctrl>
                  <Ctrl onClick={() => nudge(-0.1)} label="Frame back"><ChevronLeft className="size-4" /></Ctrl>
                  <button
                    onClick={togglePlay}
                    disabled={drawing}
                    aria-label={playing ? "Pause" : "Play"}
                    title={drawing ? "Held still while you draw" : playing ? "Pause" : "Play"}
                    className="grid size-10 place-items-center rounded-lg bg-signal text-white transition-colors hover:bg-signal-deep disabled:opacity-40"
                  >
                    {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
                  </button>
                  <Ctrl onClick={() => nudge(0.1)} label="Frame forward"><ChevronRight className="size-4" /></Ctrl>
                  <Ctrl onClick={() => nudge(5)} label="Forward 5s"><FastForward className="size-4" /></Ctrl>
                </div>
                <div className="flex items-center gap-1">
                  {SPEEDS.map((s) => (
                    <button key={s} onClick={() => setSpeed(s)} className={`data-mono rounded-md px-2 py-1 text-xs transition-colors ${rate === s ? "bg-signal/15 text-signal-bright" : "text-text-dim hover:text-text"}`}>
                      {s}×
                    </button>
                  ))}
                  <button
                    onClick={drawing ? stopDrawing : startDrawing}
                    disabled={unplayable}
                    title="Freeze the frame and draw on it"
                    className={`ml-1 flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors disabled:opacity-40 ${
                      drawing
                        ? "border-signal-line bg-signal/10 text-signal-bright"
                        : "border-line text-text-dim hover:border-signal-line hover:text-text"
                    }`}
                  >
                    <PenLine className="size-3.5" /> {drawing ? "Done" : "Draw"}
                  </button>
                </div>
              </div>

              {/*
                The keys, said once, quietly. A tool with shortcuts
                nobody is told about has no shortcuts.
              */}
              <p className="data-mono mt-2.5 select-none text-[10px] leading-relaxed text-text-faint">
                {reelAt != null
                  ? "space play · N/P next & previous clip · ←→ frame · esc leave reel"
                  : "space play · ←→ frame · shift ←→ 5s · I/O mark · L loop · D draw · esc exit"}
              </p>
            </div>

            {/* Drawing bar — only while drawing, so it is never in the way */}
            {drawing && (
              <div className="mt-3 rounded-lg border border-signal-line bg-ink-900 p-3">
                <div className="mb-3 flex items-center gap-2">
                  <PenLine className="size-4 text-signal-bright" />
                  <span className="label-tech !text-text">Drawing on</span>
                  <span className="data-mono text-xs text-signal-bright">{atLabel(current)}</span>
                  <span className="text-xs text-text-faint">— the frame is held while you draw</span>
                </div>

                <TelestrationTools
                  tool={tool}
                  setTool={setTool}
                  color={penColor}
                  setColor={setPenColor}
                  onUndo={undoShape}
                  onRedo={redoShape}
                  canRedo={redoStack.length > 0}
                  onClear={() => changeShapes([])}
                  label={cueText}
                  setLabel={setCueText}
                  count={shapes.length}
                />

                <input
                  value={drawNote}
                  onChange={(e) => setDrawNote(e.target.value.slice(0, NOTE_MAX))}
                  placeholder="What is this showing? — e.g. Step in earlier, the space is behind him"
                  className={`${inp} mt-3`}
                />

                {drawError && <p className="mt-2 text-sm text-correction">{drawError}</p>}
                {saveError && <p className="mt-2 text-sm text-correction">{saveError}</p>}
                {posted && <p className="mt-2 text-sm text-positive">{posted}</p>}

                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={saveDrawing}
                    disabled={drawBusy || shapes.length === 0}
                    className="flex h-10 items-center gap-2 rounded-lg bg-signal px-4 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
                  >
                    {drawBusy ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />}
                    Save drawing
                  </button>
                  {/*
                    Save without saving. This exports what is on the
                    glass right now, drawn or not, so it doubles as
                    "grab this frame" — one button rather than two that
                    would need explaining apart.
                  */}
                  <button
                    onClick={() => saveBoard(current, shapes, drawNote)}
                    disabled={saving || isYouTube}
                    title={
                      isYouTube
                        ? "A YouTube frame cannot be read out of the embed"
                        : "Save this frame and the drawing as an image"
                    }
                    className="flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-text disabled:opacity-40"
                  >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    Save image
                  </button>
                  <button
                    onClick={() => saveMidoFrame(current, shapes, drawNote)}
                    disabled={saving || isYouTube}
                    title={
                      isYouTube
                        ? "A YouTube frame cannot be read out of the embed"
                        : "Save a branded MIDO artifact of this frame — 1080×1350, ready to post anywhere"
                    }
                    className="flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-text disabled:opacity-40"
                  >
                    <Sparkles className="size-4" />
                    MIDO frame
                  </button>
                  <button
                    onClick={() => postBoard(current, shapes, drawNote)}
                    disabled={posting || isYouTube}
                    title={
                      isYouTube
                        ? "A YouTube frame cannot be read out of the embed"
                        : "Post this frame and drawing to the MIDO community"
                    }
                    className="flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-text disabled:opacity-40"
                  >
                    {posting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Post to community
                  </button>
                  <button
                    onClick={stopDrawing}
                    className="h-10 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:border-line-strong hover:text-text"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            {/* Clip composer */}
            <div className="mt-3 rounded-lg border border-line bg-ink-900 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Scissors className="size-4 text-signal-bright" />
                <span className="label-tech !text-text">Create clip</span>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button onClick={() => setMarkIn(current)} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-text transition-colors hover:border-signal-line">
                  <Flag className="size-3.5" /> Mark in {markIn != null && <span className="data-mono text-signal-bright">{fmtTime(markIn)}</span>}
                </button>
                <button onClick={() => setMarkOut(current)} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-text transition-colors hover:border-signal-line">
                  <Flag className="size-3.5" /> Mark out {markOut != null && <span className="data-mono text-signal-bright">{fmtTime(markOut)}</span>}
                </button>

                {/*
                  Looping the range you just cut. Only offered once
                  there is one — a loop button with nothing to loop is
                  a control that does nothing, which is worse than no
                  control at all.
                */}
                {markIn != null && markOut != null && markOut > markIn && (
                  <button
                    onClick={() => setLooping((v) => !v)}
                    title="Play the marked range on repeat (L)"
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      looping
                        ? "border-signal-line bg-signal/10 text-signal-bright"
                        : "border-line text-text-dim hover:border-signal-line hover:text-text"
                    }`}
                  >
                    <Repeat className="size-3.5" /> Loop
                  </button>
                )}
              </div>

              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Clip title — e.g. Run in behind" className={inp} />

              <div className="mt-2 flex flex-wrap gap-1.5">
                {SENTIMENTS.map((s) => {
                  const active = sentiment === s.key;
                  return (
                    <button key={s.key} onClick={() => setSentiment(active ? null : s.key)} className="rounded-lg border px-2.5 py-1.5 text-xs transition-colors" style={active ? { borderColor: s.color, color: s.color, background: s.wash } : { borderColor: "var(--line-strong)", color: "var(--text-dim)" }}>
                      {s.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {CLIP_TAGS.slice(0, 10).map((t) => {
                  const active = tags.includes(t);
                  return (
                    <button key={t} onClick={() => toggleTag(t)} className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${active ? "border-signal-line bg-signal/10 text-signal-bright" : "border-line text-text-dim hover:text-text"}`}>
                      {t}
                    </button>
                  );
                })}
              </div>

              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What happened? (the observation)" className={`${inp} mt-2 h-auto resize-y py-2`} />

              {goals.length > 0 && (
                <label className="mt-2 block">
                  <span className="label-tech mb-1 block">Link to development goal</span>
                  <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className={inp}>
                    <option value="">None</option>
                    {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </label>
              )}

              {error && <p className="mt-2 text-sm text-correction">{error}</p>}

              <div className="mt-3 flex items-center gap-3">
                <button onClick={save} disabled={busy || !title.trim() || markIn == null} className="flex h-10 items-center gap-2 rounded-lg bg-signal px-4 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Scissors className="size-4" />} Save clip
                </button>
                {goalId && <span className="text-xs text-text-dim">Adds Film evidence to the goal</span>}
              </div>
            </div>

            {/* Read the film */}
            <div className="mt-3">
              <FilmReading
                videoId={video.id}
                isYouTube={isYouTube}
                current={current}
                duration={duration}
                sourceUrl={video.url}
                onSeek={seek}
                analyses={analyses}
              />
            </div>
      </div>

      {/* ── Clip list ── */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Film className="size-4 text-text-dim" />
          <span className="label-tech">Clips · {clips.length}</span>
          {/*
            The reel. Offered only when there is something to play —
            and hidden while one is running, because the bar above is
            already the way to control it.
          */}
          {reel.length > 0 && reelAt == null && !unplayable && (
            <button
              onClick={startReel}
              title="Play every clip end to end, stopping on each drawing"
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
            >
              <ListVideo className="size-3.5" /> Play reel
            </button>
          )}
        </div>
        {clips.length > 0 ? (
          <div className="space-y-2">
            {clips.map((c) => {
              const sm = sentimentMeta(c.sentiment);
              return (
                <div key={c.id} className="group panel p-3">
                  <div className="flex items-start gap-2">
                    <button onClick={() => playClip(c)} disabled={isYouTube} className="data-mono shrink-0 rounded-md border border-line px-2 py-1 text-xs text-signal-bright transition-colors hover:border-signal-line disabled:opacity-40" title="Play clip">
                      {fmtTime(c.startSeconds)}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-text-hi">{c.title}</span>
                        {sm && <span className="chip" style={{ color: sm.color, borderColor: sm.color }}>{sm.label}</span>}
                      </div>
                      {c.note && <p className="mt-0.5 line-clamp-2 text-xs text-text-dim">{c.note}</p>}
                      {c.tags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {c.tags.map((t) => <span key={t} className="chip">{t}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-1.5">
                      <button onClick={() => favClip(c.id)} aria-label="Favorite" className={c.favorite ? "text-review" : "text-text-faint hover:text-review"}>
                        <Star className="size-4" fill={c.favorite ? "var(--review)" : "none"} />
                      </button>
                      <AddToCollection clipId={c.id} />
                      <button onClick={() => removeClip(c.id)} aria-label="Delete clip" className="text-text-faint opacity-0 transition-opacity hover:text-correction group-hover:opacity-100">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /*
            What this room is for, said once, to somebody who has never
            used it.

            The film room grew a clip composer, a pen, a reel and two AI
            readers, and none of them announce themselves — a player
            opening their first match saw a video and a wall of controls
            and had no reason to believe any of it was for them.

            SELF-DISMISSING BY CONSTRUCTION. It shows only while this
            video has nothing on it at all — no clips AND no drawings —
            so the moment you make anything it is gone for good. No "got
            it" button, no stored flag, and nothing to nag somebody on
            their fiftieth match. Somebody who has drawn but not clipped
            plainly knows where they are, and gets one line instead.
          */
          annotations.length > 0 ? (
            <p className="panel p-4 text-sm text-text-dim">
              No clips yet. Mark in and out with I and O to cut your first one.
            </p>
          ) : (
          <div className="panel p-4">
            <p className="text-sm font-medium text-text-hi">Three things to do here</p>
            <ol className="mt-3 space-y-3">
              {[
                {
                  n: "1",
                  title: "Cut a clip",
                  body: "Find the moment, press I to mark in and O to mark out, then name it. That is the unit everything else is built on.",
                },
                {
                  n: "2",
                  title: "Draw on it",
                  body: "Press D to freeze the frame and point at what you mean — an arrow, a circle, the space nobody covered. Save it as an image to send on.",
                },
                {
                  n: "3",
                  title: "Have MIDO read it",
                  body: "Pick a passage below and MIDO watches it, marking what it saw against what it worked out. It never invents a number.",
                },
              ].map((s) => (
                <li key={s.n} className="flex gap-3">
                  <span className="data-mono grid size-6 shrink-0 place-items-center rounded-md border border-signal-line bg-signal/10 text-[11px] text-signal-bright">
                    {s.n}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-text-hi">{s.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-text-dim">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          )
        )}

        {/*
          Saved drawings. Only shown once there is one — an empty
          section teaching a feature nobody asked for is the kind of
          thing that makes a tool tiring to use.
        */}
        {annotations.length > 0 && (
          <div className="mt-5">
            <div className="mb-3 flex items-center gap-2">
              <PenLine className="size-4 text-text-dim" />
              <span className="label-tech">Drawings · {annotations.length}</span>
            </div>
            {/* An export can be started from here, so a failure has to land here too. */}
            {!drawing && saveError && (
              <p className="mb-2 text-sm text-correction">{saveError}</p>
            )}
            <div className="space-y-2">
              {annotations.map((a) => {
                const open = viewing?.id === a.id;
                return (
                  <div key={a.id} className={`group panel p-3 ${open ? "border-signal-line" : ""}`}>
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => showAnnotation(a)}
                        className={`data-mono shrink-0 rounded-md border px-2 py-1 text-xs transition-colors ${
                          open
                            ? "border-signal-line bg-signal/10 text-signal-bright"
                            : "border-line text-signal-bright hover:border-signal-line"
                        }`}
                        title={open ? "Hide" : "Show on the frame"}
                      >
                        {atLabel(a.atSeconds)}
                      </button>
                      <div className="min-w-0 flex-1">
                        {a.note ? (
                          <p className="text-sm leading-relaxed text-text">{a.note}</p>
                        ) : (
                          <p className="text-sm text-text-faint">No note</p>
                        )}
                        <span className="data-mono mt-1 block text-[10px] text-text-faint">
                          {a.shapes.length} {a.shapes.length === 1 ? "mark" : "marks"}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col items-center gap-1.5">
                        {!isYouTube && (
                          <button
                            onClick={() => saveBoard(a.atSeconds, a.shapes, a.note)}
                            disabled={saving}
                            aria-label="Save as image"
                            title="Save this drawing as an image"
                            className="text-text-faint transition-colors hover:text-signal-bright disabled:opacity-40"
                          >
                            <Download className="size-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => dropAnnotation(a)}
                          aria-label="Delete drawing"
                          className="text-text-faint opacity-0 transition-opacity hover:text-correction group-hover:opacity-100"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inp = "h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none";

function Ctrl({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="grid size-9 place-items-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-text-hi">
      {children}
    </button>
  );
}
