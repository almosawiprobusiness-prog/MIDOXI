import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clapperboard } from "lucide-react";
import { getPostDetail } from "@/lib/data/community";
import { getCurrentUser } from "@/lib/auth/session";
import { timeAgo } from "@/lib/data/community-types";
import { Avatar } from "@/components/community/feed-post";
import { ReactionButton } from "@/components/community/reaction-button";
import { CommentSection } from "@/components/community/comment-section";
import { DeletePostButton } from "@/components/community/delete-post-button";
import { fmtTime } from "@/lib/data/film-types";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPostDetail(id);
  if (!detail) notFound();

  const user = await getCurrentUser();
  const { post, comments } = detail;
  const isOwner = user?.id === post.userId;

  return (
    <div className="mx-auto max-w-[720px] px-4 py-8 md:px-6">
      <Link href="/app/community" className="mb-5 inline-flex items-center gap-2 text-sm text-text-dim transition-colors hover:text-text-hi">
        <ArrowLeft className="size-4" /> Community
      </Link>

      <article className="panel-raised p-5">
        <div className="flex items-center gap-2.5">
          <Avatar name={post.authorName} position={post.authorPosition} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-text-hi">{post.authorName}</span>
              {post.authorHandle && <span className="text-xs text-text-faint">@{post.authorHandle}</span>}
            </div>
            <div className="label-tech">{timeAgo(post.createdAt)} ago</div>
          </div>
          {isOwner && <div className="ml-auto"><DeletePostButton id={post.id} /></div>}
        </div>

        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-text-hi">{post.title}</h1>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text">{post.body}</p>

        {post.clip && (
          <div className="mt-4">
            {post.clip.videoSource === "youtube" && post.clip.videoExternalId ? (
              <div className="overflow-hidden rounded-xl border border-line bg-black">
                <div className="aspect-video">
                  <iframe
                    className="size-full"
                    src={`https://www.youtube.com/embed/${post.clip.videoExternalId}?start=${Math.floor(post.clip.start)}`}
                    title={post.clip.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-line bg-ink-850 p-4">
                <span className="grid size-10 place-items-center rounded-lg border border-line text-signal-bright"><Clapperboard className="size-5" /></span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-text-hi">{post.clip.title}</div>
                  <div className="label-tech">Clip · {fmtTime(post.clip.start)} · private footage</div>
                </div>
              </div>
            )}
            {post.clip.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {post.clip.tags.map((t) => <span key={t} className="chip">{t}</span>)}
              </div>
            )}
          </div>
        )}

        {post.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {post.tags.map((t) => <span key={t} className="chip">{t}</span>)}
          </div>
        )}

        <div className="mt-4 border-t border-line pt-4">
          <ReactionButton postId={post.id} count={post.reactionCount} hasReacted={post.hasReacted} />
        </div>
      </article>

      <div className="mt-6">
        <CommentSection postId={post.id} comments={comments} currentUserId={user?.id ?? null} />
      </div>
    </div>
  );
}
