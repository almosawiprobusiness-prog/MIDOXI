import Link from "next/link";
import { MessageSquare, Clapperboard } from "lucide-react";
import { timeAgo, type FeedPost } from "@/lib/data/community-types";
import { ReactionButton } from "./reaction-button";

export function Avatar({ name, position }: { name: string; position: string | null }) {
  const initial = (name || "P").slice(0, 1).toUpperCase();
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-signal to-signal-deep font-display text-sm font-bold text-white">
      {position || initial}
    </span>
  );
}

export function FeedPostCard({ post }: { post: FeedPost }) {
  return (
    <article className="panel p-4">
      <Link href={`/app/community/players/${post.userId}`} className="flex items-center gap-2.5">
        <Avatar name={post.authorName} position={post.authorPosition} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-text-hi hover:text-signal-bright">{post.authorName}</span>
            {post.authorHandle && <span className="text-xs text-text-faint">@{post.authorHandle}</span>}
          </div>
          <div className="label-tech">{timeAgo(post.createdAt)} ago</div>
        </div>
      </Link>

      <Link href={`/app/community/posts/${post.id}`} className="mt-3 block">
        <h3 className="font-display text-base font-semibold text-text-hi transition-colors hover:text-signal-bright">{post.title}</h3>
        <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-text-dim">{post.body}</p>
      </Link>

      {post.clip && (
        <Link href={`/app/community/posts/${post.id}`} className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-ink-850 px-3 py-2 transition-colors hover:border-signal-line">
          <Clapperboard className="size-4 shrink-0 text-signal-bright" />
          <span className="truncate text-xs text-text">{post.clip.title}</span>
          {post.clip.videoSource === "youtube" && <span className="chip ml-auto">Playable</span>}
        </Link>
      )}

      {post.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.tags.map((t) => <span key={t} className="chip">{t}</span>)}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <ReactionButton postId={post.id} count={post.reactionCount} hasReacted={post.hasReacted} />
        <Link href={`/app/community/posts/${post.id}`} className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs text-text-dim transition-colors hover:text-text">
          <MessageSquare className="size-3.5" /> {post.commentCount}
        </Link>
      </div>
    </article>
  );
}
