import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPost } from "@/lib/data/feed";
import { PostCard } from "@/components/community/post-card";
import { Comments } from "@/components/community/comments";

export const metadata = { title: "Post — MIDO XI" };

/*
  One post and its replies.

  Renders through the same `PostCard` as the feed rather than a second layout —
  a post that looks different depending on where you opened it is two posts to
  maintain, and they drift.

  `getPost` applies the same block and visibility rules the feed does, so a
  post you cannot see is not reachable by pasting its id either.
*/

export default async function PostPage({ params }: PageProps<"/app/community/posts/[id]">) {
  const { id } = await params;
  const detail = await getPost(id);
  if (!detail) notFound();

  return (
    <div className="mx-auto max-w-[560px] px-4 py-8">
      <Link
        href="/app/community"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-text-dim transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" />
        Community
      </Link>

      <PostCard post={detail.post} />
      <Comments postId={id} comments={detail.comments} />
    </div>
  );
}
