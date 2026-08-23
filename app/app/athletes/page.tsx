import Link from "next/link";
import { UserCog, ArrowUpRight, AlertTriangle, Link2 } from "lucide-react";
import { listAthletes, listPrograms } from "@/lib/data/trainer";
import { athleteStatusMeta } from "@/lib/data/trainer-types";
import { isDemoMode } from "@/lib/env";
import { PageHeader, StatBand } from "@/components/ui/kit";
import { EmptyState, DemoNote } from "@/components/dashboards/shared";
import { AthleteForm } from "@/components/trainer/athlete-form";

export const metadata = { title: "Athletes — MIDO XI" };

export default async function AthletesPage() {
  const [athletes, programs] = await Promise.all([listAthletes(), listPrograms()]);
  const active = athletes.filter((a) => a.status === "active");
  const withObjective = athletes.filter((a) => a.objective);
  const flagged = athletes.filter((a) => a.limitations);
  const programmed = new Set(programs.map((p) => p.athleteId).filter(Boolean));

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <PageHeader
        icon={UserCog}
        title="Athletes"
        tagline="Who you develop, and where they are."
        actions={<AthleteForm mode="create" />}
      />

      {athletes.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No athletes yet"
          body="Add the athletes you work with. Their football objective, limitations and test history are what every block is programmed from."
          action={{ label: "Back to the Lab", href: "/app" }}
        />
      ) : (
        <>
          <section className="mb-8">
            <StatBand
              cols={4}
              stats={[
                { label: "Athletes", value: athletes.length },
                { label: "Active", value: active.length },
                { label: "With an objective", value: `${withObjective.length}/${athletes.length}` },
                { label: "On a block", value: `${programmed.size}/${athletes.length}` },
              ]}
            />
          </section>

          {flagged.length > 0 && (
            <div className="panel mb-8 border-review/30 bg-review/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-review" />
                <div className="min-w-0">
                  <p className="text-sm text-text-hi">
                    {flagged.length} athlete{flagged.length === 1 ? " has" : "s have"} a recorded limitation
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {flagged.map((a) => (
                      <li key={a.id} className="text-xs leading-relaxed text-text-dim">
                        <span className="text-text">{a.name}</span> — {a.limitations}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-text-faint">
                    Every block MIDO builds is given these, and is instructed to program around them.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="panel divide-y divide-line overflow-hidden">
            {athletes.map((a) => {
              const st = athleteStatusMeta(a.status);
              const blocks = programs.filter((p) => p.athleteId === a.id).length;
              return (
                <Link
                  key={a.id}
                  href={`/app/athletes/${a.id}`}
                  className="group flex items-center gap-3 p-4 transition-colors hover:bg-ink-850"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 font-display text-sm font-bold text-signal-bright">
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
                        <span className="chip chip-signal flex items-center gap-1 !px-1.5 !py-0" title="Has a MIDO XI account">
                          <Link2 className="size-2.5" /> linked
                        </span>
                      )}
                      {blocks > 0 && (
                        <span className="label-tech">
                          {blocks} block{blocks === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-text-dim">
                      {a.objective ?? "No football objective set"}
                      {a.limitations && <span className="text-review"> · {a.limitations}</span>}
                    </div>
                  </div>
                  <span className="label-tech shrink-0" style={{ color: st.color }}>
                    {st.label}
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              );
            })}
          </div>
        </>
      )}

      {isDemoMode && (
        <DemoNote>
          Demo mode — a working roster. Everything you add or edit is real for this session of use.
        </DemoNote>
      )}
    </div>
  );
}
