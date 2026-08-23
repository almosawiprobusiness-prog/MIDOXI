import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Users, Grid3x3, Sparkles } from "lucide-react";
import { getSessionPlan } from "@/lib/data/coach";
import { phaseMeta, plannedMinutes, SESSION_PHASES } from "@/lib/data/coach-types";
import { SectionHeader } from "@/components/ui/primitives";
import { SessionForm } from "@/components/coach/session-form";
import { BlockForm, BlockControls, DraftButton } from "@/components/coach/session-tools";

export async function generateMetadata({ params }: PageProps<"/app/sessions/[id]">) {
  const { id } = await params;
  const detail = await getSessionPlan(id);
  return { title: detail ? `${detail.plan.title} — MIDO XI` : "Session — MIDO XI" };
}

export default async function SessionPage({ params }: PageProps<"/app/sessions/[id]">) {
  const { id } = await params;
  const detail = await getSessionPlan(id);
  if (!detail) notFound();

  const { plan, blocks } = detail;
  const planned = plannedMinutes(blocks);
  const over = plan.durationMin ? planned - plan.durationMin : 0;

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6">
      <Link
        href="/app/sessions"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-faint transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" /> Sessions
      </Link>

      <header className="mb-6 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="label-tech flex flex-wrap items-center gap-3">
            <span>{plan.status}</span>
            {plan.scheduledAt && (
              <>
                <span className="h-px w-5 bg-line-strong" />
                <span className="text-text">
                  {new Date(plan.scheduledAt).toLocaleString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </>
            )}
            {plan.source === "mido" && <span className="chip chip-signal">MIDO draft</span>}
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-text-hi">{plan.title}</h1>
        </div>
        <SessionForm mode="edit" plan={plan} />
      </header>

      <div className="mb-8 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="min-w-0 panel-raised relative overflow-hidden p-5">
          <div className="field-glow absolute inset-0" aria-hidden />
          <div className="relative">
            <div className="label-tech">Objective</div>
            {plan.objective ? (
              <p className="mt-2 font-display text-lg leading-snug text-text-hi">{plan.objective}</p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-text-dim">
                No objective yet. Write what should be different at the end of this session — everything
                else, including a MIDO draft, follows from it.
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              {plan.durationMin && (
                <span className="chip flex items-center gap-1">
                  <Clock className="size-3" /> {plan.durationMin} min
                </span>
              )}
              {plan.playersCount && (
                <span className="chip flex items-center gap-1">
                  <Users className="size-3" /> {plan.playersCount} players
                </span>
              )}
              {plan.pitch && <span className="chip">{plan.pitch}</span>}
              {plan.intensity && <span className="chip">{plan.intensity} intensity</span>}
            </div>
          </div>
        </section>

        <section className="panel flex flex-col p-5">
          <div className="label-tech">Time planned</div>
          <div className="mt-2 flex items-end gap-2">
            <span className="stat-figure text-3xl">{planned}</span>
            <span className="mb-1 text-sm text-text-dim">
              / {plan.durationMin ?? "—"} min
            </span>
          </div>
          {plan.durationMin ? (
            <>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-800">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (planned / plan.durationMin) * 100)}%`,
                    background: over > 0 ? "var(--review)" : "var(--signal)",
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-text-dim">
                {over > 0
                  ? `${over} minutes over. Trim a block or extend the session.`
                  : over === 0
                    ? "Exactly on the session length."
                    : `${-over} minutes still to fill.`}
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs text-text-dim">Set a session length to track the plan against it.</p>
          )}
          <div className="mt-auto pt-4">
            <DraftButton planId={plan.id} hasBlocks={blocks.length > 0} />
          </div>
        </section>
      </div>

      <section>
        <SectionHeader label={`Blocks · ${blocks.length}`} />

        {blocks.length === 0 ? (
          <div className="panel p-6 text-center">
            <Sparkles className="mx-auto size-5 text-signal-bright" />
            <h3 className="mt-2 font-display text-base font-semibold text-text-hi">No blocks yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-text-dim">
              Build the session yourself, or let MIDO draft it from your objective and then edit every
              block. The structure follows a coaching arc: warm-up, technical, tactical, conditioned game,
              match scenario, cool-down.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {SESSION_PHASES.slice(0, 6).map((p) => (
                <span key={p.phase} className="chip" style={{ color: p.color }}>
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <ol className="space-y-3">
            {blocks.map((b, i) => {
              const meta = phaseMeta(b.phase);
              return (
                <li key={b.id} className="panel overflow-hidden">
                  <div
                    className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3"
                    style={{ borderLeft: `3px solid ${meta.color}` }}
                  >
                    <span className="data-mono text-[11px] text-signal">{String(i + 1).padStart(2, "0")}</span>
                    <span className="label-tech" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-hi">{b.name}</span>
                    {b.durationMin != null && (
                      <span className="data-mono shrink-0 text-xs text-text">{b.durationMin}m</span>
                    )}
                    <div className="flex shrink-0 items-center gap-1">
                      <BlockForm planId={plan.id} mode="edit" block={b} />
                      <BlockControls
                        planId={plan.id}
                        blockId={b.id}
                        first={i === 0}
                        last={i === blocks.length - 1}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 p-4 md:grid-cols-[1.4fr_1fr]">
                    <div className="min-w-0">
                      {b.organisation && (
                        <>
                          <div className="label-tech">Organisation</div>
                          <p className="mt-1 text-sm leading-relaxed text-text-dim">{b.organisation}</p>
                        </>
                      )}
                      {(b.progression || b.regression) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {b.progression && (
                            <span className="chip !normal-case" title="Progression">
                              ↑ {b.progression}
                            </span>
                          )}
                          {b.regression && (
                            <span className="chip !normal-case" title="Regression">
                              ↓ {b.regression}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {b.coachingPoints.length > 0 && (
                      <div>
                        <div className="label-tech">Coaching points</div>
                        <ul className="mt-1 space-y-1.5">
                          {b.coachingPoints.map((cp, ci) => (
                            <li key={ci} className="flex items-start gap-2 text-sm leading-relaxed text-text">
                              <span
                                className="mt-1.5 size-1 shrink-0 rounded-full"
                                style={{ background: meta.color }}
                              />
                              {cp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-3">
          <BlockForm planId={plan.id} mode="create" />
        </div>
      </section>

      <section className="mt-8">
        <SectionHeader label="Take it further" />
        <Link
          href="/app/tactics"
          className="group panel flex items-center gap-3 p-4 transition-colors hover:border-signal-line"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
            <Grid3x3 className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-text-hi">Draw a block on the tactical board</span>
            <span className="label-tech mt-0.5 block">Tactical board</span>
          </span>
        </Link>
      </section>
    </div>
  );
}
