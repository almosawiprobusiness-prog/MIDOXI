import Link from "next/link";
import { notFound } from "next/navigation";
import { Clapperboard, History } from "lucide-react";
import { getVideoWithClips } from "@/lib/data/film";
import { listAnalyses } from "@/lib/data/analyses";
import { listAnnotations } from "@/lib/data/annotations";
import { getProfileSettings } from "@/lib/data/profile";
import { CONFIDENCE_META } from "@/lib/video/provider";
import { fmtTime, sentimentMeta } from "@/lib/data/film-types";
import { plural } from "@/lib/data/timeline-types";
import { ReportShell, ReportSection, Stat } from "@/components/reports/report-shell";
import { PrintButton } from "@/components/reports/print-button";
import { DemoNote } from "@/components/dashboards/shared";

export async function generateMetadata({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const detail = await getVideoWithClips(videoId);
  // Named per match: this is a document people save as a PDF, and the
  // tab title becomes the suggested filename.
  return { title: detail ? `Film analysis — ${detail.video.title}` : "Film analysis — MIDO XI" };
}

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

  const [detail, analyses, annotations, profile] = await Promise.all([
    getVideoWithClips(videoId),
    listAnalyses(videoId),
    listAnnotations(videoId),
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

  /*
    A film analysis is not only what MIDO said about the film.

    This report used to print the readings and nothing else — so a coach
    who had spent an hour cutting clips and drawing on frames got a
    document with none of their own work in it, and one that claimed to
    be empty whenever the AI had not been run. The person's marks are
    the part they trust most.
  */
  const firstRead = analyses.length ? analyses[analyses.length - 1].createdAt : null;
  const isEmpty = analyses.length === 0 && detail.clips.length === 0 && annotations.length === 0;

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
        {isEmpty ? (
          /*
            Says what to go and do, not just that there is nothing. The
            two routes to filling this page are different jobs and the
            reader may not know either exists.
          */
          <div className="py-8">
            <p className="text-sm leading-relaxed text-text">
              There is nothing on this film yet.
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-text-dim">
              <li>
                <span className="text-text-hi">Mark it up yourself.</span> Open it in the film room,
                cut clips with I and O, and draw on a frame with D. Both appear here.
              </li>
              <li>
                <span className="text-text-hi">Have MIDO read a passage.</span> Pick ten seconds or
                more and it reports what it saw, marked with how sure it is.
              </li>
            </ul>
          </div>
        ) : (
          <>
            <ReportSection label="This film">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                <Stat value={analyses.length} label={plural(analyses.length, "read")} />
                <Stat value={observations.length} label={plural(observations.length, "observation")} />
                <Stat value={detail.clips.length} label={plural(detail.clips.length, "clip")} />
                {/*
                  Guarded. This read `analyses[analyses.length - 1]`
                  unconditionally, which was safe only because the whole
                  block was behind `analyses.length === 0`. Now that
                  clips and drawings can carry the page on their own, an
                  empty `analyses` reaches here.
                */}
                {firstRead ? (
                  <Stat value={fmtDate(firstRead)} label="first read" />
                ) : (
                  <Stat value={annotations.length} label={plural(annotations.length, "drawing")} />
                )}
              </div>
            </ReportSection>

            {/*
              The legend is printed, not hidden in a tooltip. Once this leaves
              the app, nothing else explains what the words mean.

              Guarded now: a film with clips and drawings but no AI read
              has no confidence levels to explain, and a heading over an
              empty list is the report explaining nothing at length.
            */}
            {usedLevels.length > 0 && (
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
            )}

            {/*
              The person's own marks, before MIDO's. A coach reading this
              wants their own read first and the machine's second — and
              on a film nobody has run the AI over, this is the whole
              document rather than a missing one.
            */}
            {detail.clips.length > 0 && (
              <ReportSection
                label="Clips you cut"
                // `plural` returns the WORD, not the count — the count
                // has to be said alongside it or the note reads
                // "Clips you cut · clips".
                note={`${detail.clips.length} ${plural(detail.clips.length, "clip")}`}
              >
                <ul className="space-y-3">
                  {[...detail.clips]
                    .sort((a, b) => a.startSeconds - b.startSeconds)
                    .map((c) => {
                      const sm = sentimentMeta(c.sentiment);
                      return (
                        <li key={c.id} className="border-l border-line pl-3">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="data-mono text-[11px] text-text-dim">
                              {fmtTime(c.startSeconds)}
                            </span>
                            <span className="text-sm font-medium text-text-hi">{c.title}</span>
                            {sm && (
                              <span className="chip" style={{ color: sm.color }}>
                                {sm.label}
                              </span>
                            )}
                            {c.tags.map((t) => (
                              <span key={t} className="chip">
                                {t}
                              </span>
                            ))}
                          </div>
                          {c.note && (
                            <p className="mt-1 text-sm leading-relaxed text-text-dim">{c.note}</p>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </ReportSection>
            )}

            {/*
              Drawings are recorded as what they SAID, not as pictures.

              The marks are vector shapes over a video frame, and neither
              travels into a printed page: the frame is a moment of
              footage this document does not carry, and shapes without it
              are arrows pointing at nothing. So the note and the moment
              print, and the drawing itself stays where it can be seen
              properly. Claiming otherwise would be the one thing a
              report must not do.
            */}
            {annotations.length > 0 && (
              <ReportSection
                label="Drawings you made"
                note={`${annotations.length} ${plural(annotations.length, "drawing")} · open the film to see them on the frame`}
              >
                <ul className="space-y-3">
                  {annotations.map((a) => (
                    <li key={a.id} className="border-l border-line pl-3">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="data-mono text-[11px] text-text-dim">
                          {fmtTime(a.atSeconds)}
                        </span>
                        <span className="text-sm font-medium text-text-hi">
                          {a.note || "Marked, without a note"}
                        </span>
                        <span className="chip">
                          {a.shapes.length} {a.shapes.length === 1 ? "mark" : "marks"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </ReportSection>
            )}

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
