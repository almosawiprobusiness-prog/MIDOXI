import Link from "next/link";
import { notFound } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { getTraining } from "@/lib/data/training";
import { getProfileSettings } from "@/lib/data/profile";
import { trainingMeta } from "@/lib/data/training-types";
import { ReportShell, ReportSection } from "@/components/reports/report-shell";
import { PrintButton } from "@/components/reports/print-button";

/*
  ONE SESSION, AS A DOCUMENT — the plan a player takes to the pitch on
  paper, printed through the same vector-PDF pipeline as every other
  MIDO document.

  The structure is the directive's: who and when, the focus, WHY THIS
  SESSION (each block's record citation, in words), the numbered
  blocks with their prescriptions and reasons, and a REFLECTION panel
  with write-in lines — because the paper comes back from the pitch
  with a pen having been at it, and that ink is the next session's
  input.

  Nothing here is public: the route lives behind auth like every
  report, and printing is the player handing the paper over
  themselves.
*/

export async function generateMetadata({ params }: PageProps<"/app/reports/session/[id]">) {
  const { id } = await params;
  const entry = await getTraining(id);
  return { title: entry ? `Training plan — ${entry.title}` : "Training plan — MIDO XI" };
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function SessionPlanPage({ params }: PageProps<"/app/reports/session/[id]">) {
  const { id } = await params;
  const [entry, profile] = await Promise.all([getTraining(id), getProfileSettings()]);
  if (!entry) notFound();

  const meta = trainingMeta(entry.kind);
  const plan = entry.plan ?? [];
  // The record citations, deduplicated in order — WHY THIS SESSION.
  const sources = [...new Set(plan.map((b) => b.source).filter(Boolean))];

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 md:px-6">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/app/training"
          className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-text"
        >
          <Dumbbell className="size-3.5" />
          Training
        </Link>
      </div>

      <PrintButton
        title="Training plan"
        detail="The session as a document — take it to the pitch, write on it, bring it back."
      />

      <ReportShell
        kind="Training plan"
        title={entry.title}
        subtitle={[fmtDate(entry.scheduledAt), meta.label, entry.durationMin ? `${entry.durationMin} min` : null]
          .filter(Boolean)
          .join(" · ")}
        player={{
          name: profile.fullName,
          knownAs: profile.knownAs,
          avatarUrl: profile.avatarUrl,
          identity: [profile.primaryPosition, profile.club].filter(Boolean),
        }}
        footnote="Built from this player's own record — goals, film and readiness. Every block names the piece of the record it exists because of."
      >
        {entry.objective && (
          <ReportSection label="Objective">
            <p className="text-sm leading-relaxed text-text-hi">{entry.objective}</p>
          </ReportSection>
        )}

        {sources.length > 0 && (
          <ReportSection label="Why this session" note="the record behind each block">
            <ul className="space-y-1">
              {sources.map((s) => (
                <li key={s} className="text-sm text-text">
                  · {s}
                </li>
              ))}
            </ul>
          </ReportSection>
        )}

        {plan.length > 0 ? (
          <ReportSection label="The session">
            <div className="space-y-4">
              {plan.map((b, i) => (
                <div key={i} className="break-inside-avoid border-b border-line-soft pb-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="text-base font-semibold text-text-hi">
                      <span className="data-mono mr-2 text-sm text-text-dim">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {b.name}
                    </h3>
                    <span className="data-mono text-sm text-text">{b.work}</span>
                  </div>
                  {b.detail && (
                    <p className="mt-1.5 text-sm leading-relaxed text-text-dim">{b.detail}</p>
                  )}
                  {b.source && (
                    <p className="mt-1 text-xs uppercase tracking-wide text-text-faint">
                      {b.source}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ReportSection>
        ) : (
          <ReportSection label="The session">
            <p className="text-sm text-text-dim">
              This session was logged without a block plan — the document shows what was recorded.
            </p>
          </ReportSection>
        )}

        <ReportSection label="Reflection" note="fill in after the session">
          <div className="space-y-5 text-sm">
            <div className="flex items-baseline gap-3">
              <span className="text-text">RPE</span>
              <span className="data-mono text-text-dim">_____ / 10</span>
              {entry.rpe != null && (
                <span className="text-xs text-text-faint">(logged: {entry.rpe}/10)</span>
              )}
            </div>
            <div>
              <p className="mb-6 text-text">What felt sharp?</p>
              <div className="border-b border-line" />
              <div className="mt-6 border-b border-line" />
            </div>
            <div>
              <p className="mb-6 text-text">What needs work?</p>
              <div className="border-b border-line" />
              <div className="mt-6 border-b border-line" />
            </div>
          </div>
        </ReportSection>
      </ReportShell>
    </div>
  );
}
