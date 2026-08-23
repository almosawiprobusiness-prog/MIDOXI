import { Users, PenLine, Hash } from "lucide-react";
import { listFeed } from "@/lib/data/community";
import { listClips } from "@/lib/data/film";
import { PageHeader } from "@/components/ui/kit";
import { PostComposer } from "@/components/community/post-composer";
import { CommunityFeed } from "@/components/community/community-feed";

export const metadata = { title: "Community — MIDO XI" };

export default async function CommunityPage() {
  const [feed, clips] = await Promise.all([listFeed(), listClips()]);
  const clipOptions = clips.map((c) => ({ id: c.id, title: `${c.title}` }));

  // Trending tags across the feed.
  const tagCounts = new Map<string, number>();
  for (const p of feed) for (const t of p.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="mx-auto max-w-[720px] px-4 py-8 md:px-6">
      <PageHeader
        icon={Users}
        title="Community"
        tagline="Share clips, break down analysis, learn from other players."
        actions={<PostComposer clips={clipOptions} />}
      />

      {feed.length > 0 ? (
        <>
          {topTags.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 label-tech"><Hash className="size-3" /> Trending</span>
              {topTags.map(([tag, n]) => (
                <span key={tag} className="chip inline-flex items-center gap-1">
                  {tag}
                  <span className="data-mono text-[10px] text-text-faint">{n}</span>
                </span>
              ))}
            </div>
          )}
          <CommunityFeed posts={feed} />
        </>
      ) : (
        <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-xl border border-line bg-ink-850 text-signal-bright"><PenLine className="size-6" /></span>
          <h3 className="mt-4 font-display text-lg font-semibold text-text-hi">Be the first to post</h3>
          <p className="mt-1.5 max-w-sm text-sm text-text-dim">Share a clip and your read on it. Ask the community how they&rsquo;d play the moment.</p>
          <div className="mt-5"><PostComposer clips={clipOptions} /></div>
        </div>
      )}

      <p className="mt-8 text-center text-[11px] text-text-faint">
        Only what you post here is public — your matches, readiness, notes and coach feedback stay private.
      </p>
    </div>
  );
}
