"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BoardView } from "./board-view";
import type { TacticalDocument } from "@/lib/tactics/types";
import { cn } from "@/lib/utils";

/*
  Reading a sequence.

  The viewer half of the frame system: step through the phases of an idea
  without any ability to change it. This is what Player OS mostly shows
  and what a coach uses when presenting — the reason it is separate from
  the editor is that "understand this" and "change this" are different
  jobs, and the second one has no business loading for the first.

  A single-frame board renders no controls at all. Most boards have one
  frame, and a "1 / 1" counter on every card would be noise.
*/

export function BoardPlayer({
  doc,
  className,
  title,
  compact,
}: {
  doc: TacticalDocument;
  className?: string;
  title?: string;
  compact?: boolean;
}) {
  const [i, setI] = useState(0);
  const total = doc.frames.length;
  const frame = doc.frames[Math.min(i, total - 1)];

  if (total <= 1) {
    return (
      <div className={className}>
        <BoardView doc={doc} title={title} />
        {frame?.caption && !compact && (
          <p className="mt-2 text-xs leading-relaxed text-text-dim">{frame.caption}</p>
        )}
      </div>
    );
  }

  const go = (d: -1 | 1) => setI((n) => Math.min(total - 1, Math.max(0, n + d)));

  return (
    <div className={className}>
      <BoardView doc={doc} frameIndex={i} title={title} />

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={i === 0}
          aria-label="Previous phase"
          className="grid size-7 shrink-0 place-items-center rounded-md border border-line text-text-dim transition-colors hover:border-line-strong hover:text-text disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" />
        </button>

        {/* Dots double as the position and as direct navigation. */}
        <div className="flex flex-1 items-center justify-center gap-1.5">
          {doc.frames.map((f, n) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setI(n)}
              aria-label={`Phase ${n + 1}${f.caption ? `: ${f.caption}` : ""}`}
              aria-current={n === i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                n === i ? "w-5 bg-signal" : "w-1.5 bg-ink-700 hover:bg-line-strong",
              )}
            />
          ))}
        </div>

        <span className="data-mono shrink-0 text-[11px] text-text-faint">
          {i + 1} / {total}
        </span>

        <button
          type="button"
          onClick={() => go(1)}
          disabled={i === total - 1}
          aria-label="Next phase"
          className="grid size-7 shrink-0 place-items-center rounded-md border border-line text-text-dim transition-colors hover:border-line-strong hover:text-text disabled:opacity-40"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      {frame?.caption && (
        <p className="mt-2 text-xs leading-relaxed text-text-dim">
          <span className="label-tech mr-1.5">{i + 1}</span>
          {frame.caption}
        </p>
      )}
    </div>
  );
}
