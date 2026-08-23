import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Grid3x3, ImageOff, Play } from "lucide-react";
import { getProfileSummary, listFeed } from "@/lib/data/feed";
import { compactCount, displayHandle } from "@/lib/data/feed-types";
import { plural } from "@/lib/data/timeline-types";
import { Avatar } from "@/components/community/post-card";
import { FollowButton } from "@/components/community/follow-button";

export const metadata = { title: "Profile — MIDO XI" };

/*
  A player's profile, as a grid.

  Deliberately football rather than social: the line under the name is their
  position and club, not a follower count dressed up as an achievement. The
  counts are there — a profile without them does not read as a profile — but
  they are small, in the same weight as everything else, and posts come first
  because that is what somebody came to look at.

  There is no bio-link, no story ring and no verified tick. Those are the parts
  of Instagram that exist to make people want status, and this is a product
  about getting better at football.
*/

export default async function ProfilePage({ params }: PageProps<"/app/community/[handle]">) {
  const { handle } = await params;
  const profile = await getProfileSummary(handle);
  if (!profile) notFound();

  const posts = await listFeed({ authorId: profile.userId, limit: 60 });
  const identity = [profile.position, profile.club].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-[720px] px-4 py-8">
      <Link
        href="/app/community"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-text-dim transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" />
        Community
      </Link>

      <header className="flex flex-wrap items-start gap-5">
        <Avatar url={profile.avatar} name={profile.name} size={88} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-hi">
              {profile.name}
            </h1>
            {!profile.isMe && (
              <FollowButton targetId={profile.userId} following={profile.followedByMe} />
            )}
          </div>

          <p className="mt-0.5 text-sm text-text-faint">
            {displayHandle({ handle: profile.handle, name: profile.name })}
          </p>
          {identity && <p className="mt-1 text-sm text-text-dim">{identity}</p>}

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <Count n={profile.posts} label={plural(profile.posts, "post")} />
            <Count n={profile.followers} label={plural(profile.followers, "follower")} />
            {/* "following" is the same either way — it is a gerund, not a count noun. */}
            <Count n={profile.following} label="following" />
          </div>

          {profile.bio && (
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-text">{profile.bio}</p>
          )}
        </div>
      </header>

      <div className="mt-8 mb-3 flex items-center gap-2 border-b border-line pb-2">
        <Grid3x3 className="size-4 text-text-faint" />
        <span className="label-tech">Posts</span>
      </div>

      {posts.length === 0 ? (
        <div className="py-12 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-lg border border-line bg-ink-850 text-text-faint">
            <ImageOff className="size-5" />
          </span>
          <p className="mt-3 text-sm text-text-dim">
            {profile.isMe ? "You have not posted yet." : `${profile.name} has not posted yet.`}
          </p>
        </div>
      ) : (
        /*
          Three across, square, no gaps beyond a hairline — the grid people
          already know how to read. A post with no media shows its caption,
          because a blank tile in a grid looks like something failed to load.
        */
        <div className="grid grid-cols-3 gap-1">
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/app/community/posts/${p.id}`}
              className="group relative aspect-square overflow-hidden bg-ink-850"
            >
              {p.media?.kind === "photo" ? (
                <Image
                  src={p.media.url}
                  alt=""
                  fill
                  unoptimized
                  sizes="(max-width: 720px) 33vw, 240px"
                  className="object-cover transition-transform group-hover:scale-105"
                />
              ) : p.media?.kind === "youtube" ? (
                <>
                  <Image
                    src={`https://i.ytimg.com/vi/${p.media.url}/mqdefault.jpg`}
                    alt=""
                    fill
                    unoptimized
                    sizes="(max-width: 720px) 33vw, 240px"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                  <Play className="absolute right-2 top-2 size-4 fill-white text-white drop-shadow" />
                </>
              ) : p.media?.kind === "video" ? (
                <>
                  <video
                    src={p.media.url}
                    preload="metadata"
                    muted
                    playsInline
                    className="size-full object-cover"
                  />
                  <Play className="absolute right-2 top-2 size-4 fill-white text-white drop-shadow" />
                </>
              ) : (
                <p className="line-clamp-5 p-3 text-xs leading-relaxed text-text-dim">
                  {p.caption}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <span className="text-text-dim">
      <span className="data-mono text-text-hi">{compactCount(n)}</span> {label}
    </span>
  );
}
