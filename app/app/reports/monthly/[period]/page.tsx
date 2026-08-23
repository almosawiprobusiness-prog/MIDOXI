import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { getMonthlyReport } from "@/lib/reports/monthly";
import { isPeriod, isFuture, nextPeriod, prevPeriod, periodLabel } from "@/lib/reports/period";
import { parseFields } from "@/lib/reports/fields";
import { plural } from "@/lib/data/timeline-types";
import { CONFIDENCE_META } from "@/lib/video/provider";
import { evidenceMeta } from "@/lib/data/development-types";
import { ReportControls } from "@/components/reports/report-controls";
import { DemoNote } from "@/components/dashboards/shared";

export const metadata = { title: "Development report — MIDO XI" };

/*
  The monthly development report.

  The first thing in MIDO XI a player can hand to somebody else. It is a real
  page rather than a generated document, which means one template, one styling
  system, and no second implementation to drift out of agreement with the app.
  Printing it produces a proper vector PDF from the browser — no library, no
  server, nothing uploaded.

  Every number here is counted from the record. Where MIDO's own reading of film
  appears it is marked as MIDO's reading, with the confidence it was recorded
  with, because a coach reading this needs to know which sentences are
  observation and which are interpretation.
*/

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function ageFrom(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export default async function MonthlyReportPage({
  params,
  searchParams,
}: PageProps<"/app/reports/monthly/[period]">) {
  const { period } = await params;
  if (!isPeriod(period)) notFound();

  const sp = await searchParams;
  const fields = parseFields(typeof sp.show === "string" ? sp.show : undefined);
  const report = await getMonthlyReport(period);
  const show = (f: Parameters<typeof fields.includes>[0]) => fields.includes(f);

  const prev = prevPeriod(period);
  const next = nextPeriod(period);
  const age = ageFrom(report.player.dateOfBirth);

  const identity = [
    report.player.position,
    report.player.squadNumber ? `#${report.player.squadNumber}` : null,
    report.player.club,
    report.player.league,
    show("nationality") ? report.player.nationality : null,
    show("dateOfBirth") && age !== null ? `${age}` : null,
    show("physical") && report.player.heightCm ? `${report.player.heightCm}cm` : null,
    show("physical") && report.player.weightKg ? `${report.player.weightKg}kg` : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 md:px-6">
      {/* Navigation — screen only */}
      <div className="no-print mb-4 flex items-center gap-2">
        <Link
          href={`/app/reports/monthly/${prev}`}
          className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-text"
        >
          <ChevronLeft className="size-3.5" />
          {periodLabel(prev)}
        </Link>
        {!isFuture(next) && (
          <Link
            href={`/app/reports/monthly/${next}`}
            className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-text"
          >
            {periodLabel(next)}
            <ChevronRight className="size-3.5" />
          </Link>
        )}
        <Link
          href="/app/reports"
          className="ml-auto rounded-lg border border-line px-2.5 py-1.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-text"
        >
          All months
        </Link>
        <Link
          href="/app/timeline"
          className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-text"
        >
          <History className="size-3.5" />
          Timeline
        </Link>
      </div>

      {report.source === "demo" && (
        <div className="no-print mb-4">
          <DemoNote>The seeded season, reported. A real report reads your own record.</DemoNote>
        </div>
      )}

      <ReportControls active={fields} periodLabel={report.periodLabel} shareKind="monthly" shareRef={period} />

      {/* ── The document ─────────────────────────────────── */}
      <article className="panel p-6 md:p-8">
        <header className="border-b border-line pb-5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="label-tech">Development report</span>
            <span className="data-mono text-xs text-text-dim">MIDO XI</span>
          </div>

          <div className="mt-2 flex items-start gap-4">
            {/*
              A picture is what turns a printout into a document about a
              person. It is not behind a privacy toggle because a report is
              already something the player chose to hand over, and a report
              with a face and no name would be the odd thing.
            */}
            {report.player.avatarUrl && (
              <Image
                src={report.player.avatarUrl}
                alt=""
                width={72}
                height={72}
                unoptimized
                className="size-[72px] shrink-0 rounded-full border border-line object-cover"
              />
            )}
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-bold tracking-tight text-text-hi">
                {report.player.knownAs || report.player.name || "Player"}
              </h1>
              {identity.length > 0 && (
                <p className="mt-1 text-sm text-text-dim">{identity.join(" · ")}</p>
              )}
              <p className="mt-2 text-sm text-text">
                {report.periodLabel}
                {report.player.season ? ` · ${report.player.season}` : ""}
              </p>
              {show("contact") && report.player.email && (
                <p className="mt-1 data-mono text-xs text-text-dim">{report.player.email}</p>
              )}
              {report.player.transfermarktUrl && (
                <p className="mt-1 data-mono text-xs text-text-dim">
                  {report.player.transfermarktUrl.replace(/^https?:\/\/(www\.)?/, "")}
                </p>
              )}
            </div>
          </div>
        </header>

        {report.empty ? (
          <p className="py-8 text-sm leading-relaxed text-text-dim">
            Nothing was recorded in {report.periodLabel}. This report is built entirely from what
            you logged — it does not estimate a month you did not have.
          </p>
        ) : (
          <>
            {/* Totals */}
            <section className="border-b border-line py-5">
              <h2 className="label-tech mb-3">The month</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                <Stat value={report.totals.matches} label={plural(report.totals.matches, "match", "matches")} />
                <Stat value={report.totals.minutes} label={plural(report.totals.minutes, "minute")} />
                <Stat value={report.totals.goals} label={plural(report.totals.goals, "goal")} />
                <Stat value={report.totals.assists} label={plural(report.totals.assists, "assist")} />
                <Stat value={report.totals.sessions} label={plural(report.totals.sessions, "session")} />
                <Stat value={report.totals.filmReads} label={plural(report.totals.filmReads, "film read")} />
                <Stat
                  value={report.totals.evidence}
                  label={`${plural(report.totals.evidence, "piece")} of evidence`}
                />
                <Stat value={report.totals.studies} label={plural(report.totals.studies, "study", "studies")} />
              </div>
              {report.totals.matches > 0 && (
                <p className="mt-3 text-xs text-text-faint">
                  {report.totals.started} of {report.totals.matches} started.
                </p>
              )}
            </section>

            {/* Development */}
            <section className="border-b border-line py-5">
              <h2 className="label-tech mb-3">Development</h2>
              {report.goals.length === 0 ? (
                <p className="text-sm text-text-dim">No development goals were open this month.</p>
              ) : (
                <div className="space-y-4">
                  {report.goals.map(({ goal, evidence }) => (
                    <div key={goal.id}>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <h3 className="text-sm font-semibold text-text-hi">{goal.title}</h3>
                        <span className="chip">{goal.category}</span>
                        <span className="chip">{goal.status}</span>
                        <span className="data-mono ml-auto text-xs text-text-dim">
                          {evidence.length} this month
                        </span>
                      </div>
                      {goal.why && (
                        <p className="mt-1 text-sm leading-relaxed text-text-dim">{goal.why}</p>
                      )}
                      {evidence.length > 0 && (
                        <ul className="mt-2 space-y-1.5 border-l border-line pl-3">
                          {evidence.map((e, i) => (
                            <li key={i} className="flex gap-2.5 text-sm">
                              <span
                                className="data-mono shrink-0 text-[11px]"
                                style={{ color: evidenceMeta(e.kind as never).color }}
                              >
                                {fmtDate(e.createdAt)}
                              </span>
                              <span className="min-w-0 text-text-dim">{e.note}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {report.goalsReached.length > 0 && (
                <div className="mt-4 rounded-lg border border-line px-3 py-2">
                  <span className="label-tech">Reached this month</span>
                  <ul className="mt-1 text-sm text-text">
                    {report.goalsReached.map((g) => (
                      <li key={g.id}>{g.title}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Matches */}
            {show("matchLog") && report.matches.length > 0 && (
              <section className="border-b border-line py-5">
                <h2 className="label-tech mb-3">Matches</h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[440px] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <Th>Date</Th>
                        <Th>Fixture</Th>
                        <Th right>Min</Th>
                        <Th right>G</Th>
                        <Th right>A</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...report.matches].reverse().map((m) => (
                        <tr key={m.id} className="border-b border-line-soft">
                          <Td>
                            <span className="data-mono text-xs text-text-dim">
                              {fmtDate(m.occurredAt)}
                            </span>
                          </Td>
                          <Td>
                            <span className="text-text-hi">{m.title}</span>
                            {m.meta.competition ? (
                              <span className="ml-2 text-xs text-text-faint">
                                {String(m.meta.competition)}
                              </span>
                            ) : null}
                          </Td>
                          <Td right>{Number(m.meta.minutes) || "—"}</Td>
                          <Td right>{Number(m.meta.goals) || 0}</Td>
                          <Td right>{Number(m.meta.assists) || 0}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Film */}
            {show("filmObservations") && report.observations.length > 0 && (
              <section className="border-b border-line py-5">
                <div className="mb-3 flex flex-wrap items-baseline gap-2">
                  <h2 className="label-tech">On film</h2>
                  <span className="text-xs text-text-faint">
                    MIDO&rsquo;s reading of the footage, not measurement
                  </span>
                </div>
                <ul className="space-y-3">
                  {report.observations.slice(0, 20).map((o, i) => {
                    const meta = CONFIDENCE_META[o.confidence ?? "observed"];
                    return (
                      <li key={i} className="border-l border-line pl-3">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="data-mono text-[11px] text-text-dim">
                            {fmtDate(o.on)}
                          </span>
                          <span className="text-sm font-medium text-text-hi">{o.title}</span>
                          <span className="chip" style={{ color: meta.color }} title={meta.hint}>
                            {meta.label}
                          </span>
                          {o.concept && <span className="chip">{o.concept.replace(/-/g, " ")}</span>}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-text-dim">{o.body}</p>
                      </li>
                    );
                  })}
                </ul>
                {report.observations.length > 20 && (
                  <p className="mt-3 text-xs text-text-faint">
                    {report.observations.length - 20} further observations are in the film room.
                  </p>
                )}
              </section>
            )}

            {/* Coach */}
            {show("coachFeedback") && report.feedback.length > 0 && (
              <section className="border-b border-line py-5">
                <h2 className="label-tech mb-3">From the coach</h2>
                <ul className="space-y-2">
                  {report.feedback.map((f) => (
                    <li key={f.id} className="border-l border-line pl-3">
                      <span className="data-mono text-[11px] text-text-dim">
                        {fmtDate(f.occurredAt)}
                      </span>
                      <p className="text-sm leading-relaxed text-text">{f.summary}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Check-ins */}
            {show("checkins") && report.checkins.length > 0 && (
              <section className="border-b border-line py-5">
                <h2 className="label-tech mb-3">Check-ins</h2>
                <p className="text-sm text-text-dim">
                  {report.checkins.length} recorded in {report.periodLabel}. Self-reported energy,
                  sleep, soreness and mental state — not measured, and not a medical record.
                </p>
              </section>
            )}
          </>
        )}

        <footer className="pt-5">
          <p className="text-[11px] leading-relaxed text-text-faint">
            Produced by MIDO XI from {report.player.knownAs || "the player"}&rsquo;s own record.
            Counts are of what was logged. Anything labelled as MIDO&rsquo;s reading is
            interpretation of film, not measurement — MIDO XI does not produce tracking data,
            distances or speeds.
          </p>
        </footer>
      </article>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="data-mono text-xl text-text-hi">{value}</div>
      <div className="text-xs text-text-faint">{label}</div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`label-tech pb-2 font-normal ${right ? "text-right" : ""}`}>{children}</th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className={`py-2 ${right ? "text-right data-mono text-text" : ""}`}>{children}</td>;
}
