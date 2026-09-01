import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Target, AlertTriangle, Dumbbell, Gauge, Link2, ArrowUpRight } from "lucide-react";
import { getAthlete, listAthleteNotes, listProgramsForAthlete, listAssessments } from "@/lib/data/trainer";
import { athleteStatusMeta, buildSeries, programStatusMeta, type TestSeries } from "@/lib/data/trainer-types";
import { test as testMeta } from "@/lib/knowledge/physical";
import { SectionHeader } from "@/components/ui/primitives";
import { AthleteForm } from "@/components/trainer/athlete-form";
import { AthleteNotes } from "@/components/trainer/athlete-notes";
import { AssessmentForm } from "@/components/trainer/assessment-form";
import { TrendChart } from "@/components/trainer/trend";
import { InviteButton } from "@/components/connections/invite-button";
import { boardsFor, listBoards } from "@/lib/data/boards";
import { BoardPicker } from "@/components/tactics/board-picker";
import { AttachedBoards } from "@/components/tactics/attached-boards";

export async function generateMetadata({ params }: PageProps<"/app/athletes/[id]">) {
  const { id } = await params;
  const athlete = await getAthlete(id);
  return { title: athlete ? `${athlete.name} — MIDO XI` : "Athlete — MIDO XI" };
}

/** Age in whole years, or null when no date of birth is recorded. */
function ageFrom(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const born = new Date(dateOfBirth).getTime();
  if (Number.isNaN(born)) return null;
  return Math.floor((Date.now() - born) / (365.25 * 864e5));
}

