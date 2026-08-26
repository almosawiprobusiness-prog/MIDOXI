"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Scissors, Trash2, Target, Check, Undo2, Loader2, ChevronDown } from "lucide-react";
import { observationToClip, removeAnalysis } from "@/app/app/film-room/analysis-actions";
import {
  confirmObservation,
  confirmedFor,
  proposeForObservation,
  unconfirmObservation,
  type LoopProposal,
} from "@/app/app/film-room/loop-actions";
import { CONFIDENCE_META, type AnalysisObservation } from "@/lib/video/provider";
import type { ClipAnalysis } from "@/lib/data/analyses";
import { fmtTime } from "@/lib/data/film-types";
import { cn } from "@/lib/utils";
import { AiFeedback } from "@/components/feedback/ai-feedback";

/*
  One saved reading, and the loop that comes off it.

  The important control here is "file" — it takes an observation and attaches it
  to a development goal as evidence. MIDO says where it thinks it belongs and
  why; the player confirms, overrules, or creates a goal. Nothing is written
  until they act, and everything written can be undone from the same row.

  That confirmation step is the whole design. An automatic link would be faster
  and would quietly fill a player's evidence trail with things they never agreed
  with — and the evidence trail is the part of MIDO they will believe in three
  months' time.
*/

interface Filed {
  goalId: string;
  evidenceId: string;
}

export function AnalysisCard({
  analysis,
  videoId,
  onSeek,
  onNote,
  onError,
}: {
  analysis: ClipAnalysis;
  videoId: string;
  onSeek: (t: number) => void;
  onNote: (message: string) => void;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filed, setFiled] = useState<Record<number, Filed>>({});

  // What was already filed from this reading, so a returning player sees the
  // state they left rather than an invitation to file it twice.
  useEffect(() => {
    let live = true;
    void confirmedFor(analysis.id).then((rows) => {
      if (!live) return;
      const map: Record<number, Filed> = {};
      for (const r of rows) {
        const index = analysis.observations.findIndex(
          (o) => Math.abs(o.atSeconds - r.atSeconds) < 0.5,
        );
        if (index >= 0) map[index] = { goalId: r.goalId, evidenceId: r.evidenceId };
      }
      setFiled(map);
    });
    return () => {
      live = false;
    };
  }, [analysis.id, analysis.observations]);

  const isVideo = analysis.kind === "video";

  return (
    <article className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <span className="label-tech">
          {fmtTime(analysis.fromSeconds)}–{fmtTime(analysis.toSeconds)}
        </span>
        <span
          className="chip"
          title={
            isVideo
              ? "Read from the clip itself — movement between moments is visible."
              : "Read from sampled stills — the moments in between were not seen."
          }
        >
          {isVideo ? "video read" : `${analysis.framesSampled} frames`}
        </span>
        {analysis.focus && <span className="chip !normal-case">{analysis.focus}</span>}
        <button
          onClick={() =>
            start(async () => {
              await removeAnalysis(videoId, analysis.id);
              router.refresh();
            })
          }
          disabled={pending}
          aria-label="Delete analysis"
          className="ml-auto text-text-faint transition-colors hover:text-correction disabled:opacity-50"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {analysis.summary && (
        <p className="whitespace-pre-line border-b border-line px-4 py-3 text-sm leading-relaxed text-text">
          {analysis.summary}
        </p>
      )}

      <ul className="divide-y divide-line">
        {analysis.observations.map((o, i) => (
          <ObservationRow
            key={i}
            observation={o}
            videoId={videoId}
            analysisId={analysis.id}
            filed={filed[i]}
            onFiled={(f) => setFiled((prev) => ({ ...prev, [i]: f }))}
            onUnfiled={() =>
              setFiled((prev) => {
                const next = { ...prev };
                delete next[i];
                return next;
              })
            }
            onSeek={onSeek}
            onNote={onNote}
            onError={onError}
          />
        ))}
      </ul>

      {/* Beta: was this read of the footage useful? */}
      <div className="flex justify-end border-t border-line px-4 py-2.5">
        <AiFeedback subject={`film:${analysis.kind}`} />
      </div>
    </article>
  );
}

