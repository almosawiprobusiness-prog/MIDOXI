"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, Loader2, Sparkles, Info, Camera, Film, UserSearch } from "lucide-react";
import {
  analyseFrames,
  analyseVideo,
  filmRoomCapabilities,
  setVideoIdentity,
  type FilmRoomCapabilities,
} from "@/app/app/film-room/analysis-actions";
import {
  SAMPLE_RATES,
  frameTimestamps,
  maxRangeSeconds,
  type AnalysisFrame,
} from "@/lib/video/provider";
import type { ClipAnalysis } from "@/lib/data/analyses";
import { fmtTime } from "@/lib/data/film-types";
import { loadCapturableVideo } from "./capture";
import { FormError, FormNote } from "@/components/forms/ui";
import { AnalysisCard } from "./analysis-card";
import { cn } from "@/lib/utils";

/*
  Reading film with MIDO.

  Two readers, and they are genuinely different tools rather than a quality
  setting:

  VIDEO   sends the passage itself. It sees movement — a shoulder check before
          a pass, the moment a run starts, a defender's head turning — which is
          most of what is worth telling a player. Works on YouTube, because
          nothing has to be read out of the page. Needs 10-90 seconds.

  FRAMES  grabs twelve stills in the browser: load an offscreen copy, seek,
          draw to a canvas, encode as JPEG. Nothing but those stills leaves the
          page. It sees one moment precisely and nothing between moments, and
          it cannot touch a YouTube embed, whose pixels are not readable.

  The panel offers whichever can actually run and says plainly why the other
  cannot, rather than hiding it.
*/

const FOCUS_SUGGESTIONS = [
  "Body shape before receiving",
  "Movement off the ball",
  "The moment of the first touch",
  "Pressing angle and timing",
  "Defensive shape and distances",
];

async function captureFrames(
  sourceUrl: string,
  timestamps: number[],
  onProgress: (done: number) => void,
): Promise<AnalysisFrame[]> {
  const video = await loadCapturableVideo(sourceUrl);

  const canvas = document.createElement("canvas");
  const width = 640;
  const ratio = video.videoHeight && video.videoWidth ? video.videoHeight / video.videoWidth : 0.5625;
  canvas.width = width;
  canvas.height = Math.round(width * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot capture frames.");

  const frames: AnalysisFrame[] = [];
  for (const [i, at] of timestamps.entries()) {
    await new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
        reject(new Error("The film could not be read at that point."));
      };
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("error", onError);
      video.currentTime = at;
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // toDataURL throws SecurityError if the source tainted the canvas.
    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    frames.push({
      atSeconds: at,
      mediaType: "image/jpeg",
      data: dataUrl.slice(dataUrl.indexOf(",") + 1),
    });
    onProgress(i + 1);
  }

  video.src = "";
  return frames;
}

type Mode = "video" | "frames";

