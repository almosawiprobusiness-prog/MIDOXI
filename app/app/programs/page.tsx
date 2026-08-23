import Link from "next/link";
import { Dumbbell, ArrowUpRight, Calendar, Repeat } from "lucide-react";
import { listPrograms, listAthletes } from "@/lib/data/trainer";
import { programStatusMeta } from "@/lib/data/trainer-types";
import { quality } from "@/lib/knowledge/physical";
import { isDemoMode } from "@/lib/env";
import { PageHeader, StatBand } from "@/components/ui/kit";
import { SectionHeader } from "@/components/ui/primitives";
import { EmptyState, DemoNote } from "@/components/dashboards/shared";
import { ProgramForm } from "@/components/trainer/program-form";

export const metadata = { title: "Programs — MIDO XI" };

export default async function ProgramsPage({ searchParams }: PageProps<"/app/programs">) {
  const params = await searchParams;
  const presetAthlete = typeof params.athlete === "string" ? params.athlete : null;

  const [programs, athletes] = await Promise.all([listPrograms(), listAthletes()]);
  const byId = new Map(athletes.map((a) => [a.id, a]));
  const active = programs.filter((p) => p.status === "active");
  const templates = programs.filter((p) => !p.athleteId);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <PageHeader
        icon={Dumbbell}
        title="Programs"
        tagline="Blocks, progression, adaptation."
        actions={<ProgramForm mode="create" athletes={athletes} presetAthleteId={presetAthlete} />}
      />

      {programs.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="No blocks yet"
          body="A block starts with an objective and an athlete. MIDO can build the whole thing — waved weeks, a deload and a retest — from the objective, their limitations and the tests you have recorded."
          action={{ label: athletes.length ? "Back to the Lab" : "Add an athlete first", href: athletes.length ? "/app" : "/app/athletes" }}
        />
      ) : (
        <>
          <section className="mb-8">
            <StatBand
              cols={4}
              stats={[
                { label: "Blocks", value: programs.length },
                { label: "Active", value: active.length },
                { label: "Templates", value: templates.length, hint: "Unassigned blocks you can reuse" },
                { label: "Athletes", value: athletes.length },
              ]}
            />
          </section>

          <SectionHeader label="All blocks" />
          <div className="space-y-2">
            {programs.map((p) => {
              const st = programStatusMeta(p.status);
              const athlete = p.athleteId ? byId.get(p.athleteId) : null;
              return (
                <Link
                  key={p.id}
                  href={`/app/programs/${p.id}`}
                  className="group panel flex flex-wrap items-center gap-3 p-4 transition-colors hover:border-signal-line"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-text-hi">{p.title}</span>
                      <span className="label-tech" style={{ color: st.color }}>
                        {st.label}
                      </span>
                      {p.source === "mido" && <span className="chip chip-signal !px-1.5 !py-0">MIDO built</span>}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-text-dim">
                      {athlete ? `${athlete.name} · ` : "Template · "}
                      {p.objective || "No objective set"}
                    </p>
                    {p.qualities.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {p.qualities.map((q) => (
                          <span key={q} className="chip !px-1.5 !py-0">
                            {quality(q)?.name ?? q}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="chip flex items-center gap-1">
                      <Calendar className="size-3" /> {p.weeks}w
                    </span>
                    <span className="chip flex items-center gap-1">
                      <Repeat className="size-3" /> {p.sessionsPerWeek}/w
                    </span>
                    <ArrowUpRight className="size-4 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {isDemoMode && <DemoNote>Demo mode — blocks you build persist for this session of use.</DemoNote>}
    </div>
  );
}
