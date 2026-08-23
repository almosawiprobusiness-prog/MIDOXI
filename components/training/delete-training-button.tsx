"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteTraining } from "@/app/app/training/actions";

export function DeleteTrainingButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    const res = await deleteTraining(id);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
    setBusy(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Delete session" className="flex size-8 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-correction/40 hover:text-correction">
        <Trash2 className="size-3.5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div role="dialog" aria-modal="true" className="panel-raised relative w-full max-w-sm p-5 text-center shadow-2xl shadow-black/50" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.18 }}>
              <span className="mx-auto grid size-11 place-items-center rounded-full bg-correction/10 text-correction"><Trash2 className="size-5" /></span>
              <h3 className="mt-3 font-display text-lg font-semibold text-text-hi">Delete this session?</h3>
              <p className="mt-1.5 text-sm text-text-dim">&ldquo;{title}&rdquo; will be permanently removed.</p>
              <div className="mt-5 flex gap-3">
                <button onClick={() => setOpen(false)} className="h-11 flex-1 rounded-lg border border-line text-sm text-text transition-colors hover:text-text-hi">Cancel</button>
                <button onClick={confirm} disabled={busy} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-correction font-medium text-white transition-colors hover:brightness-110 disabled:opacity-60">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
