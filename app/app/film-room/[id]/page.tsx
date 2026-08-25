import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getVideoWithClips } from "@/lib/data/film";
import { listAnalyses } from "@/lib/data/analyses";
import { listAnnotations } from "@/lib/data/annotations";
import { listGoals } from "@/lib/data/development";
import { FilmStudio } from "@/components/film/film-studio";
import { DeleteVideoButton } from "@/components/film/delete-video-button";
import { StartStudyButton } from "@/components/film/start-study-button";

/*
  A real title per video.

  Every film-room route used to render the same generic tab title, which
  is worst exactly when it matters: presenting from a laptop with four
  matches open, every tab reading "MIDO XI — Football Performance OS".
*/
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getVideoWithClips(id);
  return { title: detail ? `${detail.video.title} — Film Room` : "Film Room — MIDO XI" };
}

export default async function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // None of the four depend on each other — only on the id — so they go
  // together rather than one after another.
  const [detail, analyses, annotations, allGoals] = await Promise.all([
    getVideoWithClips(id),
    listAnalyses(id),
    listAnnotations(id),
    listGoals(),
  ]);
  if (!detail) notFound();

  const goals = allGoals
    .filter((g) => g.status !== "achieved")
    .map((g) => ({ id: g.id, title: g.title }));

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-6">
      <Link href="/app/film-room" className="mb-4 inline-flex items-center gap-2 text-sm text-text-dim transition-colors hover:text-text-hi">
        <ArrowLeft className="size-4" /> Film Room
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label-tech">Study session</div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-text-hi">{detail.video.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <StartStudyButton videoId={detail.video.id} defaultTitle={`Study — ${detail.video.title}`} goals={goals} />
          <DeleteVideoButton id={detail.video.id} title={detail.video.title} />
        </div>
      </div>

      <FilmStudio
        video={detail.video}
        clips={detail.clips}
        goals={goals}
        analyses={analyses}
        annotations={annotations}
      />
    </div>
  );
}
