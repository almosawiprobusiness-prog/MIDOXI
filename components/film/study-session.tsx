"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Plus, Trash2, Loader2, CheckCircle2, Clock, Target } from "lucide-react";
import { addStudyNote, deleteStudyNote, completeStudySession } from "@/app/app/film-room/study/actions";
import { NOTE_KINDS, noteMeta, type StudySession, type StudyNote, type StudyNoteKind } from "@/lib/data/study-types";
import { fmtTime, type Video } from "@/lib/data/film-types";
import { useFilmPlayer } from "./use-film-player";
import { YouTubeStage } from "./youtube-stage";

export function StudySessionView({
  session,
  notes,
  video,
  goalTitle,
}: {
  session: StudySession;
  notes: StudyNote[];
  video: Video | null;
  goalTitle: string | null;
}) {
  const router = useRouter();
  const isYouTube = video?.source === "youtube";

  /*
    Study Mode drives whichever player is here, through the shared hook.

    It used to render a bare <iframe> for YouTube, which plays and
    nothing else — so on YouTube footage there was no playhead, and
    therefore no way to stamp a note to a moment. The single most
    valuable thing a study note carries is WHERE it happened, and on
    the source most likely to hold a full match it could not be
    recorded at all. The stamp control was simply hidden.
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
    isYouTube: Boolean(isYouTube),
    sourceUrl: video?.url,
    seededDuration: video?.durationSeconds,
  });

  const [kind, setKind] = useState<StudyNoteKind>("observation");
  const [body, setBody] = useState("");
  const [stamp, setStamp] = useState(true);
  const [busy, setBusy] = useState(false);

  // completion
  const [summary, setSummary] = useState(session.summary ?? "");
  const [completing, setCompleting] = useState(false);
  const [completeBusy, setCompleteBusy] = useState(false);

  const addNote = async () => {
    if (!body.trim()) return;
    setBusy(true);
    // `stamp` alone now — a YouTube playhead is as real as any other.
    await addStudyNote(session.id, kind, body, stamp ? current : null);
    setBusy(false);
    setBody("");
    router.refresh();
  };

  const removeNote = async (id: string) => {
    await deleteStudyNote(id, session.id);
    router.refresh();
  };

  const finish = async () => {
    setCompleteBusy(true);
    await completeStudySession(session.id, summary, session.goalId ?? null);
    setCompleteBusy(false);
    setCompleting(false);
    router.refresh();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      {/* Video */}
      <div className="min-w-0">
        <div className="overflow-hidden rounded-xl border border-line bg-black shadow-2xl shadow-black/40">
          {isYouTube && video?.externalId ? (
            <YouTubeStage externalId={video.externalId} {...youtubeHandlers} onUnavailable={() => {}} />
          ) : video ? (
            <video
              ref={videoRef}
              src={video.url}
              className="aspect-video w-full bg-black"
              playsInline
              preload="metadata"
              {...videoHandlers}
            />
          ) : (
            <div className="grid aspect-video place-items-center text-text-faint">No video attached</div>
          )}
        </div>

        {/* Shown for both sources now that both have a playhead. */}
        {video && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-line bg-ink-900 p-3">
            <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="grid size-9 place-items-center rounded-lg bg-signal text-white transition-colors hover:bg-signal-deep">
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
            <span className="data-mono text-sm text-signal-bright">{fmtTime(current)}</span>
            <input type="range" min={0} max={duration || 0} step={0.05} value={current} onChange={(e) => seek(Number(e.target.value))} className="mido-range flex-1" aria-label="Seek" />
            <span className="data-mono text-sm text-text-dim">{fmtTime(duration)}</span>
          </div>
        )}

        {goalTitle && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-signal-line bg-signal/5 px-3 py-2 text-sm text-text">
            <Target className="size-4 text-signal-bright" />
            Connected to <span className="text-signal-bright">{goalTitle}</span>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        {/* Composer */}
        {!session.completed && (
          <div className="panel p-4">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {NOTE_KINDS.map((n) => {
                const active = kind === n.kind;
                return (
                  <button key={n.kind} onClick={() => setKind(n.kind)} className="rounded-lg border px-2.5 py-1.5 text-xs transition-colors" style={active ? { borderColor: n.color, color: n.color, background: "var(--signal-wash)" } : { borderColor: "var(--line-strong)", color: "var(--text-dim)" }}>
                    {n.label}
                  </button>
                );
              })}
            </div>
            <p className="mb-2 text-xs text-text-faint">{noteMeta(kind).hint}</p>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Type your note…" className="w-full resize-y rounded-lg border border-line bg-ink-850 px-3 py-2 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none" />
            <div className="mt-2 flex items-center justify-between">
              {video ? (
                <label className="flex items-center gap-1.5 text-xs text-text-dim">
                  <input type="checkbox" checked={stamp} onChange={(e) => setStamp(e.target.checked)} className="accent-[var(--signal)]" />
                  <Clock className="size-3.5" /> Stamp {fmtTime(current)}
                </label>
              ) : <span />}
              <button onClick={addNote} disabled={busy || !body.trim()} className="flex h-9 items-center gap-2 rounded-lg bg-signal px-3.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add note
              </button>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="mt-4 space-y-2">
          {notes.length === 0 && !session.completed && (
            <p className="panel p-4 text-sm text-text-dim">Take notes as you watch. Observation → Principle → Action.</p>
          )}
          {notes.map((n) => {
            const meta = noteMeta(n.kind);
            return (
              <div key={n.id} className="group panel p-3">
                <div className="flex items-center gap-2">
                  <span className="label-tech" style={{ color: meta.color }}>{meta.label}</span>
                  {n.atSeconds != null && (
                    <button onClick={() => { seek(n.atSeconds!); void player().play(); }} className="data-mono text-[11px] text-text-faint hover:text-signal-bright">
                      {fmtTime(n.atSeconds)}
                    </button>
                  )}
                  {!session.completed && (
                    <button onClick={() => removeNote(n.id)} aria-label="Delete note" className="ml-auto text-text-faint opacity-0 transition-opacity hover:text-correction group-hover:opacity-100">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm text-text">{n.body}</p>
              </div>
            );
          })}
        </div>

        {/* Complete / summary */}
        {session.completed ? (
          <div className="mt-4 panel border-positive/20 p-4">
            <div className="flex items-center gap-2 text-positive"><CheckCircle2 className="size-4" /><span className="label-tech !text-positive">Session complete</span></div>
            {session.summary && <p className="mt-2 text-sm text-text">{session.summary}</p>}
            {goalTitle && session.summary?.trim() && (
              <p className="mt-2 text-xs text-text-dim">Saved as Insight on {goalTitle}.</p>
            )}
          </div>
        ) : completing ? (
          <div className="mt-4 panel p-4">
            <div className="label-tech mb-1">Session summary</div>
            <p className="mb-2 text-xs text-text-faint">What did you notice, and what will you apply?</p>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="The one thing I'm taking from this…" className="w-full resize-y rounded-lg border border-line bg-ink-850 px-3 py-2 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none" />
            <div className="mt-3 flex gap-3">
              <button onClick={() => setCompleting(false)} className="h-10 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:text-text-hi">Back</button>
              <button onClick={finish} disabled={completeBusy} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-signal font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-60">
                {completeBusy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {session.goalId ? "Complete & add to goal" : "Complete session"}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCompleting(true)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-signal-line bg-signal/10 font-medium text-signal-bright transition-colors hover:bg-signal/20">
            <CheckCircle2 className="size-4" /> Complete session
          </button>
        )}
      </div>
    </div>
  );
}
