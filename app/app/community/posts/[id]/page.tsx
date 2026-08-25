import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPost } from "@/lib/data/feed";
import { PostCard } from "@/components/community/post-card";
import { Comments } from "@/components/community/comments";

/*
  Named after whose post it is. Static, every post in the app shared one
  tab — and a feed is read by opening several at once.

  The author rather than the caption: a caption runs to hundreds of
  characters and a tab shows about thirty, so it would truncate to
  nothing useful on exactly the posts worth keeping open.
*/
export async function generateMetadata({ params }: PageProps<"/app/community/posts/[id]">) {
  const { id } = await params;
  const detail = await getPost(id);
  return { title: detail ? `${detail.post.author.name} — Community` : "Post — MIDO XI" };
}

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

      {/*
        The page's heading, for screen readers only.

        This page had no <h1>: it renders the feed's own PostCard, where
        the author's name is a link to their profile and the caption is
        body text — correct inside a feed of many posts, and it leaves
        this page, which is about ONE post, with nothing to name it.
        Stated here so the card stays identical to the feed's.
      */}
      <h1 className="sr-only">{detail.post.author.name}&rsquo;s post</h1>

      <PostCard post={detail.post} />
      <Comments postId={id} comments={detail.comments} />
    </div>
  );
}
