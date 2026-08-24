"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Play, Pause, Rewind, FastForward, ChevronLeft, ChevronRight,
  Scissors, Star, Trash2, Loader2, Flag, Film, TriangleAlert,
} from "lucide-react";
import {
  createClip, deleteClip, toggleClipFavorite,
} from "@/app/app/film-room/actions";
import {
  SENTIMENTS, CLIP_TAGS, sentimentMeta, fmtTime, LONG_FOOTAGE_ADVICE, isHlsUrl,
  type Video, type FilmClip, type ClipSentiment, type ClipInput,
} from "@/lib/data/film-types";
import { AddToCollection } from "./add-to-collection";
import { FilmReading } from "./film-reading";
import type { ClipAnalysis } from "@/lib/data/analyses";

const SPEEDS = [0.5, 1, 1.5, 2];

export function FilmStudio({
  video,
  clips,
  goals,
  analyses = [],
}: {
  video: Video;
  clips: FilmClip[];
  goals: { id: string; title: string }[];
  analyses?: ClipAnalysis[];
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(video.durationSeconds ?? 0);
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
  const [playing, setPlaying] = useState(false);
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

  const isYouTube = video.source === "youtube";
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
  }, [isYouTube, isHls, unplayable, video.url]);

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
  }, [isYouTube, unplayable, video.url]);

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(t, duration || t));
  };
  const nudge = (delta: number) => seek(current + delta);
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };
  const setSpeed = (r: number) => {
    setRate(r);
    if (videoRef.current) videoRef.current.playbackRate = r;
  };

  const playClip = (c: FilmClip) => {
    seek(c.startSeconds);
    videoRef.current?.play();
  };

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

  return (
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      {/* ── Player + composer ── */}
      <div className="min-w-0">
        <div className="overflow-hidden rounded-xl border border-line bg-black">
          {isYouTube && video.externalId ? (
            <div className="aspect-video">
              <iframe
                className="size-full"
                src={`https://www.youtube.com/embed/${video.externalId}`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : unplayable ? (
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
                MIDO could not open the link saved for this video. That usually means it points at
                a page to watch on rather than at a video file.
              </p>
              {video.url && (
                <code className="max-w-full truncate rounded border border-line bg-ink-850 px-2 py-1 text-[11px] text-text-faint">
                  {video.url}
                </code>
              )}
              <p className="max-w-md text-xs leading-relaxed text-text-faint">{LONG_FOOTAGE_ADVICE}</p>
              <button
                onClick={() => setUnplayable(false)}
                className="mt-1 h-9 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-text"
              >
                Try again
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              // Withheld for HLS: hls.js attaches the stream itself, and a
              // playlist set as `src` would fail to decode before it could.
              src={isHls ? undefined : video.url}
              className="aspect-video w-full bg-black"
              playsInline
              preload="metadata"
              onError={() => setUnplayable(true)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          )}
        </div>

        {!isYouTube ? (
          <>
            {/* Transport */}
            <div className="mt-3 rounded-lg border border-line bg-ink-900 p-3">
              <div className="flex items-center gap-3">
                <span className="data-mono text-sm text-signal-bright">{fmtTime(current)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.05}
                  value={current}
                  onChange={(e) => seek(Number(e.target.value))}
                  className="mido-range flex-1"
                  aria-label="Seek"
                />
                <span className="data-mono text-sm text-text-dim">{fmtTime(duration)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Ctrl onClick={() => nudge(-5)} label="Back 5s"><Rewind className="size-4" /></Ctrl>
                  <Ctrl onClick={() => nudge(-0.1)} label="Frame back"><ChevronLeft className="size-4" /></Ctrl>
                  <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="grid size-10 place-items-center rounded-lg bg-signal text-white transition-colors hover:bg-signal-deep">
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
                </div>
              </div>
            </div>

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
                isYouTube={false}
                current={current}
                duration={duration}
                sourceUrl={video.url}
                onSeek={seek}
                analyses={analyses}
              />
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 rounded-lg border border-line bg-ink-900 p-3 text-sm text-text-dim">
              In-app clip tools work on uploaded or direct-URL footage. A YouTube video plays here and
              the Study Engine works from it. Still frames cannot be taken out of the embed — but
              MIDO can read the clip itself, which does not need them.
            </p>
            <div className="mt-3">
              <FilmReading
                videoId={video.id}
                isYouTube
                current={0}
                duration={0}
                sourceUrl={video.url}
                onSeek={() => {}}
                analyses={analyses}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Clip list ── */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Film className="size-4 text-text-dim" />
          <span className="label-tech">Clips · {clips.length}</span>
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
          <p className="panel p-4 text-sm text-text-dim">
            No clips yet. Scrub the video, mark in/out, and save your first clip.
          </p>
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
