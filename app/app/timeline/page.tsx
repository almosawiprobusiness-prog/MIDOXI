import Link from "next/link";
import { History, FileText } from "lucide-react";
import { getTimeline } from "@/lib/data/timeline";
import {
  FILTER_GROUPS,
  countByKind,
  minutesPlayed,
  plural,
  type TimelineKind,
} from "@/lib/data/timeline-types";
import { PageHeader } from "@/components/ui/kit";
import { DemoNote, EmptyState } from "@/components/dashboards/shared";
import { TimelineFeed } from "@/components/locker/timeline-feed";
import { currentPeriod } from "@/lib/reports/period";

export const metadata = { title: "Timeline — MIDO XI" };

/*
  The record.

  Everything on this page already existed somewhere in MIDO — a match in the
  match log, a clip in the film room, a check-in in recovery. What was missing
  was the one place they sit next to each other in the order they happened.

  It is assembled by a database view, so there is no chance of it saying
  something the underlying pages do not.
*/

const RANGES = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "Season" },
];

export default async function TimelinePage({ searchParams }: PageProps<"/app/timeline">) {
  const params = await searchParams;
  const days = Number(params.range) || 90;
  const groupId = typeof params.show === "string" ? params.show : "";
  const group = FILTER_GROUPS.find((g) => g.id === groupId);
  const kinds: TimelineKind[] | undefined = group?.kinds;

  const view = await getTimeline({ days, kinds });
  const counts = countByKind(view.entries);
  const minutes = minutesPlayed(view.entries);
  const period = currentPeriod();

  const href = (next: { range?: number; show?: string }) => {
    const sp = new URLSearchParams();
    const r = next.range ?? days;
    const s = next.show ?? groupId;
    if (r !== 90) sp.set("range", String(r));
    if (s) sp.set("show", s);
    const q = sp.toString();
    return q ? `/app/timeline?${q}` : "/app/timeline";
  };

  const chip = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "border-signal-line bg-signal/10 text-signal-bright"
        : "border-line text-text-dim hover:border-signal-line hover:text-text"
    }`;

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 md:px-6">
      <PageHeader
        icon={History}
        title="Timeline"
        tagline="Everything you have done, in the order it happened."
        actions={
          <Link
            href={`/app/reports/monthly/${period}`}
            className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-text transition-colors hover:border-signal-line hover:text-signal-bright"
          >
            <FileText className="size-4" />
            Report
          </Link>
        }
      />

      {view.source === "demo" && (
        <div className="mb-6">
          <DemoNote>
            The seeded season, assembled chronologically. The real timeline reads the same rows your
            own match log, film room and check-ins write.
          </DemoNote>
        </div>
      )}

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <Link key={r.days} href={href({ range: r.days })} className={chip(days === r.days)}>
            {r.label}
          </Link>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        <Link href={href({ show: "" })} className={chip(!groupId)}>
          Everything
        </Link>
        {FILTER_GROUPS.map((g) => (
          <Link key={g.id} href={href({ show: g.id })} className={chip(groupId === g.id)}>
            {g.label}
          </Link>
        ))}
      </div>

      {view.entries.length === 0 ? (
        <EmptyState
          icon={History}
          title={groupId ? "Nothing of that kind in this window" : "Nothing here yet"}
          body={
            groupId
              ? "Widen the range, or switch back to everything. The timeline only ever shows what you have actually recorded."
              : "Your timeline builds itself. Log a match, keep a clip, check in — each one lands here in the order it happened, and stays."
          }
          action={groupId ? { label: "Show everything", href: href({ show: "" }) } : { label: "Log a match", href: "/app/matches" }}
        />
      ) : (
        <>
          {/* What the window contains */}
          <div className="mb-6 min-w-0 panel flex flex-wrap gap-x-6 gap-y-2 px-4 py-3">
            <Summary value={view.entries.length} label={plural(view.entries.length, "entry", "entries")} />
            {counts.match > 0 && <Summary value={counts.match} label={plural(counts.match, "match", "matches")} />}
            {minutes > 0 && <Summary value={minutes} label={`${plural(minutes, "minute")} played`} />}
            {counts.training > 0 && <Summary value={counts.training} label={plural(counts.training, "session")} />}
            {counts.analysis > 0 && <Summary value={counts.analysis} label={plural(counts.analysis, "film read")} />}
            {counts.evidence > 0 && (
              <Summary value={counts.evidence} label={`${plural(counts.evidence, "piece")} of evidence`} />
            )}
          </div>

          <TimelineFeed days={view.days} />

          <p className="mt-6 px-1 text-xs leading-relaxed text-text-faint">
            Entries are placed by when they happened, not when you typed them — a match logged on
            Tuesday still sits on Saturday. Nothing here is generated: every line points at
            something you recorded.
          </p>
        </>
      )}
    </div>
  );
}

function Summary({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="data-mono text-sm text-text-hi">{value}</span>
      <span className="text-xs text-text-faint">{label}</span>
    </div>
  );
}
