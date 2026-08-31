import Link from "next/link";
import { Users, Bookmark } from "lucide-react";
import { listFeed } from "@/lib/data/feed";
import { listTraining } from "@/lib/data/training";
import { listMatches } from "@/lib/data/matches";
import { CreateDoors, type FromMido } from "@/components/community/composer";
import { PostCard } from "@/components/community/post-card";
import { Avatar } from "@/components/ui/avatar";
import { DemoNote } from "@/components/dashboards/shared";
import { POST_KINDS, type PostKind } from "@/lib/data/feed-types";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Community — MIDO XI" };

/*
  The feed — the Framer-designed Community.

  An editorial header (MIDO XI / PLAYER NETWORK · COMMUNITY), a quiet
  filter row, a dominant center feed at reading width, and a light
  context rail on desktop that never competes with the posts. Mobile
  gets the same feed with a pinned CREATE.

  Two views and no algorithm. "Discover" is newest-first across the
  whole product and "Following" is newest-first from people you follow.
  There is no ranking, no suggested content and no engagement score,
  because the moment a feed starts deciding what a fifteen-year-old
  sees, somebody has to be accountable for that decision.
*/

const VIEWS = [
  { id: "", label: "Discover" },
  { id: "following", label: "Following" },
];

const isKind = (v: string): v is PostKind => POST_KINDS.some((k) => k.value === v);

/*
  The composer's FROM MIDO strip: the player's own recent record,
  pre-formatted so posting it never means re-typing what MIDO knows.
*/
async function fromMidoItems(): Promise<FromMido[]> {
  const [training, matches] = await Promise.all([listTraining(), listMatches()]);
  const items: FromMido[] = [];

  for (const s of training.slice(0, 3)) {
    const mins = s.durationMin ? `${s.durationMin} min` : s.kind;
    items.push({
      kind: "training",
      label: `Training · ${mins}`.toUpperCase(),
      detail: s.objective || s.title,
      caption: `Training complete — ${[s.title, s.durationMin ? `${s.durationMin} min` : null, s.objective].filter(Boolean).join(" · ")}. `,
    });
  }
  for (const m of matches.slice(0, 3)) {
    const score = `${m.goalsFor}–${m.goalsAgainst}`;
    items.push({
      kind: "match",
      label: `Match · ${score}`,
      detail: `${m.home ? "vs" : "at"} ${m.opponent}`,
      caption: `${score} ${m.home ? "vs" : "at"} ${m.opponent}. `,
    });
  }
  return items;
}

