import Link from "next/link";
import { Target, ArrowRight, ChevronRight, RotateCw, Plus, Film, Dumbbell, BookOpen, MessageSquare, Swords } from "lucide-react";
import { listGoals } from "@/lib/data/development";
import { isDemoMode } from "@/lib/env";
import { categoryStyle, SectionHeader } from "@/components/ui/primitives";
import { PageHeader, StatBand } from "@/components/ui/kit";
import { GoalFormDialog } from "@/components/development/goal-form-dialog";
import { DevelopmentMapPanel } from "@/components/development/development-map";
import { LOOP_STAGES } from "@/lib/data/development-types";
import type { DevelopmentGoal } from "@/lib/types";

export const metadata = { title: "Development — MIDO XI" };

const statusStyle: Record<DevelopmentGoal["status"], { label: string; color: string }> = {
  active: { label: "Active", color: "var(--positive)" },
  monitoring: { label: "Monitoring", color: "var(--review)" },
  achieved: { label: "Achieved", color: "var(--signal-bright)" },
};

function evidenceTotal(g: DevelopmentGoal) {
  return g.evidence.clips + g.evidence.training + g.evidence.study + g.evidence.coachNotes + (g.evidence.matches ?? 0);
}

export default async function DevelopmentPage() {
  const goals = await listGoals();
  const active = goals.filter((g) => g.status !== "achieved").length;
  const achieved = goals.filter((g) => g.status === "achieved").length;
  const avgProgress = goals.length ? Math.round(goals.reduce((a, g) => a + g.progress, 0) / goals.length) : 0;
  const evidenceAll = goals.reduce((a, g) => a + evidenceTotal(g), 0);
  // The one card allowed to speak in the elevated voice: the first goal still in play.
  const primaryGoalId = (goals.find((g) => g.status === "active") ?? goals.find((g) => g.status !== "achieved"))?.id;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <PageHeader
        icon={Target}
        title="Development"
        tagline="Your objectives — tracked by evidence, not points."
        actions={<GoalFormDialog mode="create" />}
      />

      {goals.length > 0 && (
        <section className="mb-6">
          <StatBand
            cols={4}
            stats={[
              { label: "Active goals", value: active },
              { label: "Achieved", value: achieved },
              { label: "Avg progress", value: `${avgProgress}%` },
              { label: "Evidence", value: evidenceAll, hint: "Total pieces linked" },
            ]}
          />
        </section>
      )}

      {/* The map — current → target → gap across the five parts of the game */}
      <section className="mb-6">
        <SectionHeader label="Development map" />
        <DevelopmentMapPanel goals={goals} />
      </section>

      {/* The loop explainer */}
      <div className="panel-raised mb-6 flex flex-wrap items-center gap-x-2 gap-y-3 p-4">
        <span className="mr-1 flex items-center gap-1.5 label-tech !text-text">
          <RotateCw className="size-3.5 text-signal-bright" /> The loop
        </span>
        {LOOP_STAGES.map((s, i) => (
          <div key={s.kind} className="flex items-center gap-2">
            <span className="rounded-md border border-line px-2.5 py-1 font-display text-xs font-semibold text-text-hi">{s.label}</span>
            {i < LOOP_STAGES.length - 1 && <ArrowRight className="size-3.5 text-text-faint" />}
          </div>
        ))}
        <RotateCw className="size-3.5 text-text-faint" />
        <span className="ml-auto text-xs text-text-dim">…and back into the next match.</span>
      </div>

      {goals.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {goals.map((g) => {
            const c = categoryStyle[g.category];
            const s = statusStyle[g.status];
            const ev = [
              { icon: Film, n: g.evidence.clips, label: "clips" },
              { icon: Dumbbell, n: g.evidence.training, label: "training" },
              { icon: BookOpen, n: g.evidence.study, label: "study" },
              { icon: Swords, n: g.evidence.matches ?? 0, label: "matches" },
              { icon: MessageSquare, n: g.evidence.coachNotes, label: "coach" },
            ].filter((x) => x.n > 0);
            const isPrimary = g.id === primaryGoalId;
            return (
              <Link
                key={g.id}
                href={`/app/development/${g.id}`}
                className={`group flex flex-col p-4 transition-colors ${
                  isPrimary
                    ? "relative overflow-hidden rounded-xl border border-signal-line bg-gradient-to-b from-signal/10 via-ink-900 to-ink-900"
                    : "panel hover:border-line-strong"
                }`}
              >
                {isPrimary && <div className="label-tech !text-signal-bright mb-2">Active thread / 01</div>}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full" style={{ background: c.color }} />
                    <span className="label-tech" style={{ color: c.color }}>{c.label}</span>
                  </span>
                  <span className="chip" style={{ color: s.color, borderColor: s.color }}>{s.label}</span>
                </div>
                <h3 className={`mt-2 font-display text-base text-text-hi ${isPrimary ? "font-bold uppercase tracking-tight" : "font-semibold"}`}>{g.title}</h3>
                <p className="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-text-dim">{g.why}</p>

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-text-dim">Progress</span>
                    <span className="data-mono text-text">{g.progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                    <div className="h-full rounded-full" style={{ width: `${g.progress}%`, background: c.color }} />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {ev.length > 0 ? ev.map((x) => (
                      <span key={x.label} className="flex items-center gap-1 text-[11px] text-text-dim" title={x.label}>
                        <x.icon className="size-3 text-text-faint" />{x.n}
                      </span>
                    )) : <span className="text-[11px] text-text-faint">No evidence yet</span>}
                  </div>
                  <ChevronRight className="size-4 text-text-faint transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-xl border border-line bg-ink-850 text-signal-bright">
            <Plus className="size-6" />
          </span>
          <h3 className="mt-4 font-display text-lg font-semibold text-text-hi">No development goals yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-text-dim">
            Set what you&rsquo;re working on. MIDO connects your matches, film and training to it — so improvement becomes visible.
          </p>
          <div className="mt-5"><GoalFormDialog mode="create" /></div>
        </div>
      )}

      {isDemoMode && goals.length > 0 && (
        <p className="mt-6 flex items-center justify-center gap-2 text-[11px] text-text-faint">
          <span className="size-1.5 rounded-full bg-review" /> Demo mode — changes persist for this session only. · {active} active
        </p>
      )}
    </div>
  );
}
