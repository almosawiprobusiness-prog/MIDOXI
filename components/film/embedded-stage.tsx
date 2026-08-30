"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { createClip, deleteClip } from "@/app/app/film-room/actions";
import {
  SENTIMENTS,
  fmtTime,
  seekEmbedUrl,
  sentimentMeta,
  type ClipSentiment,
  type FilmClip,
  type Video,
} from "@/lib/data/film-types";

/*
  The embedded stage — footage MIDO can show but not drive.

  A sport.video match page, a Veo link, a club stream: the site allows
  itself to be framed (verified before this video was ever saved), so
  the whole player lives here in the film room. What MIDO cannot do is
  reach inside another site's player — no seeking, no currentTime, no
  telestration frame. Pretending otherwise is how a black rectangle
  with a 0:00 timeline happens, so this stage is honest about the
  split: THE PAGE plays the football, MIDO keeps the record.

  Moments are logged with the clock the player shows, by hand, and are
  saved as real clips — they land in the clip library, carry sentiment
  and a note, and feed everything clips already feed.

  Seeking back: seekEmbedUrl() knows the services with a published
  deep-link time contract (Vimeo's player, Dailymotion, Twitch's
  player). For those, tapping a moment's time reloads the frame at
  that second. For everyone else the timestamp stays a badge and the
  copy says so — a guessed `t=` param can reroute an SPA entirely
  (sport.video turns it into highlight-share mode), which is worse
  than asking the viewer to scrub.
*/

export function EmbeddedStage({
  video,
  clips,
  host,
}: {
  video: Video;
  clips: FilmClip[];
  host: string;
}) {
  const router = useRouter();
  const [minute, setMinute] = useState("");
  const [second, setSecond] = useState("");
  const [title, setTitle] = useState("");
  const [sentiment, setSentiment] = useState<ClipSentiment>("review");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Reloading the iframe at a moment's second, where the service allows it.
  const [stage, setStage] = useState<{ src: string; key: number }>({ src: video.url, key: 0 });
  const canSeek = seekEmbedUrl(video.url, 0) !== null;

  const startSeconds = () => {
    const m = parseInt(minute || "0", 10);
    const s = parseInt(second || "0", 10);
    if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0 || s > 59) return null;
    return m * 60 + s;
  };

  const log = async () => {
    const at = startSeconds();
    if (at === null) {
      setError("Give the moment a time — the minute and second on the player's own clock.");
      return;
    }
    if (!title.trim()) {
      setError("Say what happened, in a line.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createClip({
      videoId: video.id,
      title: title.trim(),
      startSeconds: at,
      sentiment,
      tags: [],
      matchId: video.matchId ?? null,
    });
    if (res.ok) {
      setTitle("");
      setMinute("");
      setSecond("");
      router.refresh();
    } else {
      setError(res.error);
    }
    setBusy(false);
  };

  const remove = async (id: string) => {
    setRemoving(id);
    await deleteClip(id, video.id);
    router.refresh();
    setRemoving(null);
  };

  const sorted = [...clips].sort((a, b) => a.startSeconds - b.startSeconds);
  const inp =
    "rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none";

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="min-w-0">
        <div className="overflow-hidden rounded-xl border border-line bg-ink-950">
          <iframe
            key={stage.key}
            src={stage.src}
            title={video.title}
            className="aspect-video w-full"
            allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs leading-relaxed text-text-faint">
            {host} plays the football; MIDO keeps the record. It cannot reach inside another
            site&rsquo;s player, so log moments with the clock you see above.
          </p>
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-signal-bright transition-colors hover:text-signal"
          >
            Open on {host} <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      <div className="min-w-0">
        <div className="panel p-4">
          <div className="label-tech mb-2">Log a moment</div>
          <ol className="mb-3 list-decimal space-y-0.5 pl-4 text-[11px] leading-relaxed text-text-faint">
            <li>Watch on the player — its own clock is the truth.</li>
            <li>When something matters, type that clock below.</li>
            <li>Pick what kind of moment it is, write a line, save.</li>
          </ol>
          <div className="flex items-center gap-2">
            <input
              value={minute}
              onChange={(e) => setMinute(e.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="min"
              inputMode="numeric"
              aria-label="Minute"
              className={`${inp} h-9 w-16 text-center`}
            />
            <span className="text-text-faint">:</span>
            <input
              value={second}
              onChange={(e) => setSecond(e.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="sec"
              inputMode="numeric"
              aria-label="Second"
              className={`${inp} h-9 w-16 text-center`}
            />
            <span className="text-[11px] text-text-faint">the player&rsquo;s clock</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {SENTIMENTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSentiment(s.key)}
                aria-label={s.label}
                aria-pressed={sentiment === s.key}
                className="flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 transition-colors"
                style={
                  sentiment === s.key
                    ? { borderColor: s.color, background: s.wash }
                    : { borderColor: "var(--line-strong)" }
                }
              >
                <span className="block size-2 rounded-full" style={{ background: s.color }} />
                <span
                  className="text-[10px] font-medium tracking-wide"
                  style={{ color: sentiment === s.key ? s.color : "var(--text-dim)" }}
                >
                  {s.label}
                </span>
              </button>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What happened?"
            maxLength={140}
            className={`${inp} mt-2 h-9 w-full`}
            onKeyDown={(e) => {
              if (e.key === "Enter") void log();
            }}
          />
          {error && <p className="mt-2 text-xs text-correction">{error}</p>}
          <button
            onClick={log}
            disabled={busy}
            className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-signal text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Save moment
          </button>
        </div>

        <div className="mt-4">
          <div className="label-tech mb-2">Moments · {sorted.length}</div>
          {sorted.length === 0 ? (
            <p className="panel px-4 py-3 text-sm leading-relaxed text-text-dim">
              None yet. Watch above, and when something matters, write the player&rsquo;s clock
              and a line — each one lands in your clip library.
            </p>
          ) : (
            <div className="space-y-2">
              {sorted.map((c) => {
                const s = sentimentMeta(c.sentiment) ?? SENTIMENTS[1];
                return (
                  <div key={c.id} className="panel flex items-start gap-3 p-3">
                    {canSeek ? (
                      <button
                        onClick={() => {
                          const at = seekEmbedUrl(video.url, c.startSeconds);
                          if (at) setStage((prev) => ({ src: at, key: prev.key + 1 }));
                        }}
                        title={`Reload the player at ${fmtTime(c.startSeconds)}`}
                        className="data-mono mt-0.5 shrink-0 rounded text-sm text-signal-bright underline decoration-dotted underline-offset-4 transition-colors hover:text-signal"
                      >
                        {fmtTime(c.startSeconds)}
                      </button>
                    ) : (
                      <span className="data-mono mt-0.5 shrink-0 text-sm text-signal-bright">
                        {fmtTime(c.startSeconds)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-hi">{c.title}</p>
                      <span className="label-tech mt-0.5 inline-block" style={{ color: s.color }}>
                        {s.label}
                      </span>
                    </div>
                    <button
                      onClick={() => remove(c.id)}
                      disabled={removing === c.id}
                      aria-label={`Delete ${c.title}`}
                      className="shrink-0 text-text-faint transition-colors hover:text-correction disabled:opacity-50"
                    >
                      {removing === c.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {sorted.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-text-faint">
              <Check className="size-3" /> Saved to your clip library like any other clip.
              {canSeek
                ? " Tap a time to reload the player there."
                : ` To rewatch one, scrub ${host}'s player to the time shown.`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
