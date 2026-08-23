import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, ClipboardList, BadgeCheck, Sparkles } from "lucide-react";
import { getOppositionReport } from "@/lib/data/coach";
import { OBSERVATION_GROUPS, observationCount } from "@/lib/data/coach-types";
import { SectionHeader } from "@/components/ui/primitives";
import { OppositionForm } from "@/components/coach/opposition-form";
import { MatchPlanButton } from "@/components/coach/match-plan-button";

export async function generateMetadata({ params }: PageProps<"/app/opposition/[id]">) {
  const { id } = await params;
  const report = await getOppositionReport(id);
  return { title: report ? `${report.opponent} — MIDO XI` : "Opposition — MIDO XI" };
}

export default async function OppositionReportPage({ params }: PageProps<"/app/opposition/[id]">) {
  const { id } = await params;
  const report = await getOppositionReport(id);
  if (!report) notFound();

  const count = observationCount(report);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6">
      <Link
        href="/app/opposition"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-faint transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" /> Opposition
      </Link>

      <header className="mb-8 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="label-tech flex flex-wrap items-center gap-3">
            <span>{report.competition || "Opposition report"}</span>
            {report.matchDate && (
              <>
                <span className="h-px w-5 bg-line-strong" />
                <span className="text-text">
                  {new Date(report.matchDate).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              </>
            )}
            {report.home !== null && <span className="chip">{report.home ? "Home" : "Away"}</span>}
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-text-hi">
            {report.opponent}
          </h1>
          {report.formation && (
            <p className="mt-1 text-sm text-text-dim">They line up in a {report.formation}.</p>
          )}
        </div>
        <OppositionForm mode="edit" report={report} />
      </header>

      {/* What we recorded */}
      <section className="mb-8">
        <SectionHeader label={`What we have seen · ${count}`} />
        {count === 0 ? (
          <div className="panel p-5">
            <p className="text-sm leading-relaxed text-text-dim">
              Nothing recorded yet. Add what you have actually seen — MIDO builds the match plan from your
              observations, and will refuse to invent a scouting report.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {report.keyPlayers.length > 0 && (
              <div className="min-w-0 panel overflow-hidden md:col-span-2">
                <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                  <Eye className="size-3.5 text-review" />
                  <h3 className="text-sm font-medium text-text-hi">Key players</h3>
                </div>
                <ul className="divide-y divide-line">
                  {report.keyPlayers.map((p, i) => (
                    <li key={i} className="px-4 py-3">
                      <div className="text-sm text-text-hi">
                        {p.name}
                        {p.position && <span className="text-text-dim"> · {p.position}</span>}
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-text-dim">{p.threat}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {OBSERVATION_GROUPS.map((g) => {
              const items = report[g.key];
              if (!items.length) return null;
              return (
                <div key={g.key} className="panel overflow-hidden">
                  <div className="border-b border-line px-4 py-2.5">
                    <h3 className="label-tech" style={{ color: g.color }}>
                      {g.label}
                    </h3>
                  </div>
                  <ul className="space-y-2 p-4">
                    {items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-text">
                        <span
                          className="mt-1.5 size-1 shrink-0 rounded-full"
                          style={{ background: g.color }}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            {report.notes && (
              <div className="panel p-4 md:col-span-2">
                <div className="label-tech">Notes</div>
                <p className="mt-1 text-sm leading-relaxed text-text-dim">{report.notes}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* The plan */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <SectionHeader label="Match plan" />
          <MatchPlanButton reportId={report.id} hasPlan={Boolean(report.plan)} />
        </div>

        {report.plan ? (
          <div className="panel-raised relative overflow-hidden">
            <div className="pitch-grid absolute inset-0 opacity-30" aria-hidden />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-4">
                <h3 className="font-display text-lg font-semibold text-text-hi">{report.plan.headline}</h3>
                <span
                  className="chip ml-auto flex items-center gap-1"
                  style={
                    report.planSource === "mido"
                      ? { color: "var(--signal-bright)", borderColor: "var(--signal-line)" }
                      : { color: "var(--info)" }
                  }
                >
                  {report.planSource === "mido" ? (
                    <>
                      <Sparkles className="size-3" /> MIDO analysis
                    </>
                  ) : (
                    <>
                      <BadgeCheck className="size-3" /> Your observations
                    </>
                  )}
                </span>
              </div>

              <div className="divide-y divide-line">
                {report.plan.sections.map((s, i) => (
                  <div key={i} className="px-5 py-4">
                    <div className="label-tech">{s.title}</div>
                    <ul className="mt-2 space-y-2">
                      {s.points.map((p, pi) => (
                        <li key={pi} className="flex items-start gap-2.5 text-sm leading-relaxed text-text">
                          <span className="data-mono mt-0.5 shrink-0 text-[11px] text-signal">
                            {String(pi + 1).padStart(2, "0")}
                          </span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="border-t border-line px-5 py-3">
                <p className="text-[11px] leading-relaxed text-text-faint">
                  Built from {report.plan.basedOn.length} observations you recorded. Nothing in this plan
                  comes from anywhere else — where your notes are silent, the plan is silent.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="panel p-5">
            <p className="text-sm leading-relaxed text-text-dim">
              No plan yet.{" "}
              {count === 0
                ? "Record what you have seen first."
                : "Build it from the observations above — you can edit the report and rebuild any time."}
            </p>
          </div>
        )}
      </section>

      <section className="mt-8">
        <SectionHeader label="Turn it into work" />
        <Link
          href={`/app/sessions?objective=${encodeURIComponent(
            report.weaknesses[0] ?? `Prepare for ${report.opponent}`,
          )}`}
          className="group panel flex items-center gap-3 p-4 transition-colors hover:border-signal-line"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
            <ClipboardList className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-text-hi">Plan a session around this match</span>
            <span className="label-tech mt-0.5 block">Session planner</span>
          </span>
        </Link>
      </section>
    </div>
  );
}
