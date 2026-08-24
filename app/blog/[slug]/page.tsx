import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getBlogPost, BLOG_POSTS, formatPostDate } from "@/lib/blog/posts";
import { BlogBody } from "@/components/blog/blog-body";

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  return { title: post ? `${post.title} — MIDO XI` : "Blog — MIDO XI" };
}


export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <div className="relative min-h-screen">
      <div className="pitch-grid absolute inset-0 opacity-40" aria-hidden />
      <div className="relative mx-auto max-w-2xl px-5 py-12">
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center gap-2 text-sm text-text-dim transition-colors hover:text-text-hi"
        >
          <ArrowLeft className="size-4" />
          Blog
        </Link>

        <p className="label-tech text-text-faint">
          {formatPostDate(post.date)} · {post.readMinutes} min read
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-text-hi">
          {post.title}
        </h1>

        <div className="mt-8">
          <BlogBody blocks={post.body} />
        </div>

        <div className="mt-12 border-t border-line pt-6">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-signal px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-signal-deep"
          >
            Create your player profile
          </Link>
        </div>
      </div>
    </div>
  );
}
