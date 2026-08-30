"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, ArrowUpRight } from "lucide-react";
import { startStudySession } from "@/app/app/film-room/study/actions";
import type { WatchFocus } from "@/lib/knowledge/watch-focus";

/*
  Watch with a job.

  The player is going to watch this match anyway; the panel hands them
  one focus question derived from their record, and a Start that opens
  a real study session — same notes, same completion flow, same
  insight-evidence path as any other study. The focus is deterministic
  (lib/knowledge/watch-focus.ts): MIDO never claims anything about the
  match itself, only how to watch it.
*/

export function WatchStudyPanel({ focus, goalId }: { focus: WatchFocus; goalId: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    const res = await startStudySession({ title: focus.title, goalId, sourceKind: "watch" });
    if (res.ok && res.id) {
      router.push(`/app/film-room/study/${res.id}`);
    } else {
      setError(res.ok ? "The session could not be opened." : res.error);
      setBusy(false);
    }
  };

  return (
    <section className="mb-6 relative min-w-0 overflow-hidden rounded-xl border border-signal-line bg-gradient-to-b from-signal/10 via-ink-900 to-ink-900 p-5">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="label-tech !text-signal-bright">Watch with a job / 01</span>
        <span className="label-tech">{focus.conceptName}</span>
      </div>
      <p className="max-w-2xl text-sm leading-relaxed text-text-hi">{focus.instruction}</p>
      <p className="mt-1.5 text-xs text-text-dim">{focus.because}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {focus.watchFor.map((w, i) => (
          <span key={i} className="chip">{w}</span>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={start}
          disabled={busy}
          className="inline-flex h-9 items-center gap-2 rounded-full bg-signal px-4 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
          Start watch study <ArrowUpRight className="size-4" />
        </button>
        {error && <span className="text-xs text-correction">{error}</span>}
      </div>
    </section>
  );
}