export function FilmReading({
  videoId,
  isYouTube,
  current,
  duration,
  sourceUrl,
  onSeek,
  analyses,
  identityOverride = null,
}: {
  videoId: string;
  /** This match's "how to spot you", when it differs from the profile. */
  identityOverride?: string | null;
  isYouTube: boolean;
  /** Current playhead, so the range starts where the coach is looking. */
  current: number;
  duration: number;
  /** Read from a separate element, so the player is never disturbed. */
  sourceUrl: string;
  onSeek: (t: number) => void;
  analyses: ClipAnalysis[];
}) {
  const router = useRouter();
  const [caps, setCaps] = useState<FilmRoomCapabilities | null>(null);
  const [mode, setMode] = useState<Mode>("video");
  const [fps, setFps] = useState(1);
  const [from, setFrom] = useState(Math.max(0, Math.floor(current)));
  const [span, setSpan] = useState(30);
  const [focus, setFocus] = useState("");
  const [depth, setDepth] = useState<"quick" | "deep">("quick");
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [identityDraft, setIdentityDraft] = useState<string | null>(null);
  const [captured, setCaptured] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    void filmRoomCapabilities().then((c) => {
      setCaps(c);
      // Land on whichever reader can actually run here. Frames cannot read a
      // YouTube embed at all, so on YouTube video is the only option.
      const video = c.providers.find((p) => p.id === "gemini-video");
      if (!video?.available && !isYouTube) setMode("frames");
    });
  }, [isYouTube]);

  const videoProvider = caps?.providers.find((p) => p.id === "gemini-video");
  const framesProvider = caps?.providers.find((p) => p.id === "mido-frames");
  const active = mode === "video" ? videoProvider : framesProvider;

  // Frames are capped by the frame budget; video by what is useful to read.
  const maxSpan =
    mode === "video" ? (caps?.clip.maxSeconds ?? 90) : maxRangeSeconds(fps);
  const minSpan = mode === "video" ? (caps?.clip.minSeconds ?? 10) : 1;
  const to = Math.min(duration || from + span, from + Math.min(span, maxSpan));
  const stamps = frameTimestamps(from, to, fps);

  const framesBlocked = isYouTube;
  const canRun =
    Boolean(active?.available) && !(mode === "frames" && framesBlocked) && span >= minSpan;

  const run = async () => {
    setError(null);
    setNote(null);

    if (mode === "video") {
      start(async () => {
        const res = await analyseVideo({ videoId, fromSeconds: from, toSeconds: to, focus, depth });
        if (res.ok) {
          setNote(`Read ${fmtTime(from)}–${fmtTime(to)}.`);
          router.refresh();
        } else setError(res.error);
      });
      return;
    }

    setCapturing(true);
    setCaptured(0);
    let frames: AnalysisFrame[] = [];
    try {
      frames = await captureFrames(sourceUrl, stamps, setCaptured);
    } catch (e) {
      setCapturing(false);
      setError(
        e instanceof DOMException && e.name === "SecurityError"
          ? "This film is served without the permissions needed to read its frames. Upload it to MIDO XI and analysis works on it."
          : e instanceof Error
            ? e.message
            : "Frames could not be captured.",
      );
      return;
    }
    setCapturing(false);

    start(async () => {
      const res = await analyseFrames({ videoId, fromSeconds: from, toSeconds: to, fps, focus, frames });
      if (res.ok) {
        setNote(`Read ${res.analysis.framesSampled} frames.`);
        router.refresh();
      } else setError(res.error);
    });
  };

  const busy = capturing || pending;

  return (
    <div className="space-y-4">
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <Eye className="size-4 text-signal-bright" />
          <h3 className="font-display text-base font-semibold text-text-hi">Read the film</h3>
          <span className="chip chip-signal ml-auto">MIDO analysis</span>
        </div>

        {/* Which reader */}
        <div className="flex gap-2 border-b border-line px-4 py-3">
          <ModeButton
            active={mode === "video"}
            onClick={() => {
              setMode("video");
              setSpan((s) => Math.max(caps?.clip.minSeconds ?? 10, Math.min(s, caps?.clip.maxSeconds ?? 90)));
            }}
            icon={Film}
            label="The clip"
            hint="Movement, sequence, timing"
            unavailable={videoProvider ? !videoProvider.available : false}
          />
          <ModeButton
            active={mode === "frames"}
            onClick={() => {
              setMode("frames");
              setSpan((s) => Math.min(s, maxRangeSeconds(fps)));
            }}
            icon={Camera}
            label="Still frames"
            hint="One moment, precisely"
            unavailable={framesBlocked || (framesProvider ? !framesProvider.available : false)}
          />
        </div>

        <div className="p-4">
          <p className="text-sm leading-relaxed text-text-dim">
            {active?.describes ??
              "Reads a passage of film and describes what is visible in it."}
          </p>

          {/* Who you are, for a video read */}
          {/*
            "Is this still you?" — the identity the next read will use, said
            up front, with a one-line door to correct it for THIS match. Kits
            change between fixtures; a stale identity is how the wrong player
            gets coached.
          */}
          {mode === "video" && caps?.hasIdentity && (
            <div className="mt-3 rounded-lg border border-line bg-ink-850 p-3">
              <div className="flex items-start gap-2.5">
                <UserSearch className="mt-0.5 size-4 shrink-0 text-signal-bright" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed text-text-dim">
                    Reading you as:{" "}
                    <span className="text-text">
                      {identityDraft ?? identityOverride ?? caps.identityLine}
                    </span>
                    {identityOverride && !identityDraft && (
                      <span className="text-text-faint"> (this match only)</span>
                    )}
                  </p>
                  {editingIdentity ? (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={identityDraft ?? identityOverride ?? ""}
                        onChange={(e) => setIdentityDraft(e.target.value.slice(0, 140))}
                        placeholder="e.g. white shirt today, number 14"
                        autoFocus
                        className={inp}
                      />
                      <button
                        onClick={() => {
                          const v = (identityDraft ?? "").trim();
                          setEditingIdentity(false);
                          void setVideoIdentity(videoId, v).then(() => router.refresh());
                        }}
                        className="h-9 shrink-0 rounded-lg border border-signal-line bg-signal/10 px-3 text-xs text-signal-bright"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingIdentity(true)}
                      className="mt-1 text-xs text-signal-bright underline-offset-2 hover:underline"
                    >
                      Different kit this match?
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {mode === "video" && caps && !caps.hasIdentity && (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-line bg-ink-850 p-3">
              <UserSearch className="mt-0.5 size-4 shrink-0 text-signal-bright" />
              <p className="text-xs leading-relaxed text-text-dim">
                MIDO does not know which player you are. No model picks one player out of amateur
                footage reliably, so this will be a read of the passage and anything about you comes
                back marked uncertain.{" "}
                <Link href="/app/settings" className="text-signal-bright underline-offset-2 hover:underline">
                  Say how to spot you
                </Link>{" "}
                and it reads your game instead.
              </p>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label-tech mb-1 block">From</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, Math.floor(duration))}
                  value={from}
                  onChange={(e) => setFrom(Math.max(0, Number(e.target.value) || 0))}
                  className={inp}
                />
                {/*
                  No longer withheld from YouTube. This was hidden
                  because the embed had no readable playhead to take
                  "now" from; the IFrame API supplies one, so the
                  button means the same thing on both sources.
                */}
                <button
                  onClick={() => setFrom(Math.floor(current))}
                  className="chip shrink-0 hover:border-signal-line hover:text-signal-bright"
                  title="Use the current playhead"
                >
                  now
                </button>
              </div>
            </label>

            <label className="block">
              <span className="label-tech mb-1 block">
                Length (seconds){mode === "video" ? ` · ${minSpan}–${maxSpan}` : ""}
              </span>
              <input
                type="number"
                min={minSpan}
                max={maxSpan}
                value={span}
                onChange={(e) => setSpan(Math.max(1, Math.min(maxSpan, Number(e.target.value) || 1)))}
                className={inp}
              />
            </label>
          </div>

          {mode === "frames" && (
            <div className="mt-3">
              <span className="label-tech mb-1 block">How closely</span>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_RATES.map((r) => (
                  <button
                    key={r.fps}
                    onClick={() => {
                      setFps(r.fps);
                      setSpan((s) => Math.min(s, maxRangeSeconds(r.fps)));
                    }}
                    title={r.hint}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                      fps === r.fps
                        ? "border-signal-line bg-signal/10 text-signal-bright"
                        : "border-line text-text-dim hover:border-line-strong hover:text-text",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3">
            <span className="label-tech mb-1 block">What to look for</span>
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. body shape before receiving"
              className={inp}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FOCUS_SUGGESTIONS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFocus(f)}
                  className="chip chip-prose transition-colors hover:border-signal-line hover:text-signal-bright"
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/*
            How hard to look. Deep runs the sharper, slower model on the same
            passage and costs two film reads — priced by measurement, and the
            model name never shown; "deep" is the product word.
          */}
          {mode === "video" && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="label-tech mr-1">Read</span>
              <button
                onClick={() => setDepth("quick")}
                aria-pressed={depth === "quick"}
                className={cn(
                  "h-8 rounded-lg border px-3 text-xs transition-colors",
                  depth === "quick"
                    ? "border-signal-line bg-signal/10 text-signal-bright"
                    : "border-line text-text-dim hover:text-text",
                )}
              >
                Quick — 1 film read
              </button>
              <button
                onClick={() => setDepth("deep")}
                aria-pressed={depth === "deep"}
                title="A slower, sharper read of the same passage. Costs two film reads."
                className={cn(
                  "h-8 rounded-lg border px-3 text-xs transition-colors",
                  depth === "deep"
                    ? "border-signal-line bg-signal/10 text-signal-bright"
                    : "border-line text-text-dim hover:text-text",
                )}
              >
                Deep — sharper, 2 film reads
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={run}
              disabled={busy || !canRun}
              className="flex h-10 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-4 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {capturing
                ? `Capturing ${captured}/${stamps.length}`
                : pending
                  ? mode === "video"
                    ? "Watching the clip"
                    : "Reading the frames"
                  : "Analyse this passage"}
            </button>
            {caps?.allowance.label && (
              <span
                className={cn(
                  "text-xs",
                  caps.allowance.left === 0
                    ? "text-review"
                    : caps.allowance.left <= 3
                      ? "text-signal-bright"
                      : "text-text-faint",
                )}
              >
                {caps.allowance.label}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs text-text-dim">
              {mode === "video" ? (
                <>
                  <Film className="size-3.5" />
                  {Math.round(to - from)}s · {fmtTime(from)}–{fmtTime(to)}
                </>
              ) : (
                <>
                  <Camera className="size-3.5" />
                  {stamps.length} frames · {fmtTime(from)}–{fmtTime(to)}
                </>
              )}
            </span>
          </div>

          {mode === "frames" && framesBlocked && (
            <p className="mt-3 rounded-lg border border-line bg-ink-850 px-3 py-2 text-xs leading-relaxed text-text-dim">
              Still frames cannot be taken from a YouTube embed — the player is an iframe and its
              pixels are not available to this page. Reading the clip works on it, because nothing
              has to be read out of the page.
            </p>
          )}
          {active && !active.available && active.reason && (
            <p className="mt-3 rounded-lg border border-line bg-ink-850 px-3 py-2 text-xs leading-relaxed text-text-dim">
              {active.reason}
            </p>
          )}

          <FormError error={error} />
          <FormNote message={note} />
        </div>

        {caps && (
          <div className="space-y-2 border-t border-line px-4 py-3">
            {active && (
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-text-faint">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  <span className="text-text-dim">What this cannot do:</span> {active.cannot}
                </span>
              </p>
            )}
            <p className="text-[11px] leading-relaxed text-text-faint">
              <span className="text-text-dim">{caps.tracking.label}:</span> {caps.tracking.describes}{" "}
              {caps.tracking.needs}
            </p>
          </div>
        )}
      </div>

      {analyses.length > 0 && (
        <div className="space-y-3">
          {analyses.map((a) => (
            <AnalysisCard
              key={a.id}
              analysis={a}
              videoId={videoId}
              onSeek={onSeek}
              onNote={setNote}
              onError={setError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const inp =
  "h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none";

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
  unavailable,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Film;
  label: string;
  hint: string;
  unavailable: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
        active
          ? "border-signal-line bg-signal/10"
          : "border-line hover:border-line-strong",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-signal-bright" : "text-text-faint")} />
      <span className="min-w-0">
        <span className={cn("block text-sm font-medium", active ? "text-signal-bright" : "text-text")}>
          {label}
          {unavailable && <span className="ml-1.5 text-[10px] font-normal text-text-faint">unavailable</span>}
        </span>
        <span className="block text-[11px] text-text-faint">{hint}</span>
      </span>
    </button>
  );
}
