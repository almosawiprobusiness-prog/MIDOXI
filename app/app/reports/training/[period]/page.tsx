import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { getTimeline } from "@/lib/data/timeline";
import { getProfileSettings } from "@/lib/data/profile";
import { plural } from "@/lib/data/timeline-types";
import { isPeriod, isFuture, nextPeriod, prevPeriod, periodLabel, periodRange } from "@/lib/reports/period";
import { ReportShell, ReportSection, Stat } from "@/components/reports/report-shell";
import { PrintButton } from "@/components/reports/print-button";
import { DemoNote } from "@/components/dashboards/shared";

/*
  Named after the month, for the same reason as the development report:
  this is saved as a PDF, and the tab title becomes the suggested
  filename.
*/
export async function generateMetadata({ params }: PageProps<"/app/reports/training/[period]">) {
  const { period } = await params;
  return {
    title: isPeriod(period)
      ? `Training report — ${periodLabel(period)}`
      : "Training report — MIDO XI",
  };
}

/*
  A month of training, as a document.

  Reads the same timeline view everything else does, filtered to training and
  check-ins, so it cannot say a session happened that the app does not show.

  What it deliberately does NOT do is compute a load score. RPE times duration
  is a real and well-understood number, but MIDO does not currently ask for RPE
  on every session — so producing one would mean averaging over the sessions
  that happen to have it and presenting the result as the month's load. That is
  the kind of number that looks authoritative and means nothing.
*/

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function TrainingReportPage({
  params,
}: PageProps<"/app/reports/training/[period]">) {
  const { period } = await params;
  if (!isPeriod(period)) notFound();

  const { from, to } = periodRange(period);
  const [view, profile] = await Promise.all([
    getTimeline({ from, to, kinds: ["training", "checkin"], limit: 1000 }),
    getProfileSettings(),
  ]);

  const sessions = view.entries.filter((e) => e.kind === "training");
  const checkins = view.entries.filter((e) => e.kind === "checkin");
  const minutes = sessions.reduce((n, s) => n + (Number(s.meta.durationMin) || 0), 0);

  // Sessions by kind, biggest first — the honest picture of a month's balance.
  const byKind = new Map<string, { count: number; minutes: number }>();
  for (const s of sessions) {
    const k = String(s.meta.sessionKind ?? "session");
    const row = byKind.get(k) ?? { count: 0, minutes: 0 };
    row.count++;
    row.minutes += Number(s.meta.durationMin) || 0;
    byKind.set(k, row);
  }
  const kinds = [...byKind.entries()].sort((a, b) => b[1].count - a[1].count);

  const prev = prevPeriod(period);
  const next = nextPeriod(period);

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 md:px-6">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/app/reports/training/${prev}`} className={navChip}>
          <ChevronLeft className="size-3.5" />
          {periodLabel(prev)}
        </Link>
        {!isFuture(next) && (
          <Link href={`/app/reports/training/${next}`} className={navChip}>
            {periodLabel(next)}
            <ChevronRight className="size-3.5" />
          </Link>
        )}
        <Link href="/app/reports" className={`${navChip} ml-auto`}>
          All reports
        </Link>
        <Link href="/app/timeline" className={navChip}>
          <History className="size-3.5" />
          Timeline
        </Link>
      </div>

      {view.source === "demo" && (
        <div className="no-print mb-4">
          <DemoNote>The seeded week of training, reported.</DemoNote>
        </div>
      )}

      <PrintButton
        title="Training report"
        detail={`${periodLabel(period)}. Everything here is a session you logged — MIDO adds nothing.`}
      />

      <ReportShell
        kind="Training report"
        title={profile.knownAs || profile.fullName || "Player"}
        subtitle={`${periodLabel(period)}${profile.season ? ` · ${profile.season}` : ""}`}
        player={{
          name: profile.fullName,
          knownAs: profile.knownAs,
          avatarUrl: profile.avatarUrl,
          identity: [profile.primaryPosition, profile.club, profile.league].filter(Boolean),
        }}
        footnote="No training-load score is calculated here, because MIDO does not ask for perceived effort on every session — a figure averaged over only the sessions that recorded it would read as more certain than it is."
      >
        {sessions.length === 0 ? (
          <p className="py-8 text-sm leading-relaxed text-text-dim">
            No training was logged in {periodLabel(period)}. This report is built from what you
            recorded — it does not estimate a month you did not have.
          </p>
        ) : (
          <>
            <ReportSection label="The month">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                <Stat value={sessions.length} label={plural(sessions.length, "session")} />
                <Stat value={minutes} label={plural(minutes, "minute")} />
                <Stat value={kinds.length} label={plural(kinds.length, "kind", "kinds")} />
                <Stat value={checkins.length} label={plural(checkins.length, "check-in")} />
              </div>
            </ReportSection>

            <ReportSection label="Balance" note="what the month was actually made of">
              <div className="space-y-2">
                {kinds.map(([kind, row]) => {
                  const share = Math.round((row.count / sessions.length) * 100);
                  return (
                    <div key={kind}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="capitalize text-text">{kind}</span>
                        <span className="data-mono shrink-0 text-xs text-text-dim">
                          {row.count} · {row.minutes} min
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-800">
                        <div
                          className="h-full rounded-full bg-signal"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ReportSection>

            <ReportSection label="Every session">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th className="label-tech pb-2 font-normal">Date</th>
                      <th className="label-tech pb-2 font-normal">Session</th>
                      <th className="label-tech pb-2 font-normal">Kind</th>
                      <th className="label-tech pb-2 text-right font-normal">Min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...sessions].reverse().map((s) => (
                      <tr key={s.id} className="border-b border-line-soft">
                        <td className="py-2">
                          <span className="data-mono text-xs text-text-dim">
                            {fmtDate(s.occurredAt)}
                          </span>
                        </td>
                        <td className="py-2">
                          <span className="text-text-hi">{s.title}</span>
                          {s.meta.objective ? (
                            <span className="block text-xs text-text-faint">
                              {String(s.meta.objective)}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 capitalize text-text-dim">
                          {String(s.meta.sessionKind ?? "—")}
                        </td>
                        <td className="data-mono py-2 text-right text-text">
                          {Number(s.meta.durationMin) || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ReportSection>
          </>
        )}
      </ReportShell>
    </div>
  );
}

const navChip =
  "flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-text";