function ObservationRow({
  observation: o,
  videoId,
  analysisId,
  filed,
  onFiled,
  onUnfiled,
  onSeek,
  onNote,
  onError,
}: {
  observation: AnalysisObservation;
  videoId: string;
  analysisId: string;
  filed?: Filed;
  onFiled: (f: Filed) => void;
  onUnfiled: () => void;
  onSeek: (t: number) => void;
  onNote: (message: string) => void;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [proposal, setProposal] = useState<LoopProposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [choice, setChoice] = useState<string>("");

  const confidence = o.confidence ?? "observed";
  const meta = CONFIDENCE_META[confidence];

  const openLoop = () => {
    if (proposal) {
      setProposal(null);
      return;
    }
    setLoading(true);
    void proposeForObservation({ concept: o.concept }).then((p) => {
      setProposal(p);
      setChoice(p.goal?.id ?? (p.newGoal ? "new" : (p.goals[0]?.id ?? "")));
      setLoading(false);
    });
  };

  const file = () =>
    start(async () => {
      const res = await confirmObservation({
        observation: {
          videoId,
          analysisId,
          atSeconds: o.atSeconds,
          title: o.title,
          body: o.body,
          concept: o.concept,
        },
        goalId: choice === "new" ? "new" : choice,
        newGoalTitle: proposal?.newGoal?.title,
      });
      if (res.ok) {
        onFiled({ goalId: res.goalId, evidenceId: res.evidenceId ?? "" });
        setProposal(null);
        onNote("Filed as evidence.");
        router.refresh();
      } else onError(res.error);
    });

  const undo = () =>
    start(async () => {
      if (!filed?.evidenceId) return;
      const res = await unconfirmObservation({
        evidenceId: filed.evidenceId,
        goalId: filed.goalId,
        videoId,
      });
      if (res.ok) {
        onUnfiled();
        onNote("Removed from the goal.");
        router.refresh();
      } else onError(res.error ?? "It could not be removed.");
    });

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onSeek(o.atSeconds)}
          className="data-mono rounded-md border border-line px-1.5 py-0.5 text-[11px] text-signal-bright transition-colors hover:border-signal-line"
        >
          {fmtTime(o.atSeconds)}
        </button>
        <span className="min-w-0 flex-1 text-sm font-medium text-text-hi">{o.title}</span>

        <button
          onClick={() =>
            start(async () => {
              const res = await observationToClip({
                videoId,
                atSeconds: o.atSeconds,
                title: o.title,
                body: o.body,
              });
              if (res.ok) {
                onNote("Saved as a clip.");
                router.refresh();
              } else onError(res.error);
            })
          }
          className="chip shrink-0 hover:border-signal-line hover:text-signal-bright"
          title="Save as a clip"
        >
          <Scissors className="size-3" /> clip
        </button>

        {filed ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <Link
              href={`/app/development/${filed.goalId}`}
              className="chip !text-positive hover:border-signal-line"
              title="Filed as evidence — open the goal"
            >
              <Check className="size-3" /> filed
            </Link>
            <button
              onClick={undo}
              disabled={pending}
              aria-label="Remove from the goal"
              className="text-text-faint transition-colors hover:text-correction"
            >
              <Undo2 className="size-3.5" />
            </button>
          </span>
        ) : (
          <button
            onClick={openLoop}
            disabled={loading}
            className="chip shrink-0 hover:border-signal-line hover:text-signal-bright"
            title="File this against a development goal"
          >
            {loading ? <Loader2 className="size-3 animate-spin" /> : <Target className="size-3" />} file
          </button>
        )}
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-text-dim">{o.body}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className="chip"
          style={{ color: meta.color, borderColor: "color-mix(in srgb, currentColor 35%, transparent)" }}
          title={meta.hint}
        >
          {meta.label}
        </span>
        {o.concept && <span className="chip">{o.concept.replace(/-/g, " ")}</span>}
      </div>

      {proposal && (
        <div className="mt-3 rounded-lg border border-line bg-ink-850 p-3">
          <div className="label-tech flex items-center gap-2">
            <Target className="size-3.5 text-signal-bright" />
            Where this belongs
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-text-dim">{proposal.because}</p>

          {proposal.strength === "weak" && (
            <p className="mt-1 text-xs leading-relaxed text-text-faint">
              MIDO is not confident about this one. Pick the right goal yourself — a wrong entry in
              your evidence is worse than none.
            </p>
          )}

          <div className="mt-3">
            <label className="block">
              <span className="label-tech mb-1 block">File under</span>
              <div className="relative">
                <select
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                  className="h-10 w-full appearance-none rounded-lg border border-line bg-ink-900 px-3 pr-9 text-sm text-text-hi focus:border-signal-line focus:outline-none"
                >
                  {proposal.goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                      {proposal.goal?.id === g.id ? "  ← MIDO's pick" : ""}
                    </option>
                  ))}
                  {proposal.newGoal && (
                    <option value="new">New goal — {proposal.newGoal.title}</option>
                  )}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-faint" />
              </div>
            </label>

            {choice === "new" && proposal.newGoal && (
              <p className="mt-2 text-xs leading-relaxed text-text-faint">
                {proposal.newGoal.why}
              </p>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={file}
              disabled={pending || (!choice && !proposal.newGoal)}
              className={cn(
                "flex h-9 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-3 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20",
                "disabled:opacity-50",
              )}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              File as evidence
            </button>
            <button
              onClick={() => setProposal(null)}
              className="h-9 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:text-text"
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