export default async function CommunityPage({ searchParams }: PageProps<"/app/community">) {
  const params = await searchParams;
  const view = typeof params.view === "string" ? params.view : "";
  const kindParam = typeof params.kind === "string" && isKind(params.kind) ? params.kind : undefined;
  const savedOnly = view === "saved";

  const [posts, fromMido] = await Promise.all([
    listFeed({
      followingOnly: view === "following",
      kind: kindParam,
      savedOnly,
    }),
    fromMidoItems(),
  ]);

  /*
    The rail's "players" module is derived from the feed itself — the
    people actually posting — rather than a recommendation engine.
    Real activity, nobody fabricated.
  */
  const seen = new Set<string>();
  const activePlayers = posts
    .filter((p) => !p.mine && !seen.has(p.author.userId) && seen.add(p.author.userId))
    .slice(0, 4)
    .map((p) => p.author);

  const viewHref = (v: string, k?: string) => {
    const q = new URLSearchParams();
    if (v) q.set("view", v);
    if (k) q.set("kind", k);
    const s = q.toString();
    return s ? `/app/community?${s}` : "/app/community";
  };

  return (
    <div className="mx-auto max-w-[1040px] px-4 py-8">
      {/* Editorial header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="data-mono text-[10px] uppercase tracking-[0.2em] text-text-faint">
            MIDO XI / Player network
          </div>
          <h1 className="font-display mt-1 text-4xl font-bold uppercase leading-none tracking-wide text-text-hi">
            Community
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {VIEWS.map((v) => {
            const active = view === v.id;
            return (
              <Link
                key={v.id}
                href={viewHref(v.id, kindParam)}
                className={`h-8 rounded-full border px-3.5 text-xs leading-8 transition-colors ${
                  active
                    ? "border-signal-line bg-signal/10 text-signal-bright"
                    : "border-line text-text-dim hover:text-text"
                }`}
              >
                {v.label}
              </Link>
            );
          })}
          <CreateDoors fromMido={fromMido} />
        </div>
      </div>

      {/* The quiet filter row */}
      <div className="data-mono mb-6 flex flex-wrap gap-4 border-b border-line pb-3 text-[11px] uppercase tracking-wider">
        <Link
          href={viewHref(view)}
          className={!kindParam ? "text-signal-bright" : "text-text-dim transition-colors hover:text-text"}
        >
          All
        </Link>
        {POST_KINDS.slice(0, 4).map((k) => (
          <Link
            key={k.value}
            href={viewHref(view, k.value)}
            className={
              kindParam === k.value
                ? "text-signal-bright"
                : "text-text-dim transition-colors hover:text-text"
            }
          >
            {k.label}
          </Link>
        ))}
      </div>

      {isDemoMode && (
        <div className="mb-6">
          <DemoNote>
            A seeded feed. Posts, follows and likes are real in the product — this is two examples
            so the shape is visible.
          </DemoNote>
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
        {/* The feed — dominant, reading width. */}
        <div className="mx-auto w-full max-w-[640px]">
          {posts.length === 0 ? (
            <EmptyFeed view={view} kind={kindParam} />
          ) : (
            <div className="space-y-4">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}

          <p className="mt-8 text-xs leading-relaxed text-text-faint">
            Newest first, and nothing else. There is no ranking and no suggested content — what you
            see is what people posted, in the order they posted it. Every post can be reported, and
            you can block anyone from the corner of their post.
          </p>
        </div>

        {/* Context rail — light, real, never competing with the feed. */}
        <aside className="hidden space-y-6 lg:block">
          <div>
            <div className="label-tech mb-2">Saved</div>
            <Link
              href={viewHref("saved")}
              className={`flex items-center gap-2 text-sm transition-colors ${
                savedOnly ? "text-signal-bright" : "text-text-dim hover:text-text"
              }`}
            >
              <Bookmark className="size-3.5" /> Your saved posts
            </Link>
          </div>

          {activePlayers.length > 0 && (
            <div>
              <div className="label-tech mb-2">Posting now</div>
              <div className="space-y-2.5">
                {activePlayers.map((a) => (
                  <Link
                    key={a.userId}
                    href={a.handle ? `/app/community/${a.handle}` : `/app/community/players/${a.userId}`}
                    className="flex items-center gap-2.5"
                  >
                    <Avatar url={a.avatar} name={a.name} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-text transition-colors hover:text-text-hi">
                        {a.name}
                      </span>
                      {a.position && (
                        <span className="data-mono block text-[10px] uppercase tracking-wider text-text-faint">
                          {a.position}
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-line pt-4">
            <div className="label-tech mb-2">House rules</div>
            <p className="text-xs leading-relaxed text-text-faint">
              Football only, no ranking, and a person reads every report.{" "}
              <Link href="/community-guidelines" className="underline hover:text-text">
                The guidelines
              </Link>
              .
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/*
  The empty state — MIDO editorial, never fabricated social proof.
  Three real doors into the product, in the display voice.
*/
function EmptyFeed({ view, kind }: { view: string; kind?: string }) {
  if (view === "following") {
    return (
      <div className="panel px-6 py-10 text-center">
        <Users className="mx-auto size-6 text-text-faint" />
        <p className="mt-3 text-sm text-text-dim">
          Nobody you follow has posted yet. Follow a few players and their work lands here — until
          then,{" "}
          <Link href="/app/community" className="text-signal-bright hover:underline">
            Discover
          </Link>{" "}
          shows everyone.
        </p>
      </div>
    );
  }
  if (view === "saved") {
    return (
      <div className="panel px-6 py-10 text-center">
        <Bookmark className="mx-auto size-6 text-text-faint" />
        <p className="mt-3 text-sm text-text-dim">
          Nothing saved yet. When a post is worth coming back to — a film idea, a training focus —
          hit SAVE and it lives here, privately.
        </p>
      </div>
    );
  }
  if (kind) {
    return (
      <div className="panel px-6 py-10 text-center">
        <p className="text-sm text-text-dim">
          No {kind} posts yet.{" "}
          <Link href="/app/community" className="text-signal-bright hover:underline">
            See everything
          </Link>
          , or be the first.
        </p>
      </div>
    );
  }
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-line px-6 py-8">
        <div className="data-mono text-[10px] uppercase tracking-[0.2em] text-text-faint">
          When you&rsquo;re ready
        </div>
        <h2 className="font-display mt-2 text-3xl font-bold uppercase leading-none text-text-hi">
          Show the work.
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-text-dim">
          This is where serious players show the football they are working on — training, match
          moments, film thinking. It starts with somebody going first.
        </p>
      </div>
      <div className="space-y-3 px-6 py-5">
        {[
          { href: "/app/community?compose=1", label: "Share your first training session" },
          { href: "/app/film-room", label: "Draw on a film frame and post the question" },
          { href: "/app/community?compose=1", label: "Show what you're working on" },
        ].map((d) => (
          <Link
            key={d.label}
            href={d.href}
            className="data-mono block text-[11px] uppercase tracking-wider text-signal-bright transition-colors hover:text-signal"
          >
            → {d.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
