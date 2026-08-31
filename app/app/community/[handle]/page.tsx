import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ImageOff, Play } from "lucide-react";
import { getProfileSummary, listFeed } from "@/lib/data/feed";
import { compactCount, displayHandle, type Post, type PostKind } from "@/lib/data/feed-types";
import { plural } from "@/lib/data/timeline-types";
import { Avatar } from "@/components/ui/avatar";
import { FollowButton } from "@/components/community/follow-button";

/*
  Named after the player. Static, every profile in the app shared one
  tab title — and browsing a community is precisely when several are
  open at once.
*/
export async function generateMetadata({ params }: PageProps<"/app/community/[handle]">) {
  const { handle } = await params;
  const profile = await getProfileSummary(handle);
  return { title: profile ? `${profile.name} — Community` : "Profile — MIDO XI" };
}

/*
  A player's profile — the Framer-designed football identity.

  The identity band answers WHO IS THIS PLAYER / WHAT DO THEY PLAY /
  WHAT ARE THEY WORKING ON: portrait, the name in the display voice,
  ST · NORTHGATE FC · #9 in mono caps, the bio, and — the emotional
  center — the MY GAME strip, which is the player's own public line
  about what they are building. Counts exist (a profile without them
  does not read as a profile) but they are small and quiet, because
  this is a product about getting better at football, not status.

  Content tabs only appear when there is content behind them.

  There is no bio-link, no story ring and no verified tick. Those are
  the parts of Instagram that exist to make people want status.
*/

const TAB_KINDS: { id: PostKind; label: string }[] = [
  { id: "film", label: "Film" },
  { id: "training", label: "Training" },
  { id: "match", label: "Matches" },
];

export default async function ProfilePage({
  params,
  searchParams,
}: PageProps<"/app/community/[handle]">) {
  const { handle } = await params;
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "";

  const profile = await getProfileSummary(handle);
  if (!profile) notFound();

  const posts = await listFeed({ authorId: profile.userId, limit: 60 });
  const identity = [
    profile.position,
    profile.club,
    profile.squadNumber != null ? `#${profile.squadNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Tabs only exist where content does.
  const tabs = [
    { id: "", label: "Posts", count: posts.length },
    ...TAB_KINDS.map((t) => ({
      id: t.id as string,
      label: t.label,
      count: posts.filter((p) => p.kind === t.id).length,
    })).filter((t) => t.count > 0),
  ];
  const shown = tab ? posts.filter((p) => p.kind === tab) : posts;

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8">
      <Link
        href="/app/community"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-text-dim transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" />
        Community
      </Link>

      {/* Identity band */}
      <header className="panel overflow-hidden">
        <div className="flex flex-wrap items-start gap-6 p-6">
          <Avatar url={profile.avatar} name={profile.name} size={112} />

          <div className="min-w-0 flex-1">
            <div className="data-mono text-[10px] uppercase tracking-[0.2em] text-text-faint">
              MIDO XI / Community profile
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-4">
              <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-wide text-text-hi">
                {profile.name}
              </h1>
              {!profile.isMe && (
                <FollowButton targetId={profile.userId} following={profile.followedByMe} />
              )}
            </div>

            <p className="data-mono mt-2 text-[11px] uppercase tracking-wider text-text-dim">
              {[identity, displayHandle({ handle: profile.handle, name: profile.name })]
                .filter(Boolean)
                .join(" · ")}
            </p>

            {profile.bio && (
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-text">{profile.bio}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <Count n={profile.posts} label={plural(profile.posts, "post")} />
              <Count n={profile.followers} label={plural(profile.followers, "follower")} />
              {/* "following" is the same either way — a gerund, not a count noun. */}
              <Count n={profile.following} label="following" />
            </div>
          </div>
        </div>

        {/*
          The emotional center: what they are building, in their own
          public words — not a follower count dressed as an achievement.
        */}
        {profile.playStyle ? (
          <div className="border-t border-signal-line bg-signal-wash px-6 py-3">
            <span className="data-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
              My game
            </span>
            <div className="font-display mt-0.5 text-xl font-bold uppercase leading-tight text-text-hi">
              {profile.playStyle}
            </div>
          </div>
        ) : profile.isMe ? (
          <div className="border-t border-line px-6 py-3">
            <Link href="/app/settings" className="text-xs text-text-dim underline hover:text-text">
              Add a &ldquo;my game&rdquo; line in settings — it becomes the headline of this profile.
            </Link>
          </div>
        ) : null}
      </header>

      {/* Content tabs — only ones with something behind them. */}
      <div className="data-mono mt-8 mb-3 flex gap-5 border-b border-line pb-2 text-[11px] uppercase tracking-wider">
        {tabs.map((t) => {
          const active = tab === t.id;
          const href = t.id
            ? `/app/community/${handle}?tab=${t.id}`
            : `/app/community/${handle}`;
          return (
            <Link
              key={t.id}
              href={href}
              className={active ? "text-signal-bright" : "text-text-dim transition-colors hover:text-text"}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {shown.length === 0 ? (
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
          Three across, square, hairline gaps — the grid people already
          know how to read. A post with no media shows its words as a
          quote tile, because a blank tile looks like a loading failure.
        */
        <div className="grid grid-cols-3 gap-1">
          {shown.map((p) => (
            <GridTile key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function GridTile({ post: p }: { post: Post }) {
  return (
    <Link
      href={`/app/community/posts/${p.id}`}
      className="group relative aspect-square overflow-hidden bg-ink-850"
    >
      {p.media?.kind === "photo" ? (
        <Image
          src={p.media.url}
          alt=""
          fill
          unoptimized
          sizes="(max-width: 820px) 33vw, 270px"
          className="object-cover transition-transform group-hover:scale-105"
        />
      ) : p.media?.kind === "youtube" ? (
        <>
          <Image
            src={`https://i.ytimg.com/vi/${p.media.url}/mqdefault.jpg`}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 820px) 33vw, 270px"
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
        // The quote tile — words as media, in the display voice.
        <span className="flex size-full items-end bg-signal-wash p-3">
          <span className="font-display line-clamp-4 text-base font-bold uppercase leading-tight text-text-hi">
            {p.caption}
          </span>
        </span>
      )}
    </Link>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <span className="text-text-dim">
      <span className="data-mono text-text-hi">{compactCount(n)}</span> {label}
    </span>
  );
}
