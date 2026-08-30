import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getStudySessionDetail } from "@/lib/data/study";
import { getVideoWithClips } from "@/lib/data/film";
import { listGoals } from "@/lib/data/development";
import { StudySessionView } from "@/components/film/study-session";
import { ShareArtifact } from "@/components/community/share-artifact";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getStudySessionDetail(id);
  return { title: detail ? `${detail.session.title} — Study` : "Study — MIDO XI" };
}

export default async function StudyModePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getStudySessionDetail(id);
  if (!detail) notFound();

  const { session, notes } = detail;
  const video = session.videoId ? (await getVideoWithClips(session.videoId))?.video ?? null : null;
  const goalTitle = session.goalId
    ? (await listGoals()).find((g) => g.id === session.goalId)?.title ?? null
    : null;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-6">
      <Link href="/app/film-room" className="mb-4 inline-flex items-center gap-2 text-sm text-text-dim transition-colors hover:text-text-hi">
        <ArrowLeft className="size-4" /> Film Room
      </Link>

      {/*
        A photograph behind the title only, and nowhere near the work.

        This page calls itself distraction-free, which is a real
        constraint rather than a slogan: below this strip are the film,
        the note composer and the timeline, and none of them should have
        anything moving behind them. So the image warms the way IN and
        stops at the header's edge.

        One player working alone on a small-sided pitch — chosen for the
        subject as much as the look, because that is what a study
        session is.
      */}
      <div className="relative -mx-4 mb-5 overflow-hidden md:-mx-6">
        <div
          aria-hidden
          className="absolute inset-0 bg-[url('/img/solo-strike.jpg')] bg-cover bg-[center_42%] opacity-40"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-ink-950/55 via-ink-950/80 to-ink-950"
        />
        <div className="relative px-4 pb-8 pt-10 md:px-6">
          <div className="label-tech">Study session · distraction-free</div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-text-hi md:text-3xl">{session.title}</h1>
          {/*
            Only once it is finished, and only by the player's hand:
            a completed study may leave the record as a post, drafted
            from their own summary and confirmed before anything moves.
          */}
          {session.completed && (
            <div className="mt-3">
              <ShareArtifact
                label="Share this study"
                tag="study"
                draft={`Studied: ${session.title}.${session.summary ? `\n\nWhat I took from it: ${session.summary}` : ""}`}
              />
            </div>
          )}
        </div>
      </div>

      <StudySessionView session={session} notes={notes} video={video} goalTitle={goalTitle} />
    </div>
  );
}
