import Link from "next/link";
import { Users } from "lucide-react";
import { listFeed } from "@/lib/data/feed";
import { PageHeader } from "@/components/ui/kit";
import { Composer } from "@/components/community/composer";
import { PostCard } from "@/components/community/post-card";
import { EmptyState, DemoNote } from "@/components/dashboards/shared";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Community — MIDO XI" };

/*
  The feed.

  Narrow on purpose — a single column at reading width, the way a feed is read
  on a phone even when it is open on a laptop. The old community was a wide
  forum list with titles; this is one thing after another.

  Two tabs and no algorithm. "Everyone" is newest-first across the whole
  product and "Following" is newest-first from people you follow. There is no
  ranking, no suggested content and no engagement score, because the moment a
  feed starts deciding what a fifteen-year-old sees, somebody has to be
  accountable for that decision.
*/

const TABS = [
  { id: "", label: "Everyone" },
  { id: "following", label: "Following" },
];

export default async function CommunityPage({ searchParams }: PageProps<"/app/community">) {
  const params = await searchParams;
  const tab = typeof params.tab === "string" ? params.tab : "";
  const posts = await listFeed({ followingOnly: tab === "following" });

  return (
    <div className="mx-auto max-w-[560px] px-4 py-8">
      <PageHeader
        icon={Users}
        title="Community"
        tagline="What other players are working on."
        photo="soloStrike"
        kicker="You are not the only one at it"
      />

      {isDemoMode && (
        <div className="mb-6">
          <DemoNote>
            A seeded feed. Posts, follows and likes are real in the product — this is two examples
            so the shape is visible.
          </DemoNote>
        </div>
      )}

      <Composer />

      <div className="mb-4 flex gap-1 border-b border-line">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Link
              key={t.id}
              href={t.id ? `/app/community?tab=${t.id}` : "/app/community"}
              className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
                active
                  ? "border-signal text-text-hi"
                  : "border-transparent text-text-dim hover:text-text"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={Users}
          title={tab === "following" ? "Nobody you follow has posted" : "Nothing here yet"}
          body={
            tab === "following"
              ? "Follow a few players and their posts land here. Until then, Everyone shows the whole community."
              : "Post a clip, a photo from Saturday, or something you worked out this week. It is the same football you are already logging — this is just the part you choose to show."
          }
          action={
            tab === "following"
              ? { label: "See everyone", href: "/app/community" }
              : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}

      <p className="mt-8 text-xs leading-relaxed text-text-faint">
        Newest first, and nothing else. There is no ranking and no suggested content — what you see
        is what people posted, in the order they posted it. Every post can be reported, and you can
        block anyone from the corner of their post.
      </p>
    </div>
  );
}
