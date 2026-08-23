"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { FolderPlus, X, Check, Plus, Loader2 } from "lucide-react";
import {
  getClipCollectionState, setClipCollection, createCollection,
} from "@/app/app/film-room/collection-actions";
import type { Collection } from "@/lib/data/film-types";

export function AddToCollection({ clipId }: { clipId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [memberOf, setMemberOf] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const openDialog = async () => {
    setOpen(true);
    setLoading(true);
    const state = await getClipCollectionState(clipId);
    setCollections(state.collections);
    setMemberOf(state.memberOf);
    setLoading(false);
  };

  const toggle = async (colId: string) => {
    const isMember = memberOf.includes(colId);
    setMemberOf((m) => (isMember ? m.filter((x) => x !== colId) : [...m, colId]));
    await setClipCollection(colId, clipId, !isMember);
    router.refresh();
  };

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const res = await createCollection(newName.trim());
    if (res.ok && res.id) {
      await setClipCollection(res.id, clipId, true);
      const state = await getClipCollectionState(clipId);
      setCollections(state.collections);
      setMemberOf(state.memberOf);
      setNewName("");
      router.refresh();
    }
    setBusy(false);
  };

  return (
    <>
      <button onClick={openDialog} aria-label="Add to collection" title="Add to collection" className="text-text-faint transition-colors hover:text-signal-bright">
        <FolderPlus className="size-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div role="dialog" aria-modal="true" aria-label="Add to collection" className="panel-raised relative w-full max-w-sm p-5 shadow-2xl shadow-black/50" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.18 }}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-text-hi">Add to collection</h3>
                <button onClick={() => setOpen(false)} className="text-text-faint hover:text-text" aria-label="Close"><X className="size-5" /></button>
              </div>

              {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-text-dim" /></div>
              ) : (
                <div className="space-y-1.5">
                  {collections.length === 0 && <p className="py-2 text-sm text-text-dim">No collections yet — create one below.</p>}
                  {collections.map((c) => {
                    const active = memberOf.includes(c.id);
                    return (
                      <button key={c.id} onClick={() => toggle(c.id)} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${active ? "border-signal-line bg-signal/10 text-text-hi" : "border-line text-text-dim hover:border-line-strong"}`}>
                        <span className={`grid size-5 place-items-center rounded border ${active ? "border-signal bg-signal text-white" : "border-line"}`}>
                          {active && <Check className="size-3.5" />}
                        </span>
                        <span className="flex-1 truncate">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 flex gap-2 border-t border-line pt-4">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="New collection…" className="h-9 flex-1 rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none" />
                <button onClick={create} disabled={busy || !newName.trim()} className="flex size-9 items-center justify-center rounded-lg bg-signal text-white transition-colors hover:bg-signal-deep disabled:opacity-50">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
