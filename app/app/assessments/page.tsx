import Link from "next/link";
import { Gauge, AlertCircle, Info } from "lucide-react";
import { listAthletes, listAssessments, retestsDue } from "@/lib/data/trainer";
import { buildSeries, type TestSeries } from "@/lib/data/trainer-types";
import { TESTS, test as testMeta } from "@/lib/knowledge/physical";
import { isDemoMode } from "@/lib/env";
import { PageHeader, StatBand } from "@/components/ui/kit";
import { SectionHeader } from "@/components/ui/primitives";
import { EmptyState, DemoNote } from "@/components/dashboards/shared";
import { AssessmentForm, DeleteAssessment } from "@/components/trainer/assessment-form";
import { TrendChart } from "@/components/trainer/trend";

export const metadata = { title: "Assessments — MIDO XI" };

export default async function AssessmentsPage() {
  const [athletes, assessments, due] = await Promise.all([
    listAthletes(),
    listAssessments(),
    retestsDue(),
  ]);

  const byAthlete = new Map(athletes.map((a) => [a.id, a]));
  const improving: { athleteId: string; athleteName: string; series: TestSeries }[] = [];

  for (const athlete of athletes) {
    const rows = assessments.filter((a) => a.athleteId === athlete.id);
    const tests = [...new Set(rows.map((r) => r.test))];
    for (const t of tests) {
      const meta = testMeta(t);
      if (!meta) continue;
      const series = buildSeries(rows, { label: meta.label, unit: meta.unit, better: meta.better }, t);
      if (series && series.entries.length > 1) {
        improving.push({ athleteId: athlete.id, athleteName: athlete.name, series });
      }
    }
  }
  improving.sort((a, b) => b.series.changePct - a.series.changePct);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <PageHeader
        icon={Gauge}
        title="Assessments"
        tagline="Test, retest, prove the change."
        actions={<AssessmentForm athletes={athletes} />}
      />

      {athletes.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="No athletes to test"
          body="Assessments belong to an athlete. Add your roster first, then record a baseline before the first session of a block."
          action={{ label: "Add an athlete", href: "/app/athletes" }}
        />
      ) : (
        <>
          <section className="mb-8">
            <StatBand
              cols={4}
              stats={[
                { label: "Results", value: assessments.length },
                { label: "Tests tracked", value: new Set(assessments.map((a) => a.test)).size },
                { label: "Retests due", value: due.length },
                { label: "Trends", value: improving.length, hint: "Tests with more than one result" },
              ]}
            />
          </section>

          {due.length > 0 && (
            <section className="mb-8">
              <SectionHeader label="Due for a retest" />
              <div className="panel divide-y divide-line overflow-hidden">
                {due.map((d) => (
                  <div key={`${d.athleteId}-${d.test}`} className="flex flex-wrap items-center gap-3 p-4">
                    <AlertCircle className="size-4 shrink-0 text-review" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-text-hi">
                        {d.label} · {d.athleteName}
                      </div>
                      <div className="label-tech mt-0.5">
                        {d.weeksSince === null
                          ? "Never tested"
                          : `Last tested ${d.weeksSince} weeks ago · retest every ${d.retestWeeks}`}
                      </div>
                    </div>
                    <Link
                      href={`/app/athletes/${d.athleteId}`}
                      className="chip hover:border-signal-line hover:text-signal-bright"
                    >
                      Open athlete
                    </Link>
                  </div>
                ))}
              </div>
              <p className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-text-faint">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Only tests tied to a quality the athlete is actually being programmed for appear here.
              </p>
            </section>
          )}

          {improving.length > 0 && (
            <section className="mb-8">
              <SectionHeader label="Where the numbers have moved" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {improving.slice(0, 9).map(({ athleteId, athleteName, series }) => (
                  <div key={`${athleteId}-${series.test}`} className="min-w-0 panel p-4">
                    <Link
                      href={`/app/athletes/${athleteId}`}
                      className="label-tech transition-colors hover:text-signal-bright"
                    >
                      {athleteName}
                    </Link>
                    <div className="mt-1.5">
                      <TrendChart series={series} height={52} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionHeader label={`All results · ${assessments.length}`} />
            {assessments.length ? (
              <div className="panel divide-y divide-line overflow-hidden">
                {assessments.slice(0, 40).map((a) => {
                  const meta = testMeta(a.test);
                  const athlete = byAthlete.get(a.athleteId);
                  return (
                    <div key={a.id} className="flex flex-wrap items-center gap-3 p-3.5">
                      <span className="data-mono w-20 shrink-0 text-xs text-text-dim">
                        {new Date(a.testedOn).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-text-hi">
                          {meta?.label ?? a.test}
                          {a.side ? ` · ${a.side}` : ""}
                        </div>
                        <div className="label-tech mt-0.5 truncate">{athlete?.name ?? "Unknown athlete"}</div>
                      </div>
                      <span className="data-mono shrink-0 text-sm text-text">
                        {a.value}
                        <span className="ml-1 text-xs text-text-dim">{a.unit}</span>
                      </span>
                      <DeleteAssessment id={a.id} athleteId={a.athleteId} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="panel p-5 text-sm leading-relaxed text-text-dim">
                Nothing recorded yet. The MIDO test library covers{" "}
                <span className="text-text-hi">{TESTS.length} assessments</span> — sprint, jump, change of
                direction, repeated sprint, aerobic, strength, hamstring and mobility — each with a
                protocol and what a change in it actually tells you.
              </div>
            )}
          </section>
        </>
      )}

      {isDemoMode && (
        <DemoNote>Demo mode — results you record persist for this session of use.</DemoNote>
      )}
    </div>
  );
}
