import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Link2, Trophy } from "lucide-react";
import { getPublicProfile } from "@/lib/data/profile";
import { listFeed } from "@/lib/data/community";
import { FeedPostCard } from "@/components/community/feed-post";

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPublicProfile(id);
  if (!p) notFound();

  const posts = (await listFeed()).filter((post) => post.userId === id);

  return (
    <div className="mx-auto max-w-[720px] px-4 py-8 md:px-6">
      <Link href="/app/community" className="mb-5 inline-flex items-center gap-2 text-sm text-text-dim transition-colors hover:text-text-hi">
        <ArrowLeft className="size-4" /> Community
      </Link>

      {/* Banner */}
      <div className="panel-raised relative overflow-hidden p-6">
        <div className="pitch-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="field-glow absolute inset-0" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-5">
          <span className="grid size-20 place-items-center rounded-xl bg-gradient-to-br from-signal to-signal-deep font-display text-3xl font-bold text-white shadow-lg shadow-signal/20">
            {p.position || p.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-3xl font-bold tracking-tight text-text-hi">{p.name}</h1>
              {p.handle && <span className="text-sm text-text-faint">@{p.handle}</span>}
            </div>
            <p className="mt-1 text-sm text-text-dim">
              {[p.position, p.club, p.nationality].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {p.playStyle && (
          <div className="min-w-0 panel p-4 sm:col-span-2">
            <div className="label-tech">Playing style</div>
            <p className="mt-1.5 text-sm leading-relaxed text-text">{p.playStyle}</p>
          </div>
        )}
        {p.strengths.length > 0 && (
          <div className="panel p-4">
            <div className="label-tech">Strengths</div>
            <div className="mt-2 flex flex-wrap gap-1.5">{p.strengths.map((s) => <span key={s} className="chip chip-signal">{s}</span>)}</div>
          </div>
        )}
        {p.favoritePlayers.length > 0 && (
          <div className="panel p-4">
            <div className="label-tech">Studies</div>
            <div className="mt-2 flex flex-wrap gap-1.5">{p.favoritePlayers.map((s) => <span key={s} className="chip">{s}</span>)}</div>
          </div>
        )}
        {p.achievements && (
          <div className="panel flex items-start gap-2 p-4 sm:col-span-2">
            <Trophy className="mt-0.5 size-4 shrink-0 text-review" />
            <p className="text-sm text-text">{p.achievements}</p>
          </div>
        )}
      </div>

      {/* Socials */}
      {(p.socials.instagram || p.socials.twitter || p.socials.youtube) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {p.socials.instagram && <Social label={`Instagram · ${p.socials.instagram}`} />}
          {p.socials.twitter && <Social label={`X · ${p.socials.twitter}`} />}
          {p.socials.youtube && <Social label={`YouTube · ${p.socials.youtube}`} />}
        </div>
      )}

      {/* Their posts */}
      {posts.length > 0 && (
        <div className="mt-8">
          <div className="label-tech mb-3">Posts · {posts.length}</div>
          <div className="space-y-3">{posts.map((post) => <FeedPostCard key={post.id} post={post} />)}</div>
        </div>
      )}
    </div>
  );
}

function Social({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-text-dim">
      <Link2 className="size-4" /> {label}
    </span>
  );
}
