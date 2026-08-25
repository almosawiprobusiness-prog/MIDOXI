"use client";

import { useState } from "react";
import { ListVideo } from "lucide-react";
import type { ReelItem } from "@/lib/data/film-types";
import type { Annotation } from "@/lib/data/annotation-types";
import { CollectionReel } from "./collection-reel";

/*
  The switch between reading a collection and presenting it.

  The list stays a server component and arrives here as children, so
  turning the reel on does not mean rebuilding the page in the browser —
  and turning it off puts the original list back untouched rather than a
  re-rendered copy of it.
*/
export function CollectionReelLauncher({
  name,
  items,
  annotations,
  children,
}: {
  name: string;
  items: ReelItem[];
  annotations: Annotation[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <CollectionReel
        name={name}
        items={items}
        annotations={annotations}
        onExit={() => setOpen(false)}
      />
    );
  }

  return (
    <>
      {/* Nothing to play, nothing offered. */}
      {items.length > 0 && (
        <button
          onClick={() => setOpen(true)}
          title="Play every clip in this collection, stopping on each drawing"
          className="mb-4 flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          <ListVideo className="size-4" />
          Play reel
          <span className="data-mono text-xs text-text-faint">
            {items.length} {items.length === 1 ? "clip" : "clips"}
          </span>
        </button>
      )}
      {children}
    </>
  );
}
