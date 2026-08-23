"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { X, Loader2, PenLine, Clapperboard } from "lucide-react";
import { createPost } from "@/app/app/community/actions";

const TAGS = ["Movement", "Finishing", "Pressing", "Build-up", "1v1", "Set Piece", "Midfield", "Defending", "Strikers", "Wingers", "Goalkeeping", "Mentality"];

export function PostComposer({ clips }: { clips: { id: string; title: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [clipId, setClipId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (t: string) => setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : p.length >= 4 ? p : [...p, t]));

  const submit = async () => {
    setBusy(true); setError(null);
    const res = await createPost({ title, body, clipId: clipId || null, tags });
    if (res.ok) {
      setOpen(false); setBusy(false);
      setTitle(""); setBody(""); setClipId(""); setTags([]);
      if (res.id) router.push(`/app/community/posts/${res.id}`); else router.refresh();
    } else { setError(res.error); setBusy(false); }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-9 items-center gap-2 rounded-lg bg-signal px-3.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep">
        <PenLine className="size-4" /> Share analysis
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-[9vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div role="dialog" aria-modal="true" aria-label="Share analysis" className="panel-raised relative w-full max-w-lg p-5 shadow-2xl shadow-black/50" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="label-tech">New post</div>
                  <h3 className="font-display text-lg font-semibold text-text-hi">Share analysis</h3>
                </div>
                <button onClick={() => setOpen(false)} className="text-text-faint hover:text-text" aria-label="Close"><X className="size-5" /></button>
              </div>

              <label className="block">
                <span className="label-tech mb-1 block">Title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} placeholder="e.g. Timing the run behind the last line" />
              </label>
              <label className="mt-3 block">
                <span className="label-tech mb-1 block">Your analysis</span>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className={`${inp} h-auto resize-y py-2`} placeholder="What did you see? What's the principle? Ask the community." />
              </label>

              {clips.length > 0 && (
                <label className="mt-3 block">
                  <span className="label-tech mb-1 flex items-center gap-1.5"><Clapperboard className="size-3.5" /> Attach a clip (optional)</span>
                  <select value={clipId} onChange={(e) => setClipId(e.target.value)} className={inp}>
                    <option value="">No clip</option>
                    {clips.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                  <span className="mt-1 block text-[11px] text-text-faint">Private uploads share as a labelled clip card; YouTube clips embed for everyone.</span>
                </label>
              )}

              <div className="mt-3">
                <span className="label-tech mb-1.5 block">Topics</span>
                <div className="flex flex-wrap gap-1.5">
                  {TAGS.map((t) => {
                    const active = tags.includes(t);
                    return (
                      <button key={t} onClick={() => toggleTag(t)} className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${active ? "border-signal-line bg-signal/10 text-signal-bright" : "border-line text-text-dim hover:text-text"}`}>
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && <p className="mt-3 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-sm text-correction">{error}</p>}

              <div className="mt-5 flex items-center gap-3">
                <button onClick={() => setOpen(false)} className="h-11 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:text-text-hi">Cancel</button>
                <button onClick={submit} disabled={busy || !title.trim() || !body.trim()} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-signal font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <><PenLine className="size-4" /> Post</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const inp = "h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none";
