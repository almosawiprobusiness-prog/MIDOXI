import Link from "next/link";
import { UserCog, Gauge, AlertTriangle, Dumbbell, Target, ArrowUpRight, Check } from "lucide-react";
import { getTrainerDashboard } from "@/lib/data/roles";
import { athleteStatusMeta } from "@/lib/data/trainer-types";
import { SectionHeader } from "@/components/ui/primitives";
import { StatBand } from "@/components/ui/kit";
import { DashboardHero, DemoNote, EmptyState, QuickActions } from "./shared";

/*
  TRAINER OS — the Lab.
  What is being delivered this week, who is flagged, and what needs retesting.
  Every number here is something the trainer recorded; nothing is estimated.
*/

export async function TrainerLab() {
  const d = await getTrainerDashboard();
  const active = d.athletes.filter((a) => a.status === "active");
  const withObjective = d.athletes.filter((a) => a.objective).length;
  const delivered = d.thisWeek.filter((s) => s.completed).length;
  const shared = d.athletes.filter((a) => a.readiness != null);
  const avgReadiness = shared.length
    ? Math.round(shared.reduce((n, a) => n + (a.readiness ?? 0), 0) / shared.length)
    : null;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 lg:py-8">
      <DashboardHero
        role="trainer"
        identity={d.practice}
        title="The Lab"
        line={
          d.thisWeek.length ? (
            <>
              <span className="text-text-hi">
                {delivered}/{d.thisWeek.length} sessions
              </span>{" "}
              delivered this week.
              {d.retests.length ? ` ${d.retests.length} tests due.` : " Testing up to date."}
            </>
          ) : (
            <>Add your athletes and their objectives — programming and testing build from there.</>
          )
        }
      />

      <section className="mb-8">
        <StatBand
          cols={4}
          stats={[
            { label: "Athletes", value: d.athletes.length },
            { label: "Active", value: active.length },
            { label: "With an objective", value: `${withObjective}/${d.athletes.length || 0}` },
            {
              label: "Avg readiness",
              value: avgReadiness ?? "—",
              hint:
                avgReadiness === null
                  ? "Appears when a linked athlete shares their check-ins"
                  : `From ${shared.length} athlete check-in${shared.length === 1 ? "" : "s"}`,
            },
          ]}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-12">
        {/* This week */}
        <section className="rise-in min-w-0 xl:col-span-5">
          <SectionHeader label="This week" action={{ label: "Programs", href: "/app/programs" }} />
          {d.thisWeek.length ? (
            <div className="panel divide-y divide-line overflow-hidden">
              {d.thisWeek.map((s, i) => (
                <Link
                  key={`${s.programId}-${i}`}
                  href={`/app/programs/${s.programId}`}
                  className="group flex items-center gap-3 p-4 transition-colors hover:bg-ink-850"
                >
                  <span className="data-mono grid w-12 shrink-0 place-items-center rounded-md border border-line bg-ink-850 py-1.5 text-xs text-text">
                    D{s.day}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text-hi">{s.title}</div>
                    <div className="label-tech mt-0.5 truncate">
                      {s.athleteName} · week {s.week}
                    </div>
                  </div>
                  {s.completed ? (
                    <span className="chip flex items-center gap-1 !text-positive">
                      <Check className="size-3" /> done
                    </span>
                  ) : (
                    <span className="chip">planned</span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Dumbbell}
              title="Nothing scheduled this week"
              body="Sessions appear here from the current week of any active block. Build a block for an athlete and it fills itself in."
              action={{ label: "Build a block", href: "/app/programs" }}
            />
          )}

          {d.flags.length > 0 && (
            <div className="mt-3">
              <SectionHeader label="Flags" />
              <div className="space-y-2">
                {d.flags.slice(0, 5).map((f) => (
                  <div key={f.id} className="panel flex items-start gap-3 p-4">
                    {f.kind === "limitation" ? (
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-review" />
                    ) : (
                      <Target className="mt-0.5 size-4 shrink-0 text-text-faint" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm text-text-hi">{f.athlete}</div>
                      <div className="mt-0.5 text-xs leading-relaxed text-text-dim">{f.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Roster */}
        <section className="rise-in min-w-0 xl:col-span-7" style={{ animationDelay: "80ms" }}>
          <SectionHeader label="Athletes" action={{ label: "Open roster", href: "/app/athletes" }} />
          {d.athletes.length ? (
            <div className="panel divide-y divide-line overflow-hidden">
              {d.athletes.map((a) => {
                const st = athleteStatusMeta(a.status);
                return (
                  <Link
                    key={a.id}
                    href={`/app/athletes/${a.id}`}
                    className="group flex items-center gap-3 p-4 transition-colors hover:bg-ink-850"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 font-display text-xs font-bold text-signal-bright">
                      {a.name
                        .split(/\s+/)
                        .map((p) => p[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-text-hi">{a.name}</span>
                        {a.position && <span className="chip !px-1.5 !py-0">{a.position}</span>}
                        {a.linked && (
                          <span className="chip chip-signal !px-1.5 !py-0" title="Has a MIDO XI account">
                            linked
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-text-dim">
                        {a.objective ?? "No football objective set"}
                        {a.limitations && <span className="text-review"> · {a.limitations}</span>}
                      </p>
                    </div>
                    {a.readiness != null && (
                      <span className="shrink-0 text-right" title="From their own check-in">
                        <span className="data-mono block text-sm text-text">{a.readiness}</span>
                        <span className="label-tech block">ready</span>
                      </span>
                    )}
                    <span className="label-tech shrink-0" style={{ color: st.color }}>
                      {st.label}
                    </span>
                    <ArrowUpRight className="size-4 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={UserCog}
              title="No athletes yet"
              body="Add the athletes you work with. Their objective, limitations and test history are what every block is programmed from."
              action={{ label: "Open roster", href: "/app/athletes" }}
            />
          )}
        </section>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="min-w-0">
          <SectionHeader label="Due for a retest" action={{ label: "Testing", href: "/app/assessments" }} />
          {d.retests.length ? (
            <div className="space-y-2">
              {d.retests.slice(0, 5).map((t) => (
                <Link
                  key={`${t.athleteId}-${t.test}`}
                  href={`/app/athletes/${t.athleteId}`}
                  className="group panel flex items-center gap-3 p-4 transition-colors hover:border-signal-line"
                >
                  <Gauge className="size-4 shrink-0 text-signal-bright" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-text-hi">
                      {t.label} · {t.athleteName}
                    </div>
                    <div className="label-tech mt-0.5">
                      {t.weeksSince === null
                        ? "Never tested"
                        : `Last tested ${t.weeksSince} weeks ago · retest every ${t.retestWeeks}`}
                    </div>
                  </div>
                  <span className="chip group-hover:border-signal-line group-hover:text-signal-bright">
                    Record
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="panel p-5 text-sm leading-relaxed text-text-dim">
              Nothing outstanding. Tests appear here when they go stale for a quality an athlete is
              actually being programmed for.
            </div>
          )}
        </section>

        <section className="min-w-0">
          <SectionHeader label="Start here" />
          <QuickActions role="trainer" />
        </section>
      </div>

      {d.isDemo && (
        <DemoNote>
          Demo mode — a working roster, block and test history. Everything you add is real for this
          session of use, and writes to Postgres once a backend is connected.
        </DemoNote>
      )}
    </div>
  );
}
