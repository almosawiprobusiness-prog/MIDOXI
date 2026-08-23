import Link from "next/link";
import { notFound } from "next/navigation";
import { Clapperboard, History } from "lucide-react";
import { getVideoWithClips } from "@/lib/data/film";
import { listAnalyses } from "@/lib/data/analyses";
import { getProfileSettings } from "@/lib/data/profile";
import { CONFIDENCE_META } from "@/lib/video/provider";
import { fmtTime } from "@/lib/data/film-types";
import { plural } from "@/lib/data/timeline-types";
import { ReportShell, ReportSection, Stat } from "@/components/reports/report-shell";
import { PrintButton } from "@/components/reports/print-button";
import { DemoNote } from "@/components/dashboards/shared";

export const metadata = { title: "Film analysis — MIDO XI" };

/*
  One video's readings, as a document a coach can hold.

  This is the report where the confidence markers matter most. A coach reading
  "you were late to press at 30:15" needs to know whether that is something
  MIDO saw or something MIDO worked out — and, on amateur footage, whether it
  is even certain the player in shot is the one the report is about.

  So every observation carries its marker, and the legend explaining the three
  levels is printed on the page rather than left in the app. A document that
  leaves the building has to be readable without the product around it.
*/

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function FilmReportPage({ params }: PageProps<"/app/reports/film/[videoId]">) {
  const { videoId } = await params;

  const [detail, analyses, profile] = await Promise.all([
    getVideoWithClips(videoId),
    listAnalyses(videoId),
    getProfileSettings(),
  ]);
  if (!detail?.video) notFound();

  const observations = analyses.flatMap((a) =>
    a.observations.map((o) => ({ ...o, on: a.createdAt, kind: a.kind, focus: a.focus })),
  );
  const counts = observations.reduce<Record<string, number>>((acc, o) => {
    const k = o.confidence ?? "observed";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const usedLevels = (["observed", "inferred", "uncertain"] as const).filter((l) => counts[l]);

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 md:px-6">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/app/film-room/${videoId}`} className={navChip}>
          <Clapperboard className="size-3.5" />
          Back to the film
        </Link>
        <Link href="/app/reports" className={`${navChip} ml-auto`}>
          All reports
        </Link>
        <Link href="/app/timeline" className={navChip}>
          <History className="size-3.5" />
          Timeline
        </Link>
      </div>

      {detail.video.id.startsWith("v_") && (
        <div className="no-print mb-4">
          <DemoNote>A seeded video. A real one reports your own readings.</DemoNote>
        </div>
      )}

      <PrintButton
        title="Film analysis"
        detail={`${detail.video.title}. Every observation is marked with how sure MIDO is — that marking prints too.`}
      />

      <ReportShell
        kind="Film analysis"
        title={profile.knownAs || profile.fullName || "Player"}
        subtitle={detail.video.title}
        player={{
          name: profile.fullName,
          knownAs: profile.knownAs,
          avatarUrl: profile.avatarUrl,
          identity: [profile.primaryPosition, profile.club].filter(Boolean),
        }}
        footnote="MIDO cannot identify a specific player from amateur footage on its own. Anything said about this player specifically is marked Inferred at best."
      >
        {analyses.length === 0 ? (
          <p className="py-8 text-sm leading-relaxed text-text-dim">
            Nothing has been read on this film yet. Open it in the film room and analyse a passage.
          </p>
        ) : (
          <>
            <ReportSection label="This film">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                <Stat value={analyses.length} label={plural(analyses.length, "read")} />
                <Stat value={observations.length} label={plural(observations.length, "observation")} />
                <Stat value={detail.clips.length} label={plural(detail.clips.length, "clip")} />
                <Stat value={fmtDate(analyses[analyses.length - 1].createdAt)} label="first read" />
              </div>
            </ReportSection>

            {/*
              The legend is printed, not hidden in a tooltip. Once this leaves
              the app, nothing else explains what the words mean.
            */}
            <ReportSection label="How to read this">
              <dl className="space-y-1.5">
                {usedLevels.map((level) => (
                  <div key={level} className="flex gap-2.5 text-sm">
                    <dt
                      className="w-20 shrink-0 font-medium"
                      style={{ color: CONFIDENCE_META[level].color }}
                    >
                      {CONFIDENCE_META[level].label}
                    </dt>
                    <dd className="min-w-0 leading-relaxed text-text-dim">
                      {CONFIDENCE_META[level].hint}
                    </dd>
                  </div>
                ))}
              </dl>
            </ReportSection>

            {analyses.map((a) => (
              <ReportSection
                key={a.id}
                label={`${fmtTime(a.fromSeconds)}–${fmtTime(a.toSeconds)}`}
                note={
                  a.kind === "video"
                    ? `read from the clip itself${a.focus ? ` · ${a.focus}` : ""}`
                    : `${a.framesSampled} sampled frames${a.focus ? ` · ${a.focus}` : ""}`
                }
              >
                {a.summary && (
                  <p className="mb-3 whitespace-pre-line text-sm leading-relaxed text-text">
                    {a.summary}
                  </p>
                )}
                <ul className="space-y-3">
                  {a.observations.map((o, i) => {
                    const meta = CONFIDENCE_META[o.confidence ?? "observed"];
                    return (
                      <li key={i} className="border-l border-line pl-3">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="data-mono text-[11px] text-text-dim">
                            {fmtTime(o.atSeconds)}
                          </span>
                          <span className="text-sm font-medium text-text-hi">{o.title}</span>
                          <span className="chip" style={{ color: meta.color }}>
                            {meta.label}
                          </span>
                          {o.concept && (
                            <span className="chip">{o.concept.replace(/-/g, " ")}</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-text-dim">{o.body}</p>
                      </li>
                    );
                  })}
                </ul>
              </ReportSection>
            ))}
          </>
        )}
      </ReportShell>
    </div>
  );
}

const navChip =
  "flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-text";
