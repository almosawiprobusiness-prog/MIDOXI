import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { latestPosts, formatPostDate } from "@/lib/blog/posts";

export const metadata = { title: "Blog — MIDO XI" };


export default function BlogIndexPage() {
  const posts = latestPosts(50);

  return (
    <div className="relative min-h-screen">
      <div className="pitch-grid absolute inset-0 opacity-40" aria-hidden />
      <div className="relative mx-auto max-w-2xl px-5 py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-text-dim transition-colors hover:text-text-hi"
        >
          <ArrowLeft className="size-4" />
          MIDO XI
        </Link>

        <h1 className="font-display text-3xl font-bold tracking-tight text-text-hi">From the blog</h1>
        <p className="label-tech mt-2">How MIDO XI is actually built, and why</p>

        <div className="mt-10 space-y-6">
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="group block rounded-xl border border-line bg-ink-900/40 p-5 transition-colors hover:border-signal-line"
            >
              <p className="label-tech text-text-faint">
                {formatPostDate(p.date)} · {p.readMinutes} min read
              </p>
              <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-text-hi">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-dim">{p.excerpt}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-signal-bright">
                Read
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
