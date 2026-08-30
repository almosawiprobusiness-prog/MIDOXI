import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getVideoWithClips } from "@/lib/data/film";
import { listAnalyses } from "@/lib/data/analyses";
import { listAnnotations } from "@/lib/data/annotations";
import { listGoals } from "@/lib/data/development";
import { activeJobForVideo } from "@/lib/data/analysis-jobs";
import { FilmStudio } from "@/components/film/film-studio";
import { EmbeddedStage } from "@/components/film/embedded-stage";
import { AnalysisJobPanel } from "@/components/film/analysis-job-panel";
import { DeleteVideoButton } from "@/components/film/delete-video-button";
import { StartStudyButton } from "@/components/film/start-study-button";
import { checkFeature } from "@/lib/billing/membership";
import { nativeVideo } from "@/lib/video/native-video";
import { videoUrlKind } from "@/lib/data/film-types";

/*
  A Vision job advance runs an upload + a native video read inside one
  server-action invocation — measured at 31-43s of model time for a
  90s window, plus upload and file-ACTIVE polling. The platform default
  budget is shorter than the worst case, and a job that dies to a
  timeout looks like a Vision failure when it is a plumbing one.
*/
export const maxDuration = 120;

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

  // None of these depend on each other — only on the id — so they go
  // together rather than one after another.
  const [detail, analyses, annotations, allGoals, activeJob, videoStatus, gate] = await Promise.all([
    getVideoWithClips(id),
    listAnalyses(id),
    listAnnotations(id),
    listGoals(),
    activeJobForVideo(id),
    nativeVideo.status(),
    checkFeature("deep_analyses"),
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

      {(() => {
        /*
          A page URL (sport.video, Veo, a club stream) gets the embedded
          stage — the site's own player framed here, moments logged by
          the player's clock. Everything else keeps the full studio.
          Only `source: "url"` can be a page; uploads resolve to storage
          URLs and never take this branch.
        */
        const detectedKind =
          detail.video.source === "url" ? videoUrlKind(detail.video.url) : null;
        if (detectedKind?.kind === "page") {
          return <EmbeddedStage video={detail.video} clips={detail.clips} host={detectedKind.host} />;
        }
        /*
          The job panel appears only where a native read can actually
          run: the provider is configured, and the source is one it can
          reach (YouTube by URL, uploads via storage — not HLS, whose
          playlists have no content-length to stream from).
        */
        const jobCapable =
          videoStatus.available &&
          (detail.video.source === "youtube" || detail.video.source === "upload");
        return (
          <>
            {jobCapable && (
              <div className="mb-4">
                <AnalysisJobPanel
                  videoId={detail.video.id}
                  initialJob={activeJob}
                  allowanceLeft={gate.limit > 0 ? Math.max(0, gate.limit - gate.used) : null}
                />
              </div>
            )}
            <FilmStudio
              video={detail.video}
              clips={detail.clips}
              goals={goals}
              analyses={analyses}
              annotations={annotations}
            />
          </>
        );
      })()}
    </div>
  );
}
