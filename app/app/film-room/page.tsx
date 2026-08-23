import Link from "next/link";
import { Clapperboard, Play, Film, Plus, FolderOpen, BookOpen, CheckCircle2, Circle, Star } from "lucide-react";
import { listVideos, listClips } from "@/lib/data/film";
import { listCollections } from "@/lib/data/collections";
import { listStudySessions } from "@/lib/data/study";
import { getDiscover } from "@/lib/data/discover";
import { isDemoMode } from "@/lib/env";
import { fmtTime } from "@/lib/data/film-types";
import { AddVideoDialog } from "@/components/film/add-video-dialog";
import { DiscoverPanel } from "@/components/film/discover-panel";
import { ClipLibrary } from "@/components/film/clip-library";
import { CreateCollectionDialog } from "@/components/film/create-collection-dialog";
import { SectionHeader, sentimentStyle } from "@/components/ui/primitives";
import { PageHeader, StatBand } from "@/components/ui/kit";

export const metadata = { title: "Film Room — MIDO XI" };

const SENTIMENTS = ["positive", "review", "correction"] as const;

export default async function FilmRoomPage() {
  const [videos, clips, collections, studySessions, discover] = await Promise.all([
    listVideos(), listClips(), listCollections(), listStudySessions(), getDiscover(),
  ]);
  const videoMap = Object.fromEntries(videos.map((v) => [v.id, v.title]));
  const clipCount = (vid: string) => clips.filter((c) => c.videoId === vid).length;
  const favourites = clips.filter((c) => c.favorite).length;
  const sentimentCount = (s: string) => clips.filter((c) => (c.sentiment ?? "review") === s).length;
  const totalSent = clips.length || 1;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <PageHeader
        icon={Clapperboard}
        title="Film Room"
        tagline="Upload, clip, tag and study — a true analysis room, not a video dump."
        actions={<AddVideoDialog />}
      />

      <DiscoverPanel result={discover} />

      {/* Library overview */}
      <section className="mb-8 grid gap-4 lg:grid-cols-[1fr_auto]">
        <StatBand
          cols={4}
          stats={[
            { label: "Videos", value: videos.length },
            { label: "Clips", value: clips.length },
            { label: "Collections", value: collections.length },
            { label: "Favourites", value: favourites },
          ]}
        />
        {clips.length > 0 && (
          <div className="panel flex flex-col justify-center px-5 py-3">
            <div className="label-tech mb-2">Clip sentiment</div>
            <div className="flex h-2 w-44 overflow-hidden rounded-full">
              {SENTIMENTS.map((s) => (
                <span key={s} style={{ width: `${(sentimentCount(s) / totalSent) * 100}%`, background: sentimentStyle[s].color }} />
              ))}
            </div>
            <div className="mt-2 flex gap-3 text-[11px] text-text-dim">
              {SENTIMENTS.map((s) => (
                <span key={s} className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full" style={{ background: sentimentStyle[s].color }} />
                  {sentimentCount(s)}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Videos */}
      <section className="mb-8">
        <SectionHeader label={`Videos · ${videos.length}`} />
        {videos.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => {
              const thumb = v.source === "youtube" && v.externalId ? `https://img.youtube.com/vi/${v.externalId}/mqdefault.jpg` : v.thumbnailUrl;
              return (
                <Link key={v.id} href={`/app/film-room/${v.id}`} className="min-w-0 group panel overflow-hidden transition-colors hover:border-line-strong">
                  <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-gradient-to-br from-ink-800 to-ink-925">
                    {thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    )}
                    <span className="relative grid size-12 place-items-center rounded-full bg-black/50 text-text-hi backdrop-blur-sm transition-colors group-hover:bg-signal group-hover:text-white">
                      <Play className="size-5" fill="currentColor" />
                    </span>
                    <span className="absolute right-2 top-2">
                      {v.source === "youtube" ? (
                        <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-text-dim">YT</span>
                      ) : (
                        <Film className="size-4 text-text-dim" />
                      )}
                    </span>
                    {v.durationSeconds ? (
                      <span className="data-mono absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-text">{fmtTime(v.durationSeconds)}</span>
                    ) : null}
                  </div>
                  <div className="p-3">
                    <div className="truncate text-sm font-medium text-text-hi">{v.title}</div>
                    <div className="label-tech mt-0.5">{clipCount(v.id)} clips</div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="panel flex flex-col items-center justify-center px-6 py-12 text-center">
            <span className="grid size-12 place-items-center rounded-xl border border-line bg-ink-850 text-signal-bright"><Plus className="size-6" /></span>
            <h3 className="mt-4 font-display text-lg font-semibold text-text-hi">Your film library is empty</h3>
            <p className="mt-1.5 max-w-sm text-sm text-text-dim">Add a match video or a study link to start clipping and tagging.</p>
            <div className="mt-5"><AddVideoDialog /></div>
          </div>
        )}
      </section>

      {/* Collections */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <SectionHeader label={`Collections · ${collections.length}`} />
          <CreateCollectionDialog compact />
        </div>
        {collections.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {collections.map((col) => (
              <Link key={col.id} href={`/app/film-room/collections/${col.id}`} className="min-w-0 group panel flex items-center gap-3 p-4 transition-colors hover:border-line-strong">
                <span className="grid size-9 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
                  <FolderOpen className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-text-hi">{col.name}</div>
                  <div className="label-tech">{col.clipCount} clips</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="panel p-4 text-sm text-text-dim">No collections yet. Group clips into reels — best finishes, pressing, movement.</p>
        )}
      </section>

      {/* Study sessions */}
      {studySessions.length > 0 && (
        <section className="mb-8">
          <SectionHeader label={`Study sessions · ${studySessions.length}`} action={{ label: "Intelligence", href: "/app/library" }} />
          <div className="space-y-2">
            {studySessions.map((s) => (
              <Link key={s.id} href={`/app/film-room/study/${s.id}`} className="group panel flex items-center gap-3 p-4 transition-colors hover:border-line-strong">
                <span className={s.completed ? "text-positive" : "text-text-faint"}>
                  {s.completed ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-text-hi">{s.title}</div>
                  <div className="label-tech">{s.completed ? "Completed" : "In progress"}</div>
                </div>
                <BookOpen className="size-4 text-text-faint" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Clip library */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionHeader label={`Clip library · ${clips.length}`} />
          {favourites > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-text-dim">
              <Star className="size-3.5 text-review" fill="var(--review)" /> {favourites} favourite{favourites > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <ClipLibrary clips={clips} videoMap={videoMap} />
      </section>

      {isDemoMode && (
        <p className="mt-6 flex items-center justify-center gap-2 text-[11px] text-text-faint">
          <span className="size-1.5 rounded-full bg-review" /> Demo mode — changes persist for this session only. Sample footage is a public-domain placeholder.
        </p>
      )}
    </div>
  );
}
