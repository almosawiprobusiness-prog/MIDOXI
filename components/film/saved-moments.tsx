"use client";

import { useEffect, useRef } from "react";
import { Play, Target } from "lucide-react";
import {
  captureCategoryLabel,
  formatTimestamp,
  timestampedYoutubeUrl,
  type StudyCapture,
} from "@/lib/data/capture-types";
import { markCaptureOpened } from "@/app/app/film-room/capture-actions";

/*
  Saved moments — what the extension put here.

  Each card is one noticing: the video it happened in, the second it
  happened at, and what the player saw. "Watch moment" reopens the
  original YouTube video at that second — MIDO does not rehost or
  embed other people's footage, it remembers where the lesson lives.

  `focusId` is the extension's "View in MIDO" deep link
  (/app/film-room?moment=<id>): that capture is scrolled to and lit,
  so the jump from browser to Player OS lands on the exact moment
  rather than a page of everything.
*/

interface Props {
  captures: StudyCapture[];
  /** Map of goalId → goal title, for the connection chip. */
  goalTitles: Record<string, string>;
  focusId?: string | null;
  /** Tighter rows for the goal-detail page. */
  compact?: boolean;
}

function watch(capture: StudyCapture) {
  // Fire-and-forget: the revisit metric must never delay the revisit.
  void markCaptureOpened(capture.id);
  window.open(
    timestampedYoutubeUrl(capture.videoId, capture.timestampSeconds),
    "_blank",
    "noopener,noreferrer",
  );
}

export function SavedMoments({ captures, goalTitles, focusId, compact }: Props) {
  const focusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusId && focusRef.current) {
      focusRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [focusId]);

  if (captures.length === 0) return null;

  return (
    <div className={compact ? "space-y-2" : "grid gap-3 md:grid-cols-2"}>
      {captures.map((c) => {
        const focused = c.id === focusId;
        return (
          <div
            key={c.id}
            ref={focused ? focusRef : undefined}
            className={`panel flex gap-3 p-3.5 transition-colors ${
              focused ? "border-signal-line bg-signal/5" : ""
            }`}
          >
            {c.thumbnailUrl && !compact ? (
              <button
                type="button"
                onClick={() => watch(c)}
                className="group relative h-[54px] w-24 shrink-0 overflow-hidden rounded-md border border-line bg-ink-850"
                aria-label={`Watch ${c.videoTitle} at ${formatTimestamp(c.timestampSeconds)}`}
              >
                {/* Remote YouTube thumb — plain img keeps next/image domains out of it. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.thumbnailUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                />
                <span className="absolute inset-0 grid place-items-center">
                  <Play className="size-4 text-white drop-shadow" fill="white" />
                </span>
              </button>
            ) : null}

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px] font-medium text-text-hi">{c.videoTitle}</span>
                <span className="data-mono shrink-0 text-sm text-signal-bright">
                  {formatTimestamp(c.timestampSeconds)}
                </span>
              </div>

              <p className="mt-1 text-sm leading-relaxed text-text">&ldquo;{c.observation}&rdquo;</p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {c.category && <span className="chip">{captureCategoryLabel(c.category)}</span>}
                {/* On a goal's own page the connection is the page — no chip. */}
                {!compact && c.goalId && goalTitles[c.goalId] && (
                  <span className="chip chip-signal">
                    <Target className="size-3" /> {goalTitles[c.goalId]}
                  </span>
                )}
                {c.channelName && (
                  <span className="text-[11px] text-text-faint">{c.channelName}</span>
                )}
                <button
                  type="button"
                  onClick={() => watch(c)}
                  className="ml-auto text-xs font-medium text-signal-bright transition-colors hover:text-signal"
                >
                  Watch moment
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
