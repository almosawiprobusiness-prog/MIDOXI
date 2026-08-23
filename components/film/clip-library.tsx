"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Star, Filter } from "lucide-react";
import { SENTIMENTS, sentimentMeta, fmtTime, type FilmClip, type ClipSentiment } from "@/lib/data/film-types";
import { AddToCollection } from "./add-to-collection";

export function ClipLibrary({ clips, videoMap }: { clips: FilmClip[]; videoMap: Record<string, string> }) {
  const [sentiment, setSentiment] = useState<ClipSentiment | "all">("all");
  const [favOnly, setFavOnly] = useState(false);
  const [tag, setTag] = useState<string>("");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    clips.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [clips]);

  const filtered = useMemo(
    () =>
      clips.filter((c) => {
        if (sentiment !== "all" && c.sentiment !== sentiment) return false;
        if (favOnly && !c.favorite) return false;
        if (tag && !c.tags.includes(tag)) return false;
        return true;
      }),
    [clips, sentiment, favOnly, tag]
  );

  if (clips.length === 0) {
    return <p className="panel p-4 text-sm text-text-dim">No clips yet. Open a video and start marking moments.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Filter className="size-3.5 text-text-faint" />
        <FilterChip active={sentiment === "all" && !favOnly} onClick={() => { setSentiment("all"); setFavOnly(false); }}>All</FilterChip>
        {SENTIMENTS.map((s) => (
          <FilterChip key={s.key} active={sentiment === s.key} onClick={() => setSentiment(sentiment === s.key ? "all" : s.key)} color={s.color}>
            {s.label}
          </FilterChip>
        ))}
        <FilterChip active={favOnly} onClick={() => setFavOnly((v) => !v)} color="var(--review)">★ Favorites</FilterChip>
        {allTags.length > 0 && (
          <select aria-label="Filter clips by tag" value={tag} onChange={(e) => setTag(e.target.value)} className="h-8 rounded-lg border border-line bg-ink-850 px-2 text-xs text-text focus:border-signal-line focus:outline-none">
            <option value="">All tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((c) => {
            const sm = sentimentMeta(c.sentiment);
            return (
              <div key={c.id} className="min-w-0 group panel flex items-start gap-3 p-3 transition-colors hover:border-line-strong">
                <Link href={`/app/film-room/${c.videoId}`} className="data-mono shrink-0 rounded-md border border-line px-2 py-1 text-xs text-signal-bright transition-colors hover:border-signal-line">{fmtTime(c.startSeconds)}</Link>
                <Link href={`/app/film-room/${c.videoId}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-text-hi">{c.title}</span>
                    {c.favorite && <Star className="size-3.5 shrink-0 text-review" fill="var(--review)" />}
                    {sm && <span className="chip" style={{ color: sm.color, borderColor: sm.color }}>{sm.label}</span>}
                  </div>
                  <div className="label-tech mt-0.5 truncate">{videoMap[c.videoId] ?? "Video"}</div>
                  {c.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.tags.slice(0, 4).map((t) => <span key={t} className="chip">{t}</span>)}
                    </div>
                  )}
                </Link>
                <AddToCollection clipId={c.id} />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="panel p-4 text-sm text-text-dim">No clips match these filters.</p>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, color, children }: { active: boolean; onClick: () => void; color?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="rounded-lg border px-2.5 py-1 text-xs transition-colors" style={active ? { borderColor: color ?? "var(--signal-line)", color: color ?? "var(--signal-bright)", background: "var(--signal-wash)" } : { borderColor: "var(--line-strong)", color: "var(--text-dim)" }}>
      {children}
    </button>
  );
}
