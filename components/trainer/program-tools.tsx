"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Layers, Check, Circle } from "lucide-react";
import { buildSchedule, toggleSession } from "@/app/app/programs/actions";
import { FormError, FormNote } from "@/components/forms/ui";
import { cn } from "@/lib/utils";

/**
 * Building the block. Two buttons on purpose: the library build is free and
 * deterministic, the MIDO build is metered — and the difference is stated
 * rather than hidden behind one ambiguous "generate".
 */
export function BuildButtons({ programId, hasSessions }: { programId: string; hasSessions: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [armed, setArmed] = useState<null | "library" | "mido">(null);

  const run = (mode: "library" | "mido") => {
    setError(null);
    setNote(null);
    setArmed(null);
    start(async () => {
      const res = await buildSchedule(programId, mode);
      if (res.ok) {
        setNote(res.message ?? null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  const click = (mode: "library" | "mido") => (hasSessions ? setArmed(mode) : run(mode));

  return (
    <div>
      {armed ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-dim">This replaces the current block.</span>
          <button
            onClick={() => run(armed)}
            className="flex h-9 items-center gap-2 rounded-lg border border-correction/40 bg-correction/10 px-3 text-sm text-correction transition-colors hover:bg-correction/20"
          >
            Replace
          </button>
          <button
            onClick={() => setArmed(null)}
            className="h-9 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:text-text"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => click("mido")}
            disabled={pending}
            className="flex h-9 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-3 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Build with MIDO
          </button>
          <button
            onClick={() => click("library")}
            disabled={pending}
            className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:border-line-strong hover:text-text disabled:opacity-60"
          >
            <Layers className="size-4" />
            Build from the library
          </button>
        </div>
      )}
      <FormError error={error} />
      <FormNote message={note} />
    </div>
  );
}

/** Marking a session done is how a block becomes a record of what happened. */
export function SessionToggle({
  programId,
  sessionId,
  completed,
}: {
  programId: string;
  sessionId: string;
  completed: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(completed);
  const [pending, start] = useTransition();

  return (
    <button
      onClick={() => {
        const next = !on;
        setOn(next);
        start(async () => {
          const res = await toggleSession(programId, sessionId);
          if (!res.ok) setOn(!next);
          else router.refresh();
        });
      }}
      disabled={pending}
      aria-pressed={on}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
        on
          ? "border-positive/40 bg-positive/10 text-positive"
          : "border-line text-text-faint hover:border-line-strong hover:text-text-dim",
      )}
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : on ? (
        <Check className="size-3" />
      ) : (
        <Circle className="size-3" />
      )}
      {on ? "Delivered" : "Mark delivered"}
    </button>
  );
}
