import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getStudySessionDetail } from "@/lib/data/study";
import { getVideoWithClips } from "@/lib/data/film";
import { listGoals } from "@/lib/data/development";
import { StudySessionView } from "@/components/film/study-session";

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

      <div className="mb-5">
        <div className="label-tech">Study session · distraction-free</div>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-text-hi md:text-3xl">{session.title}</h1>
      </div>

      <StudySessionView session={session} notes={notes} video={video} goalTitle={goalTitle} />
    </div>
  );
}
