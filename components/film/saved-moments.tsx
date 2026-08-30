"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FilePlus2, Loader2, Play, Target } from "lucide-react";
import {
  captureCategoryLabel,
  formatTimestamp,
  timestampedSourceUrl,
  type StudyCapture,
} from "@/lib/data/capture-types";
import { CONCEPTS } from "@/lib/knowledge/concepts";
import { fileCapture, markCaptureOpened } from "@/app/app/film-room/capture-actions";

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
  /** Open goals a moment can be filed under. Absent = filing hidden. */
  openGoals?: { id: string; title: string }[];
  /** Captures already standing as evidence, by id. */
  filedIds?: string[];
}

function watch(capture: StudyCapture) {
  // Fire-and-forget: the revisit metric must never delay the revisit.
  void markCaptureOpened(capture.id);
  // YouTube seeks precisely; a web capture opens its page with a
  // best-effort #t= fragment. Either way, the original site plays it.
  window.open(timestampedSourceUrl(capture), "_blank", "noopener,noreferrer");
}

/*
  Filing a moment: goal + optional concept, confirmed by the player.
  The concept select is the honest path into the Threads panel — the
  player watched the clip, so only the player may say what football
  idea it is an example of.
*/
function FileForm({ capture, openGoals, onDone }: {
  capture: StudyCapture;
  openGoals: { id: string; title: string }[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [goalId, setGoalId] = useState(capture.goalId ?? openGoals[0]?.id ?? "");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fileCapture({ captureId: capture.id, goalId, conceptSlug: slug || null });
    if (res.ok) {
      onDone();
      router.refresh();
    } else {
      setError(res.error);
      setBusy(false);
    }
  };

  const sel = "h-8 min-w-0 flex-1 rounded-md border border-line bg-ink-850 px-2 text-xs text-text-hi focus:border-signal-line focus:outline-none";

  return (
    <div className="mt-2 rounded-lg border border-signal-line/50 bg-signal/5 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className={sel} aria-label="Goal">
          {openGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
        <select value={slug} onChange={(e) => setSlug(e.target.value)} className={sel} aria-label="Concept">
          <option value="">Concept — optional</option>
          {CONCEPTS.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !goalId}
          className="flex h-8 items-center gap-1.5 rounded-md bg-signal px-3 text-xs font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} File it
        </button>
      </div>
      {error && <p className="mt-1.5 text-[11px] text-correction">{error}</p>}
    </div>
  );
}

export function SavedMoments({ captures, goalTitles, focusId, compact, openGoals, filedIds }: Props) {
  const focusRef = useRef<HTMLDivElement>(null);
  const [filingId, setFilingId] = useState<string | null>(null);
  const filed = new Set(filedIds ?? []);

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
                <span className="ml-auto flex items-center gap-3">
                  {openGoals?.length ? (
                    filed.has(c.id) ? (
                      <span className="flex items-center gap-1 text-[11px] text-positive">
                        <Check className="size-3" /> Filed as evidence
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setFilingId(filingId === c.id ? null : c.id)}
                        className="flex items-center gap-1 text-xs font-medium text-text-dim transition-colors hover:text-signal-bright"
                      >
                        <FilePlus2 className="size-3" /> File as evidence
                      </button>
                    )
                  ) : null}
                  <button
                    type="button"
                    onClick={() => watch(c)}
                    className="text-xs font-medium text-signal-bright transition-colors hover:text-signal"
                  >
                    Watch moment
                  </button>
                </span>
              </div>

              {filingId === c.id && openGoals?.length ? (
                <FileForm capture={c} openGoals={openGoals} onDone={() => setFilingId(null)} />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
