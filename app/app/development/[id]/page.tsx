import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getGoalDetail } from "@/lib/data/development";
import { listCapturesForGoal } from "@/lib/data/captures";
import { boardsFor, listBoards } from "@/lib/data/boards";
import { SectionHeader } from "@/components/ui/primitives";
import { BoardPicker } from "@/components/tactics/board-picker";
import { AttachedBoards } from "@/components/tactics/attached-boards";
import { categoryStyle } from "@/components/ui/primitives";
import { SavedMoments } from "@/components/film/saved-moments";
import { GoalFormDialog } from "@/components/development/goal-form-dialog";
import { DeleteGoalButton } from "@/components/development/delete-goal-button";
import { GoalLoop } from "@/components/development/goal-loop";
import { BuildNextWork } from "@/components/development/build-next-work";
import { ShareArtifact } from "@/components/community/share-artifact";
import type { DevelopmentGoal } from "@/lib/types";

const statusStyle: Record<DevelopmentGoal["status"], { label: string; color: string }> = {
  active: { label: "Active", color: "var(--positive)" },
  monitoring: { label: "Monitoring", color: "var(--review)" },
  achieved: { label: "Achieved", color: "var(--signal-bright)" },
};

/*
  Named after the goal. This page had no title of its own, so a browser
  open on three different goals showed three identical tabs.
*/
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getGoalDetail(id);
  return { title: detail ? `${detail.goal.title} — Development` : "Development — MIDO XI" };
}

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, captures, boards, library] = await Promise.all([
    getGoalDetail(id),
    listCapturesForGoal(id),
    boardsFor("development_goal", id),
    listBoards({ limit: 60 }),
  ]);
  if (!detail) notFound();

  const { goal, evidence } = detail;
  const c = categoryStyle[goal.category];
  const s = statusStyle[goal.status];

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 md:px-6">
      <Link href="/app/development" className="mb-5 inline-flex items-center gap-2 text-sm text-text-dim transition-colors hover:text-text-hi">
        <ArrowLeft className="size-4" /> Development
      </Link>

      {/* Header */}
      <div className="panel-raised relative overflow-hidden p-5">
        <div className="pitch-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full" style={{ background: c.color }} />
                <span className="label-tech" style={{ color: c.color }}>{c.label}</span>
                <span className="chip ml-1" style={{ color: s.color, borderColor: s.color }}>{s.label}</span>
              </div>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text-hi">{goal.title}</h1>
              <div className="label-tech mt-1">Created {goal.createdLabel}</div>
            </div>
            <div className="flex items-center gap-2">
              {/*
                Opt-in per item: the record is private by default, and
                this one goal leaves it only in the player's own words,
                after they read and confirm the draft.
              */}
              <ShareArtifact
                label={goal.status === "achieved" ? "Share this milestone" : "Share what I'm working on"}
                tag="goal"
                draft={
                  goal.status === "achieved"
                    ? `Reached a development goal: ${goal.title}.${goal.why ? `\n\nWhy it mattered: ${goal.why}` : ""}`
                    : `Working on: ${goal.title} — ${goal.progress}% in.${goal.why ? `\n\nWhy: ${goal.why}` : ""}`
                }
              />
              <GoalFormDialog mode="edit" goal={goal} />
              <DeleteGoalButton id={goal.id} title={goal.title} />
            </div>
          </div>

          {/*
            The loop closes here. An achieved priority does not need next
            work — offering it would be asking the player to keep training
            something they have finished.
          */}
          {goal.status !== "achieved" && (
            <div className="mt-5 border-t border-line pt-5">
              <BuildNextWork goalId={goal.id} evidenceCount={evidence.length} />
            </div>
          )}

          {/* Progress */}
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-text-dim">Progress</span>
              <span className="data-mono text-signal-bright">{goal.progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-700">
              <div className="h-full rounded-full bg-gradient-to-r from-signal-deep to-signal" style={{ width: `${goal.progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Why */}
      {goal.why && (
        <div className="mt-4 panel p-5">
          <div className="label-tech">Why this matters</div>
          <p className="mt-2 text-sm leading-relaxed text-text">{goal.why}</p>
        </div>
      )}

      {/* Evidence summary */}
      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-5">
        {[
          { label: "Clips", value: goal.evidence.clips },
          { label: "Training", value: goal.evidence.training },
          { label: "Study", value: goal.evidence.study },
          { label: "Matches", value: goal.evidence.matches ?? 0 },
          { label: "Coach", value: goal.evidence.coachNotes },
        ].map((s) => (
          <div key={s.label} className="bg-ink-900 p-3">
            <div className="stat-figure text-xl">{s.value}</div>
            <div className="label-tech mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/*
        Study moments captured against this goal from the browser.
        The player's watching becomes this goal's evidence — which is
        the loop the extension exists to close.
      */}
      {captures.length > 0 && (
        <div className="mt-6">
          <div className="label-tech mb-3">Study moments · {captures.length}</div>
          <SavedMoments
            captures={captures}
            goalTitles={{ [goal.id]: goal.title }}
            compact
          />
        </div>
      )}

      {/*
        The visual for this goal (§6).

        "Improve weak-side positioning" is a spatial idea, and a sentence
        is the worst way to hold one. The board attaches to the goal
        itself, so the picture, the evidence and the training all point
        at the same object.
      */}
      <section className="mt-8">
        <SectionHeader label={boards.length > 0 ? `Tactical picture · ${boards.length}` : "Tactical picture"} />
        {boards.length > 0 ? (
          <div className="space-y-3">
            <AttachedBoards
              attached={boards}
              entityType="development_goal"
              entityId={goal.id}
              revalidate={`/app/development/${goal.id}`}
            />
            <BoardPicker
              entityType="development_goal"
              entityId={goal.id}
              boards={library}
              revalidate={`/app/development/${goal.id}`}
              label="Add another board"
              compact
            />
          </div>
        ) : (
          <div className="panel flex flex-wrap items-center gap-3 p-4">
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-text-dim">
              Draw what this goal looks like on a pitch — where you start, where you
              should be, what the movement is. It stays attached to the goal.
            </p>
            <BoardPicker
              entityType="development_goal"
              entityId={goal.id}
              boards={library}
              revalidate={`/app/development/${goal.id}`}
              label="Add a board"
            />
          </div>
        )}
      </section>

      {/* Loop + evidence */}
      <div className="mt-6">
        <GoalLoop goalId={goal.id} evidence={evidence} />
      </div>
    </div>
  );
}
