import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderOpen, Star } from "lucide-react";
import { getCollectionDetail, getCollectionReel } from "@/lib/data/collections";
import { listVideos } from "@/lib/data/film";
import { sentimentMeta, fmtTime } from "@/lib/data/film-types";
import { DeleteCollectionButton } from "@/components/film/delete-collection-button";
import { CollectionReelLauncher } from "@/components/film/collection-reel-launcher";

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
  const { collection, clips } = detail;

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6">
      <Link href="/app/film-room" className="mb-5 inline-flex items-center gap-2 text-sm text-text-dim transition-colors hover:text-text-hi">
        <ArrowLeft className="size-4" /> Film Room
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="grid size-11 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
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
              <Link key={c.id} href={`/app/film-room/${c.videoId}`} className="min-w-0 group panel flex items-start gap-3 p-3 transition-colors hover:border-line-strong">
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