export default async function AthletePage({ params }: PageProps<"/app/athletes/[id]">) {
  const { id } = await params;
  const athlete = await getAthlete(id);
  if (!athlete) notFound();

  const [notes, programs, assessments, assigned, library] = await Promise.all([
    listAthleteNotes(id),
    listProgramsForAthlete(id),
    listAssessments(id),
    boardsFor("athlete", id),
    listBoards({ limit: 60 }),
  ]);

  const st = athleteStatusMeta(athlete.status);
  const tested = [...new Set(assessments.map((a) => a.test))];
  const series = tested
    .map((t) => {
      const meta = testMeta(t);
      if (!meta) return null;
      return buildSeries(assessments, { label: meta.label, unit: meta.unit, better: meta.better }, t);
    })
    .filter((s): s is TestSeries => Boolean(s));

  const age = ageFrom(athlete.dateOfBirth);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6">
      <Link
        href="/app/athletes"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-faint transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" /> Athletes
      </Link>

      <header className="mb-8 flex flex-wrap items-start gap-4">
        <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-signal to-signal-deep font-display text-lg font-bold text-white">
          {athlete.name
            .split(/\s+/)
            .map((p) => p[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="label-tech flex flex-wrap items-center gap-3">
            <span>{athlete.position || "Position not set"}</span>
            {age !== null && (
              <>
                <span className="h-px w-4 bg-line-strong" />
                <span>{age} years</span>
              </>
            )}
            <span className="h-px w-4 bg-line-strong" />
            <span style={{ color: st.color }}>{st.label}</span>
            {athlete.linked && (
              <span className="chip chip-signal flex items-center gap-1">
                <Link2 className="size-3" /> MIDO account
              </span>
            )}
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-text-hi">{athlete.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {!athlete.linked && (
            <InviteButton
              kind="trainer-athlete"
              targetTable="trainer_athletes"
              targetId={athlete.id}
              label={athlete.name}
              issuerLabel="Your trainer"
            />
          )}
          <AthleteForm mode="edit" athlete={athlete} />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="min-w-0 panel-raised relative overflow-hidden p-5">
          <div className="field-glow absolute inset-0" aria-hidden />
          <div className="relative">
            <div className="label-tech flex items-center gap-1.5">
              <Target className="size-3.5 text-signal-bright" /> Football objective
            </div>
            {athlete.objective ? (
              <p className="mt-2 font-display text-lg leading-snug text-text-hi">{athlete.objective}</p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-text-dim">
                Nothing set. The objective is what the physical work is for — every block should trace
                back to it.
              </p>
            )}
          </div>
        </section>

        <section className="panel p-5">
          {athlete.readiness != null && (
            <div className="mb-4 border-b border-line pb-4">
              <div className="label-tech">Readiness — from their own check-in</div>
              <div className="mt-1 flex items-end gap-2">
                <span className="stat-figure text-3xl">{athlete.readiness}</span>
                <span className="mb-1 text-sm text-text-dim">/ 100</span>
              </div>
            </div>
          )}
          {athlete.linked && athlete.readiness == null && athlete.shareScope !== "full" && (
            <p className="mb-4 border-b border-line pb-4 text-[11px] leading-relaxed text-text-faint">
              This athlete shares at the &ldquo;{athlete.shareScope}&rdquo; level, so their check-ins are
              not visible. Readiness appears only when they choose to share fully.
            </p>
          )}
          <div className="label-tech flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-review" /> Limitations
          </div>
          {athlete.limitations ? (
            <p className="mt-2 text-sm leading-relaxed text-text">{athlete.limitations}</p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-text-dim">
              None recorded. Anything written here is given to MIDO with every block it builds.
            </p>
          )}
        </section>
      </div>

      {/* Progress */}
      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <SectionHeader label={`Test history · ${assessments.length}`} />
          <AssessmentForm athletes={[athlete]} presetAthleteId={athlete.id} label="Record a test" />
        </div>
        {series.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {series.map((s) => (
              <div key={s.test} className="min-w-0 panel p-4">
                <TrendChart series={s} />
              </div>
            ))}
          </div>
        ) : (
          <div className="panel p-5 text-sm leading-relaxed text-text-dim">
            No tests recorded. A block without a test before and after it cannot be shown to have worked —
            record a baseline before the first session.
          </div>
        )}
      </section>

      {/* Programs */}
      <section className="mt-8">
        <SectionHeader label="Blocks" action={{ label: "All programs", href: "/app/programs" }} />
        {programs.length ? (
          <div className="space-y-2">
            {programs.map((p) => {
              const ps = programStatusMeta(p.status);
              return (
                <Link
                  key={p.id}
                  href={`/app/programs/${p.id}`}
                  className="group panel flex flex-wrap items-center gap-3 p-4 transition-colors hover:border-signal-line"
                >
                  <Dumbbell className="size-4 shrink-0 text-signal-bright" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text-hi">{p.title}</div>
                    <div className="label-tech mt-0.5">
                      {p.weeks} weeks · {p.sessionsPerWeek} per week
                      {p.source === "mido" ? " · MIDO built" : ""}
                    </div>
                  </div>
                  <span className="label-tech shrink-0" style={{ color: ps.color }}>
                    {ps.label}
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="panel flex flex-wrap items-center gap-3 p-5">
            <p className="min-w-0 flex-1 text-sm text-text-dim">
              No block yet. Programming starts from the objective, the limitations and the tests above.
            </p>
            <Link
              href="/app/programs"
              className="flex h-9 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-3 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20"
            >
              <Dumbbell className="size-4" /> Build a block
            </Link>
          </div>
        )}
      </section>

      {/* Record */}
      {/*
        The movement this athlete is working on, drawn (§5).

        "Improve movement between CB and FB" is a shape on the grass. An
        assigned board puts it in the athlete's own MIDO XI, alongside
        the programme that trains it.
      */}
      <section className="mt-8">
        <SectionHeader label={assigned.length > 0 ? `Assigned boards · ${assigned.length}` : "Assigned boards"} />
        {assigned.length > 0 ? (
          <div className="space-y-3">
            <AttachedBoards
              attached={assigned}
              entityType="athlete"
              entityId={id}
              revalidate={`/app/athletes/${id}`}
            />
            <BoardPicker
              entityType="athlete"
              entityId={id}
              boards={library}
              role="assigned"
              revalidate={`/app/athletes/${id}`}
              label="Assign another board"
              compact
            />
          </div>
        ) : (
          <div className="panel flex flex-wrap items-center gap-3 p-4">
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-text-dim">
              Draw the movement pattern once and assign it — the athlete opens the
              same board in their own MIDO XI.
            </p>
            <BoardPicker
              entityType="athlete"
              entityId={id}
              boards={library}
              role="assigned"
              revalidate={`/app/athletes/${id}`}
              label="Assign a board"
            />
          </div>
        )}
      </section>

      <section className="mt-8">
        <SectionHeader label="Record" />
        <AthleteNotes athleteId={athlete.id} notes={notes} />
      </section>

      <section className="mt-8">
        <SectionHeader label="Testing" />
        <Link
          href="/app/assessments"
          className="group panel flex items-center gap-3 p-4 transition-colors hover:border-signal-line"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
            <Gauge className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-text-hi">See what is due for a retest</span>
            <span className="label-tech mt-0.5 block">Assessments</span>
          </span>
        </Link>
      </section>
    </div>
  );
}
