import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderOpen, Star } from "lucide-react";
import { getCollectionDetail, getCollectionReel } from "@/lib/data/collections";
import { listVideos } from "@/lib/data/film";
import { sentimentMeta, fmtTime } from "@/lib/data/film-types";
import { DeleteCollectionButton } from "@/components/film/delete-collection-button";
import { CollectionReelLauncher } from "@/components/film/collection-reel-launcher";
import { ClipThumb } from "@/components/film/video-thumb";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCollectionDetail(id);
  return { title: detail ? `${detail.collection.name} — Film Room` : "Collection — MIDO XI" };
}

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // None of the three depend on each other, so they go together.
  const [detail, reel, videos] = await Promise.all([
    getCollectionDetail(id),
    getCollectionReel(id),
    listVideos(),
  ]);
  if (!detail) notFound();

  const videoMap = Object.fromEntries(videos.map((v) => [v.id, v.title]));
  // The full video, for a clip card that wants a frame rather than a title.
  const videoById = Object.fromEntries(videos.map((v) => [v.id, v]));
  const { collection, clips } = detail;

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6">
      <Link href="/app/film-room" className="mb-5 inline-flex items-center gap-2 text-sm text-text-dim transition-colors hover:text-text-hi">
        <ArrowLeft className="size-4" /> Film Room
      </Link>

      {/*
        The same floodlit pitch as the film room, deliberately.

        A third photograph would have been a third thing to look at; the
        rooms that hold match footage sharing one image reads as the same
        place rather than a gallery. The clip cards below carry the
        variety — each paints its own frame.
      */}
      <div className="relative -mx-4 mb-6 overflow-hidden md:-mx-6">
        <div
          aria-hidden
          className="absolute inset-0 bg-[url('/img/floodlights.jpg')] bg-cover bg-[center_60%] opacity-60"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-ink-950/50 via-ink-950/80 to-ink-950"
        />
        <div className="relative flex flex-wrap items-center gap-3 px-4 pb-9 pt-10 md:px-6">
          <span className="grid size-11 place-items-center rounded-lg border border-line bg-ink-850/80 text-signal-bright backdrop-blur">
            <FolderOpen className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-hi">{collection.name}</h1>
            <p className="text-sm text-text-dim">{clips.length} {clips.length === 1 ? "clip" : "clips"}</p>
          </div>
          <div className="ml-auto">
            <DeleteCollectionButton id={collection.id} />
          </div>
        </div>
      </div>

      <CollectionReelLauncher
        name={collection.name}
        items={reel?.items ?? []}
        annotations={reel?.annotations ?? []}
      >
      {clips.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {clips.map((c) => {
            const sm = sentimentMeta(c.sentiment);
            return (
              <Link key={c.id} href={`/app/film-room/${c.videoId}`} className="min-w-0 group panel flex items-start gap-3 overflow-hidden p-3 transition-colors hover:border-line-strong">
                {/*
                  The moment itself, not a timestamp beside a name. A
                  themed collection is the one place a list of titles
                  tells you least — "Near-post arrival" from four
                  different matches reads the same four times.
                */}
                {videoById[c.videoId] ? (
                  <span className="w-24 shrink-0 overflow-hidden rounded-md">
                    <ClipThumb video={videoById[c.videoId]} atSeconds={c.startSeconds} />
                  </span>
                ) : null}
                <span className="data-mono shrink-0 rounded-md border border-line px-2 py-1 text-xs text-signal-bright">{fmtTime(c.startSeconds)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-text-hi">{c.title}</span>
                    {c.favorite && <Star className="size-3.5 shrink-0 text-review" fill="var(--review)" />}
                    {sm && <span className="chip" style={{ color: sm.color, borderColor: sm.color }}>{sm.label}</span>}
                  </div>
                  <div className="label-tech mt-0.5 truncate">{videoMap[c.videoId] ?? "Video"}</div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="panel px-6 py-12 text-center text-sm text-text-dim">
          This collection is empty. Add clips from the Film Room or a study session.
        </div>
      )}
      </CollectionReelLauncher>
    </div>
  );
}
