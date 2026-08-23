"use client";

import { useState } from "react";
import { PenLine } from "lucide-react";
import type { FeedPost } from "@/lib/data/community-types";
import { FeedPostCard } from "./feed-post";

type Filter = "all" | "clips" | "discussion";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "clips", label: "With clips" },
  { key: "discussion", label: "Discussion" },
];

export function CommunityFeed({ posts }: { posts: FeedPost[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = posts.filter((p) =>
    filter === "all" ? true : filter === "clips" ? !!p.clip : !p.clip,
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count =
            f.key === "all" ? posts.length
            : f.key === "clips" ? posts.filter((p) => p.clip).length
            : posts.filter((p) => !p.clip).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-signal-line bg-signal/10 text-signal-bright"
                  : "border-line text-text-dim hover:border-line-strong hover:text-text"
              }`}
            >
              {f.label}
              <span className="data-mono text-[10px] text-text-faint">{count}</span>
            </button>
          );
        })}
      </div>

      {shown.length > 0 ? (
        <div className="space-y-3">
          {shown.map((p) => <FeedPostCard key={p.id} post={p} />)}
        </div>
      ) : (
        <div className="panel flex flex-col items-center justify-center px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-xl border border-line bg-ink-850 text-signal-bright"><PenLine className="size-6" /></span>
          <h3 className="mt-4 font-display text-base font-semibold text-text-hi">Nothing here yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-text-dim">No posts match this filter.</p>
        </div>
      )}
    </div>
  );
}
