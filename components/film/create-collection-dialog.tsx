"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { X, Plus, Loader2, FolderPlus } from "lucide-react";
import { createCollection } from "@/app/app/film-room/collection-actions";

export function CreateCollectionDialog({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await createCollection(name);
    if (res.ok) {
      setOpen(false);
      setBusy(false);
      setName("");
      if (res.id) router.push(`/app/film-room/collections/${res.id}`);
      else router.refresh();
    } else {
      setError(res.error);
      setBusy(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className={compact
        ? "flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        : "flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-text transition-colors hover:border-signal-line hover:text-signal-bright"}>
        <FolderPlus className="size-4" /> New collection
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div role="dialog" aria-modal="true" className="panel-raised relative w-full max-w-sm p-5 shadow-2xl shadow-black/50" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.18 }}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-text-hi">New collection</h3>
                <button onClick={() => setOpen(false)} className="text-text-faint hover:text-text" aria-label="Close"><X className="size-5" /></button>
              </div>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && submit()} placeholder="e.g. My best finishes" className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none" />
              {error && <p className="mt-3 text-sm text-correction">{error}</p>}
              <div className="mt-4 flex gap-3">
                <button onClick={() => setOpen(false)} className="h-10 flex-1 rounded-lg border border-line text-sm text-text-dim transition-colors hover:text-text-hi">Cancel</button>
                <button onClick={submit} disabled={busy || !name.trim()} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-signal text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <><Plus className="size-4" /> Create</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
