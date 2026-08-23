import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getGoalDetail } from "@/lib/data/development";
import { categoryStyle } from "@/components/ui/primitives";
import { GoalFormDialog } from "@/components/development/goal-form-dialog";
import { DeleteGoalButton } from "@/components/development/delete-goal-button";
import { GoalLoop } from "@/components/development/goal-loop";
import type { DevelopmentGoal } from "@/lib/types";

const statusStyle: Record<DevelopmentGoal["status"], { label: string; color: string }> = {
  active: { label: "Active", color: "var(--positive)" },
  monitoring: { label: "Monitoring", color: "var(--review)" },
  achieved: { label: "Achieved", color: "var(--signal-bright)" },
};

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getGoalDetail(id);
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
              <GoalFormDialog mode="edit" goal={goal} />
              <DeleteGoalButton id={goal.id} title={goal.title} />
            </div>
          </div>

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

      {/* Loop + evidence */}
      <div className="mt-6">
        <GoalLoop goalId={goal.id} evidence={evidence} />
      </div>
    </div>
  );
}
