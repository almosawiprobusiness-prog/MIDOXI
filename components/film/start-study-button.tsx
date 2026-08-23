"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, X, ArrowRight, Loader2 } from "lucide-react";
import { startStudySession } from "@/app/app/film-room/study/actions";

export function StartStudyButton({
  videoId,
  defaultTitle,
  goals,
}: {
  videoId: string;
  defaultTitle: string;
  goals: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [goalId, setGoalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const begin = async () => {
    setBusy(true);
    setError(null);
    const res = await startStudySession({ videoId, title, goalId: goalId || null });
    if (res.ok && res.id) {
      router.push(`/app/film-room/study/${res.id}`);
    } else {
      setError(res.ok ? "Could not start session." : res.error);
      setBusy(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-9 items-center gap-2 rounded-lg bg-signal/10 px-3 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20">
        <BookOpen className="size-4" /> Study Mode
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div role="dialog" aria-modal="true" className="panel-raised relative w-full max-w-sm p-5 shadow-2xl shadow-black/50" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.18 }}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="label-tech">Focused study</div>
                  <h3 className="font-display text-lg font-semibold text-text-hi">Start a study session</h3>
                </div>
                <button onClick={() => setOpen(false)} className="text-text-faint hover:text-text" aria-label="Close"><X className="size-5" /></button>
              </div>

              <label className="block">
                <span className="label-tech mb-1 block">Session title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} />
              </label>
              {goals.length > 0 && (
                <label className="mt-3 block">
                  <span className="label-tech mb-1 block">Connect to goal (optional)</span>
                  <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className={inp}>
                    <option value="">None</option>
                    {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </label>
              )}

              {error && <p className="mt-3 text-sm text-correction">{error}</p>}

              <button onClick={begin} disabled={busy || !title.trim()} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-signal font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <>Enter study <ArrowRight className="size-4" /></>}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const inp = "h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none";
