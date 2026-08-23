import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Repeat, User, TrendingUp, ArrowDownRight, Info } from "lucide-react";
import { getProgram, getAthlete, listAthletes } from "@/lib/data/trainer";
import { byWeek, intentMeta, programStatusMeta, slotMeta } from "@/lib/data/trainer-types";
import { programRules } from "@/lib/data/trainer-compose";
import { quality } from "@/lib/knowledge/physical";
import { SectionHeader } from "@/components/ui/primitives";
import { ProgramForm } from "@/components/trainer/program-form";
import { BuildButtons, SessionToggle } from "@/components/trainer/program-tools";

export async function generateMetadata({ params }: PageProps<"/app/programs/[id]">) {
  const { id } = await params;
  const detail = await getProgram(id);
  return { title: detail ? `${detail.program.title} — MIDO XI` : "Program — MIDO XI" };
}

export default async function ProgramPage({ params }: PageProps<"/app/programs/[id]">) {
  const { id } = await params;
  const detail = await getProgram(id);
  if (!detail) notFound();

  const { program, sessions } = detail;
  const [athlete, athletes] = await Promise.all([
    program.athleteId ? getAthlete(program.athleteId) : Promise.resolve(null),
    listAthletes(),
  ]);

  const weeks = byWeek(sessions);
  const delivered = sessions.filter((s) => s.completedAt).length;
  const rules = programRules(program.qualities);
  const st = programStatusMeta(program.status);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6">
      <Link
        href="/app/programs"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-faint transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" /> Programs
      </Link>

      <header className="mb-6 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="label-tech flex flex-wrap items-center gap-3">
            <span style={{ color: st.color }}>{st.label}</span>
            <span className="h-px w-4 bg-line-strong" />
            <span className="flex items-center gap-1">
              <Calendar className="size-3" /> {program.weeks} weeks
            </span>
            <span className="flex items-center gap-1">
              <Repeat className="size-3" /> {program.sessionsPerWeek} per week
            </span>
            {program.source === "mido" && <span className="chip chip-signal">MIDO built</span>}
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-text-hi">
            {program.title}
          </h1>
          {athlete ? (
            <Link
              href={`/app/athletes/${athlete.id}`}
              className="mt-1 inline-flex items-center gap-1.5 text-sm text-text-dim transition-colors hover:text-signal-bright"
            >
              <User className="size-3.5" /> {athlete.name}
              {athlete.position ? ` · ${athlete.position}` : ""}
            </Link>
          ) : (
            <p className="mt-1 text-sm text-text-dim">Template — not assigned to an athlete.</p>
          )}
        </div>
        <ProgramForm mode="edit" program={program} athletes={athletes} />
      </header>

      <div className="mb-8 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="min-w-0 panel-raised relative overflow-hidden p-5">
          <div className="field-glow absolute inset-0" aria-hidden />
          <div className="relative">
            <div className="label-tech">Objective</div>
            {program.objective ? (
              <p className="mt-2 font-display text-lg leading-snug text-text-hi">{program.objective}</p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-text-dim">
                No objective yet. Everything — the qualities, the sessions, the retest — is built from
                what this block is for.
              </p>
            )}
            {program.qualities.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                {program.qualities.map((q) => (
                  <span key={q} className="chip chip-signal">
                    {quality(q)?.name ?? q}
                  </span>
                ))}
              </div>
            )}
            {athlete?.limitations && (
              <p className="mt-3 rounded-lg border border-review/30 bg-review/5 px-3 py-2 text-xs leading-relaxed text-review">
                Programmed around: {athlete.limitations}
              </p>
            )}
          </div>
        </section>

        <section className="panel flex flex-col p-5">
          <div className="label-tech">Delivered</div>
          <div className="mt-2 flex items-end gap-2">
            <span className="stat-figure text-3xl">{delivered}</span>
            <span className="mb-1 text-sm text-text-dim">/ {sessions.length} sessions</span>
          </div>
          {sessions.length > 0 && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-800">
              <div
                className="h-full rounded-full bg-signal"
                style={{ width: `${Math.round((delivered / sessions.length) * 100)}%` }}
              />
            </div>
          )}
          <div className="mt-auto pt-4">
            <BuildButtons programId={program.id} hasSessions={sessions.length > 0} />
          </div>
        </section>
      </div>

      {/* The block */}
      <section>
        <SectionHeader label={`The block · ${sessions.length} sessions`} />
        {weeks.length === 0 ? (
          <div className="panel p-6 text-center">
            <h3 className="font-display text-base font-semibold text-text-hi">Nothing programmed yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-text-dim">
              Build the block from the objective. You get waved weeks, a deload roughly every fourth week,
              and a retest at the end — then edit anything you want.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {weeks.map(({ week, sessions: weekSessions }) => {
              const intent = intentMeta(weekSessions[0]?.intent ?? null);
              return (
                <div key={week}>
                  <div className="mb-2 flex flex-wrap items-center gap-2.5">
                    <span className="data-mono text-[11px] text-signal">
                      W{String(week).padStart(2, "0")}
                    </span>
                    <span className="label-tech" style={{ color: intent.color }}>
                      {intent.label}
                    </span>
                    <span className="text-[11px] text-text-faint">{intent.hint}</span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {weekSessions.map((s) => (
                      <div key={s.id} className="min-w-0 panel overflow-hidden">
                        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
                          <span className="label-tech">Day {s.day}</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-hi">
                            {s.title}
                          </span>
                          <SessionToggle
                            programId={program.id}
                            sessionId={s.id}
                            completed={Boolean(s.completedAt)}
                          />
                        </div>
                        {s.focus && (
                          <p className="border-b border-line px-4 py-2 text-xs leading-relaxed text-text-dim">
                            {s.focus}
                          </p>
                        )}
                        <ul className="divide-y divide-line">
                          {s.exercises.map((e) => {
                            const sm = slotMeta(e.slot);
                            return (
                              <li key={e.id} className="px-4 py-2.5">
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                  <span
                                    className="label-tech shrink-0 !text-[9px]"
                                    style={{ color: sm.color }}
                                  >
                                    {sm.label}
                                  </span>
                                  <span className="min-w-0 flex-1 text-sm text-text-hi">{e.name}</span>
                                  <span className="data-mono shrink-0 text-xs text-signal-bright">
                                    {e.prescription}
                                  </span>
                                </div>
                                {e.cue && (
                                  <p className="mt-0.5 text-xs italic text-text-dim">&ldquo;{e.cue}&rdquo;</p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Rules */}
      {rules.length > 0 && (
        <section className="mt-8">
          <SectionHeader label="How this block progresses" />
          <div className="grid gap-3 md:grid-cols-2">
            {rules.map((r) => (
              <div key={r.quality} className="min-w-0 panel p-4">
                <h3 className="font-display text-base font-semibold text-text-hi">{r.quality}</h3>
                <p className="label-tech mt-0.5">{r.weeklyDose}</p>

                <div className="mt-3">
                  <div className="label-tech flex items-center gap-1.5 !text-positive">
                    <TrendingUp className="size-3" /> Progress it
                  </div>
                  <ul className="mt-1 space-y-1">
                    {r.progression.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-text-dim">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-positive" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3">
                  <div className="label-tech flex items-center gap-1.5 !text-review">
                    <ArrowDownRight className="size-3" /> Pull it back
                  </div>
                  <ul className="mt-1 space-y-1">
                    {r.regression.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-text-dim">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-review" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-text-faint">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Progression rules come from the curated MIDO physical library. MIDO never states a target time
            or a normative standard — those depend on the population, and inventing them would be
            fabrication.
          </p>
        </section>
      )}
    </div>
  );
}
